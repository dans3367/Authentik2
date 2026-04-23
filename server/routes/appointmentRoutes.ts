import { Router, Request, Response } from 'express';
import { and, eq, desc, asc, like, ilike, gte, lte, isNull, isNotNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  appointments,
  appointmentReminders,
  appointmentAutoReminderSettings,
  emailContacts,
  companies,
  shops,
  betterAuthUser,
  createAppointmentSchema,
  updateAppointmentSchema,
  createAppointmentReminderSchema,
  Appointment,
  AppointmentReminder
} from '@shared/schema';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/auth-middleware';
import { logActivity, computeChanges } from '../utils/activityLogger';
import { v4 as uuidv4 } from 'uuid';
import { cancelReminderRun, triggerRescheduleEmail, triggerThankYouEmail } from '../lib/trigger';
import { resolveShopId } from '../utils/defaultShop';

const router = Router();

/**
 * Cancels all pending reminders for an appointment when it's rescheduled.
 * This prevents old reminders from firing at incorrect times.
 */
async function cancelPendingRemindersForAppointment(appointmentId: string): Promise<{ cancelled: number; errors: string[] }> {
  const errors: string[] = [];
  let cancelled = 0;

  try {
    // Find all pending reminders for this appointment
    const pendingReminders = await db
      .select()
      .from(appointmentReminders)
      .where(and(
        eq(appointmentReminders.appointmentId, appointmentId),
        eq(appointmentReminders.status, 'pending')
      ));

    console.log(`[Reschedule] Found ${pendingReminders.length} pending reminders for appointment ${appointmentId}`);

    for (const reminder of pendingReminders) {
      try {
        // Cancel the Trigger.dev run if we have a run ID (stored in inngestEventId field for backwards compatibility)
        if (reminder.inngestEventId) {
          try {
            const result = await cancelReminderRun(reminder.inngestEventId);
            if (!result.success) {
              console.warn(`[Reschedule] Failed to cancel Trigger.dev run ${reminder.inngestEventId}: ${result.error}`);
            } else {
              console.log(`[Reschedule] Cancelled Trigger.dev run ${reminder.inngestEventId}`);
            }
          } catch (triggerError) {
            console.warn(`[Reschedule] Error cancelling Trigger.dev run:`, triggerError);
          }
        }

        // Update reminder status to cancelled in database
        await db
          .update(appointmentReminders)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(appointmentReminders.id, reminder.id));

        cancelled++;
        console.log(`[Reschedule] Cancelled reminder ${reminder.id}`);
      } catch (reminderError) {
        const errorMsg = `Failed to cancel reminder ${reminder.id}: ${reminderError}`;
        console.error(`[Reschedule] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = `Failed to fetch pending reminders: ${error}`;
    console.error(`[Reschedule] ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { cancelled, errors };
}


// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireTenant);

// GET /api/appointments - List appointments with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    // Disable caching to ensure fresh data on every request
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { search, status, customerId, dateFrom, dateTo, serviceType } = req.query;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Build where conditions
    const conditions = [eq(appointments.tenantId, tenantId)];

    // Shop-level filtering when a specific shop is selected
    if ((req as any).shopId) {
      conditions.push(eq(appointments.shopId, (req as any).shopId));
    }

    if (status && status !== 'all') {
      conditions.push(eq(appointments.status, status as string));
    }

    if (customerId) {
      conditions.push(eq(appointments.customerId, customerId as string));
    }

    if (dateFrom) {
      conditions.push(gte(appointments.appointmentDate, new Date(dateFrom as string)));
    }

    if (dateTo) {
      conditions.push(lte(appointments.appointmentDate, new Date(dateTo as string)));
    }

    if (serviceType) {
      conditions.push(eq(appointments.serviceType, serviceType as string));
    }

    // Fetch appointments with customer details
    // Note: confirmationToken intentionally excluded from list response for security
    let query = db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        userId: appointments.userId,
        providerId: appointments.providerId,
        title: appointments.title,
        description: appointments.description,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        serviceType: appointments.serviceType,
        status: appointments.status,
        notes: appointments.notes,
        reminderSent: appointments.reminderSent,
        reminderSentAt: appointments.reminderSentAt,
        confirmationReceived: appointments.confirmationReceived,
        confirmationReceivedAt: appointments.confirmationReceivedAt,
        statusChangedBy: appointments.statusChangedBy,
        declineReason: appointments.declineReason,
        reminderSettings: appointments.reminderSettings,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        // Customer details
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          status: emailContacts.status,
          address: emailContacts.address,
          city: emailContacts.city,
          state: emailContacts.state,
          zipCode: emailContacts.zipCode,
          country: emailContacts.country,
          phoneNumber: emailContacts.phoneNumber,
        },
        // Provider (assigned user) details
        provider: {
          id: betterAuthUser.id,
          name: betterAuthUser.name,
          email: betterAuthUser.email,
        },
        // Shop details
        shop: {
          id: shops.id,
          name: shops.name,
        },
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .leftJoin(betterAuthUser, eq(appointments.providerId, betterAuthUser.id))
      .leftJoin(shops, eq(appointments.shopId, shops.id));

    // Apply search filter across multiple fields (case-insensitive)
    let finalQuery;
    if (search) {
      const searchPattern = `%${search}%`;
      finalQuery = query.where(
        and(
          ...conditions,
          or(
            ilike(appointments.title, searchPattern),
            ilike(appointments.description, searchPattern),
            ilike(appointments.location, searchPattern),
            ilike(emailContacts.firstName, searchPattern),
            ilike(emailContacts.lastName, searchPattern),
            ilike(emailContacts.email, searchPattern),
            // Also search combined full name (first + last and last + first)
            sql`LOWER(CONCAT(${emailContacts.firstName}, ' ', ${emailContacts.lastName})) LIKE LOWER(${searchPattern})`,
            sql`LOWER(CONCAT(${emailContacts.lastName}, ' ', ${emailContacts.firstName})) LIKE LOWER(${searchPattern})`
          )
        )
      );
    } else {
      finalQuery = query.where(and(...conditions));
    }

    const appointmentsList = await finalQuery.orderBy(desc(appointments.appointmentDate));

    res.json({
      appointments: appointmentsList,
      total: appointmentsList.length
    });
  } catch (error) {
    console.error('Failed to fetch appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/:id - Get specific appointment (public endpoint for confirmation)
router.get('/:id', async (req: Request, res: Response) => {
  // Check if this is a public confirmation request
  const { token } = req.query;

  if (token) {
    // Public endpoint for appointment confirmation
    return handlePublicAppointmentView(req, res);
  }

  // Private endpoint - require authentication
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    const appointment = await db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        userId: appointments.userId,
        title: appointments.title,
        description: appointments.description,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        serviceType: appointments.serviceType,
        status: appointments.status,
        notes: appointments.notes,
        reminderSent: appointments.reminderSent,
        reminderSentAt: appointments.reminderSentAt,
        confirmationReceived: appointments.confirmationReceived,
        confirmationReceivedAt: appointments.confirmationReceivedAt,
        statusChangedBy: appointments.statusChangedBy,
        confirmationToken: appointments.confirmationToken,
        declineReason: appointments.declineReason,
        reminderSettings: appointments.reminderSettings,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        // Customer details
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          status: emailContacts.status,
          address: emailContacts.address,
          city: emailContacts.city,
          state: emailContacts.state,
          zipCode: emailContacts.zipCode,
          country: emailContacts.country,
          phoneNumber: emailContacts.phoneNumber,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment: appointment[0] });
  } catch (error) {
    console.error('Failed to fetch appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST /api/appointments - Create new appointment
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.tenantId;
    const userId = user.id;

    // Validate request body
    const validatedData = createAppointmentSchema.parse(req.body);

    // Verify customer belongs to this tenant
    const customer = await db
      .select()
      .from(emailContacts)
      .where(and(
        eq(emailContacts.id, validatedData.customerId),
        eq(emailContacts.tenantId, tenantId)
      ))
      .limit(1);

    if (customer.length === 0) {
      return res.status(400).json({ error: 'Customer not found or does not belong to your organization' });
    }

    // Verify provider belongs to this tenant (if provided)
    if (validatedData.providerId) {
      const provider = await db
        .select({ id: betterAuthUser.id })
        .from(betterAuthUser)
        .where(and(
          eq(betterAuthUser.id, validatedData.providerId),
          eq(betterAuthUser.tenantId, tenantId),
        ))
        .limit(1);
      if (provider.length === 0) {
        return res.status(400).json({ error: 'Provider not found or does not belong to your organization' });
      }
    }

    // Generate confirmation token
    const confirmationToken = uuidv4();

    // Resolve shopId: use selected shop from header, or fall back to tenant default
    const shopId = await resolveShopId((req as any).shopId, tenantId);

    // Create appointment
    const newAppointment = await db
      .insert(appointments)
      .values({
        tenantId,
        userId,
        confirmationToken,
        shopId,
        ...validatedData,
      })
      .returning();

    // Fetch customer data if customerId exists to match GET response structure
    let appointmentCustomer = null;
    if (newAppointment[0].customerId) {
      const customerData = await db
        .select({
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          status: emailContacts.status,
          address: emailContacts.address,
          city: emailContacts.city,
          state: emailContacts.state,
          zipCode: emailContacts.zipCode,
          country: emailContacts.country,
          phoneNumber: emailContacts.phoneNumber,
        })
        .from(emailContacts)
        .where(and(eq(emailContacts.id, newAppointment[0].customerId), eq(emailContacts.tenantId, tenantId)))
        .limit(1);
      appointmentCustomer = customerData[0] || null;
    }

    // Fetch provider details if assigned
    let appointmentProvider = null;
    if (newAppointment[0].providerId) {
      const providerData = await db
        .select({ id: betterAuthUser.id, name: betterAuthUser.name, email: betterAuthUser.email })
        .from(betterAuthUser)
        .where(and(eq(betterAuthUser.id, newAppointment[0].providerId), eq(betterAuthUser.tenantId, tenantId)))
        .limit(1);
      appointmentProvider = providerData[0] || null;
    }

    // Log activity for appointment creation
    const customerName = appointmentCustomer
      ? `${appointmentCustomer.firstName || ''} ${appointmentCustomer.lastName || ''}`.trim() || appointmentCustomer.email
      : 'Unknown Customer';

    try {
      await logActivity({
        tenantId,
        userId,
        entityType: 'appointment',
        entityId: newAppointment[0].id,
        entityName: newAppointment[0].title,
        activityType: 'created',
        description: `Created appointment "${newAppointment[0].title}" for ${customerName}`,
        metadata: {
          customerId: newAppointment[0].customerId,
          customerName,
          appointmentDate: newAppointment[0].appointmentDate,
          serviceType: newAppointment[0].serviceType,
          location: newAppointment[0].location,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment creation:', error);
    }

    res.status(201).json({
      appointment: { ...newAppointment[0], customer: appointmentCustomer, provider: appointmentProvider },
      message: 'Appointment created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Failed to create appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PUT /api/appointments/:id - Update appointment (full update)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Validate request body
    const validatedData = updateAppointmentSchema.parse(req.body);

    // Check if appointment exists and belongs to tenant
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify provider (if being set) belongs to this tenant
    if (validatedData.providerId) {
      const provider = await db
        .select({ id: betterAuthUser.id })
        .from(betterAuthUser)
        .where(and(
          eq(betterAuthUser.id, validatedData.providerId),
          eq(betterAuthUser.tenantId, tenantId),
        ))
        .limit(1);
      if (provider.length === 0) {
        return res.status(400).json({ error: 'Provider not found or does not belong to your organization' });
      }
    }

    // Check if appointment date/time is being changed - if so, cancel pending reminders
    const existing = existingAppointment[0];
    const isDateChanging = validatedData.appointmentDate &&
      new Date(validatedData.appointmentDate).getTime() !== new Date(existing.appointmentDate).getTime();

    let remindersCancelled = 0;
    if (isDateChanging) {
      console.log(`[Reschedule] Appointment ${id} date/time is changing, cancelling pending reminders`);
      const cancelResult = await cancelPendingRemindersForAppointment(id);
      remindersCancelled = cancelResult.cancelled;
      if (cancelResult.errors.length > 0) {
        console.warn(`[Reschedule] Some reminders failed to cancel:`, cancelResult.errors);
      }
    }

    // Update appointment
    const updatedAppointment = await db
      .update(appointments)
      .set({
        ...validatedData,
        // Reset reminder flags if date/time changed so new reminders can be scheduled
        ...(isDateChanging ? {
          reminderSent: false,
          reminderSentAt: null,
        } : {}),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    // Log activity for appointment update
    const changes = computeChanges(existing, updatedAppointment[0], [
      'title', 'description', 'appointmentDate', 'duration', 'location',
      'serviceType', 'status', 'notes', 'customerId', 'providerId'
    ]);

    try {
      await logActivity({
        tenantId,
        userId: user.id,
        entityType: 'appointment',
        entityId: id,
        entityName: updatedAppointment[0].title,
        activityType: 'updated',
        description: `Updated appointment "${updatedAppointment[0].title}"`,
        changes: changes || undefined,
        metadata: {
          isDateChanged: isDateChanging,
          remindersCancelled,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment update:', error);
    }

    res.json({
      appointment: updatedAppointment[0],
      message: 'Appointment updated successfully',
      remindersCancelled: remindersCancelled > 0 ? remindersCancelled : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Failed to update appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// PATCH /api/appointments/:id - Partial update appointment
// Security: Only whitelisted fields can be updated to prevent mass assignment
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Whitelist of allowed fields for PATCH updates - prevents mass assignment attacks
    const allowedFields = [
      'title', 'description', 'appointmentDate', 'duration', 'location',
      'serviceType', 'status', 'notes', 'customerId', 'reminderSettings', 'providerId'
    ];

    // Build sanitized update data with only allowed fields
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      // Check if status is being changed to confirmed or cancelled by an employee
      if (updateData.status === 'confirmed' || updateData.status === 'cancelled') {
        const userName = user.firstName
          ? `${user.firstName} ${user.lastName || ''}`.trim()
          : user.name || 'Employee';

        // Only set statusChangedBy if we have a name (avoid setting to default 'Employee' if possible)
        updateData.statusChangedBy = userName;

        // Also update the confirmationReceived flag if it's confirmed
        if (updateData.status === 'confirmed') {
          updateData.confirmationReceived = true;
          updateData.confirmationReceivedAt = new Date();
        }
      }
    }

    // Convert date strings to Date objects if present
    if (updateData.appointmentDate) {
      updateData.appointmentDate = new Date(updateData.appointmentDate);
      if (isNaN(updateData.appointmentDate.getTime())) {
        return res.status(400).json({ error: 'Invalid appointmentDate format' });
      }
    }

    // Normalise providerId: empty string → null (unassign)
    if ('providerId' in updateData) {
      if (updateData.providerId === '' || updateData.providerId === undefined) {
        updateData.providerId = null;
      }
      if (updateData.providerId) {
        const provider = await db
          .select({ id: betterAuthUser.id })
          .from(betterAuthUser)
          .where(and(
            eq(betterAuthUser.id, updateData.providerId),
            eq(betterAuthUser.tenantId, tenantId),
          ))
          .limit(1);
        if (provider.length === 0) {
          return res.status(400).json({ error: 'Provider not found or does not belong to your organization' });
        }
      }
    }

    // Check if appointment exists and belongs to tenant
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if appointment date/time is being changed - if so, cancel pending reminders
    const existing = existingAppointment[0];
    const isDateChanging = updateData.appointmentDate &&
      new Date(updateData.appointmentDate).getTime() !== new Date(existing.appointmentDate).getTime();

    let remindersCancelled = 0;
    if (isDateChanging) {
      console.log(`[Reschedule] Appointment ${id} date/time is changing, cancelling pending reminders`);
      const cancelResult = await cancelPendingRemindersForAppointment(id);
      remindersCancelled = cancelResult.cancelled;
      if (cancelResult.errors.length > 0) {
        console.warn(`[Reschedule] Some reminders failed to cancel:`, cancelResult.errors);
      }
    }

    // Update appointment with partial data
    const updatedAppointment = await db
      .update(appointments)
      .set({
        ...updateData,
        // Reset reminder flags if date/time changed so new reminders can be scheduled
        ...(isDateChanging ? {
          reminderSent: false,
          reminderSentAt: null,
        } : {}),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    // Log activity for appointment update
    const changes = computeChanges(existing, updatedAppointment[0], [
      'title', 'description', 'appointmentDate', 'duration', 'location',
      'serviceType', 'status', 'notes', 'customerId', 'providerId'
    ]);

    try {
      await logActivity({
        tenantId,
        userId: user.id,
        entityType: 'appointment',
        entityId: id,
        entityName: updatedAppointment[0].title,
        activityType: 'updated',
        description: `Updated appointment "${updatedAppointment[0].title}"`,
        changes: changes || undefined,
        metadata: {
          isDateChanged: isDateChanging,
          remindersCancelled,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment update:', error);
    }

    res.json({
      appointment: updatedAppointment[0],
      message: 'Appointment updated successfully',
      remindersCancelled: remindersCancelled > 0 ? remindersCancelled : undefined,
    });
  } catch (error) {
    console.error('Failed to update appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE /api/appointments/:id - Delete appointment
router.delete('/:id', requireRole(['Owner', 'Administrator', 'Manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Check if appointment exists and belongs to tenant
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Cancel all pending Trigger.dev reminder tasks before deleting
    console.log(`[Delete] Cancelling pending reminders for appointment ${id}`);
    const cancelResult = await cancelPendingRemindersForAppointment(id);
    if (cancelResult.cancelled > 0) {
      console.log(`[Delete] Cancelled ${cancelResult.cancelled} pending reminder(s)`);
    }
    if (cancelResult.errors.length > 0) {
      console.warn(`[Delete] Some reminders failed to cancel:`, cancelResult.errors);
    }

    // Delete appointment (this will cascade delete reminders from DB)
    await db
      .delete(appointments)
      .where(eq(appointments.id, id));

    // Log activity for appointment deletion after deleting
    const deletedAppointment = existingAppointment[0];
    try {
      await logActivity({
        tenantId,
        userId: user.id,
        entityType: 'appointment',
        entityId: id,
        entityName: deletedAppointment.title,
        activityType: 'deleted',
        description: `Deleted appointment "${deletedAppointment.title}"`,
        metadata: {
          customerId: deletedAppointment.customerId,
          appointmentDate: deletedAppointment.appointmentDate,
          serviceType: deletedAppointment.serviceType,
          status: deletedAppointment.status,
          remindersCancelled: cancelResult.cancelled,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment deletion:', error);
    }

    res.json({
      message: 'Appointment deleted successfully',
      remindersCancelled: cancelResult.cancelled
    });
  } catch (error) {
    console.error('Failed to delete appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// POST /api/appointments/:id/confirm - Confirm appointment via API (requires auth + valid token)
// Note: This endpoint is behind authenticateToken middleware. For public customer confirmation,
// use GET /api/appointments/:id/confirm?token=xxx from appointmentConfirmationRoutes
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Confirmation token is required' });
    }

    // Find appointment by ID and token
    const appointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.confirmationToken, token)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Invalid appointment or confirmation token' });
    }

    // Update appointment to confirmed
    const updatedAppointment = await db
      .update(appointments)
      .set({
        status: 'confirmed',
        confirmationReceived: true,
        confirmationReceivedAt: new Date(),
        statusChangedBy: 'Customer',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    res.json({
      message: 'Appointment confirmed successfully',
      appointment: updatedAppointment[0]
    });
  } catch (error) {
    console.error('Failed to confirm appointment:', error);
    res.status(500).json({ error: 'Failed to confirm appointment' });
  }
});

// Public endpoint for viewing appointment details via confirmation token
async function handlePublicAppointmentView(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const appointment = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        description: appointments.description,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        serviceType: appointments.serviceType,
        status: appointments.status,
        // Customer details
        customer: {
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.confirmationToken, token as string)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or invalid token' });
    }

    res.json({ appointment: appointment[0] });
  } catch (error) {
    console.error('Failed to fetch appointment for confirmation:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
}

// POST /api/appointments/:id/send-reschedule-email - Send reschedule invitation email to customer
router.post('/:id/send-reschedule-email', requireRole(['Owner', 'Administrator', 'Manager', 'User']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Fetch appointment with customer details
    const appointment = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        status: appointments.status,
        customerId: appointments.customerId,
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = appointment[0];

    // Verify status is cancelled or no_show
    if (appt.status !== 'cancelled' && appt.status !== 'no_show') {
      return res.status(400).json({
        error: 'Reschedule emails can only be sent for cancelled or no-show appointments'
      });
    }

    // Verify customer has email
    if (!appt.customer?.email) {
      return res.status(400).json({ error: 'Customer does not have an email address' });
    }

    // Format date and time for email
    const appointmentDate = new Date(appt.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Build customer name
    const customerName = appt.customer.firstName
      ? `${appt.customer.firstName}${appt.customer.lastName ? ' ' + appt.customer.lastName : ''}`
      : 'Valued Customer';

    // Trigger the reschedule email via Trigger.dev
    const result = await triggerRescheduleEmail({
      appointmentId: appt.id,
      customerId: appt.customer.id,
      customerEmail: appt.customer.email,
      customerName,
      appointmentTitle: appt.title,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      location: appt.location || undefined,
      status: appt.status as 'cancelled' | 'no_show',
      tenantId,
    });

    if (!result.success) {
      console.error('Failed to trigger reschedule email:', result.error);
      return res.status(500).json({
        error: 'Failed to send reschedule email',
        details: result.error
      });
    }

    console.log(`📧 Reschedule email triggered for appointment ${id}, runId: ${result.runId}`);

    res.json({
      message: 'Reschedule email sent successfully',
      runId: result.runId
    });
  } catch (error) {
    console.error('Failed to send reschedule email:', error);
    res.status(500).json({ error: 'Failed to send reschedule email' });
  }
});

// POST /api/appointments/:id/send-thank-you-email - Send thank-you email when appointment is completed
router.post('/:id/send-thank-you-email', requireRole(['Owner', 'Administrator', 'Manager', 'User']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Fetch appointment with customer details
    const appointment = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        status: appointments.status,
        customerId: appointments.customerId,
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = appointment[0];

    // Verify status is completed
    if (appt.status !== 'completed') {
      return res.status(400).json({
        error: 'Thank-you emails can only be sent for completed appointments'
      });
    }

    // Verify customer has email
    if (!appt.customer?.email) {
      return res.status(400).json({ error: 'Customer does not have an email address' });
    }

    // Fetch company name for the email
    let companyName = 'Our Team';
    try {
      const companyResult = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.tenantId, tenantId))
        .limit(1);
      if (companyResult[0]?.name) {
        companyName = companyResult[0].name;
      }
    } catch (e) {
      console.warn('[Thank You Email] Could not fetch company name:', e);
    }

    // Format date and time for email
    const appointmentDate = new Date(appt.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Build customer name
    const customerName = appt.customer.firstName
      ? `${appt.customer.firstName}${appt.customer.lastName ? ' ' + appt.customer.lastName : ''}`
      : 'Valued Customer';

    // Trigger the thank-you email via Trigger.dev
    const result = await triggerThankYouEmail({
      appointmentId: appt.id,
      customerId: appt.customer.id,
      customerEmail: appt.customer.email,
      customerName,
      appointmentTitle: appt.title,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      location: appt.location || undefined,
      companyName,
      tenantId,
    });

    if (!result.success) {
      console.error('Failed to trigger thank-you email:', result.error);
      return res.status(500).json({
        error: 'Failed to send thank-you email',
        details: result.error
      });
    }

    console.log(`📧 Thank-you email triggered for appointment ${id}, runId: ${result.runId}`);

    res.json({
      message: 'Thank-you email sent successfully',
      runId: result.runId
    });
  } catch (error) {
    console.error('Failed to send thank-you email:', error);
    res.status(500).json({ error: 'Failed to send thank-you email' });
  }
});

// ─── Auto-reminder settings ─────────────────────────────────────────────────

// GET current auto-reminder settings for the tenant
router.get("/auto-reminder-settings", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const row = await db.query.appointmentAutoReminderSettings.findFirst({
      where: eq(appointmentAutoReminderSettings.tenantId, req.user.tenantId),
    });

    res.json({ enabled: row?.enabled ?? false });
  } catch (error) {
    console.error('Get auto-reminder settings error:', error);
    res.status(500).json({ message: 'Failed to get auto-reminder settings' });
  }
});

// PUT enable/disable auto-reminder for the tenant
router.put("/auto-reminder-settings", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }

    // Upsert: insert or update
    await db.insert(appointmentAutoReminderSettings).values({
      tenantId: req.user.tenantId,
      enabled,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [appointmentAutoReminderSettings.tenantId],
      set: {
        enabled,
        updatedAt: new Date(),
      },
    });

    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'appointment',
      activityType: 'updated',
      description: `Appointment auto-reminder ${enabled ? 'enabled' : 'disabled'}`,
      metadata: { enabled },
      req,
    });

    res.json({ message: `Auto-reminder ${enabled ? 'enabled' : 'disabled'} successfully`, enabled });
  } catch (error) {
    console.error('Update auto-reminder settings error:', error);
    res.status(500).json({ message: 'Failed to update auto-reminder settings' });
  }
});

export default router;
