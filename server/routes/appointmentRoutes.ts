import { Router, Request, Response } from 'express';
import { and, eq, desc, asc, like, ilike, gte, lte, isNull, isNotNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  appointments,
  appointmentReminders,
  emailContacts,
  createAppointmentSchema,
  updateAppointmentSchema,
  createAppointmentReminderSchema,
  Appointment,
  AppointmentReminder
} from '@shared/schema';
import { authenticateToken } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/auth-middleware';
import { v4 as uuidv4 } from 'uuid';
import { cancelReminderRun, triggerRescheduleEmail } from '../lib/trigger';

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

// GET /api/appointments - List appointments with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    // Disable caching to ensure fresh data on every request
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { search, status, customerId, dateFrom, dateTo, serviceType, archived } = req.query;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Build where conditions
    const conditions = [eq(appointments.tenantId, tenantId)];

    // Filter by archived status - by default show non-archived, use archived=true to show archived only, archived=all to show all
    if (archived === 'true') {
      conditions.push(eq(appointments.isArchived, true));
    } else if (archived !== 'all') {
      conditions.push(eq(appointments.isArchived, false));
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
    let query = db
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
        confirmationToken: appointments.confirmationToken,
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
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id));

    // Apply search filter across multiple fields (case-insensitive)
    if (search) {
      const searchPattern = `%${search}%`;
      query = query.where(
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
      query = query.where(and(...conditions));
    }

    const appointmentsList = await query.orderBy(desc(appointments.appointmentDate));

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
        confirmationToken: appointments.confirmationToken,
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

    // Generate confirmation token
    const confirmationToken = uuidv4();

    // Create appointment
    const newAppointment = await db
      .insert(appointments)
      .values({
        tenantId,
        userId,
        confirmationToken,
        ...validatedData,
      })
      .returning();

    res.status(201).json({
      appointment: newAppointment[0],
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
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // For PATCH, we accept partial updates but need to convert date strings
    const updateData: any = { ...req.body };

    // Convert date strings to Date objects if present
    if (updateData.appointmentDate) {
      updateData.appointmentDate = new Date(updateData.appointmentDate);
    }
    if (updateData.reminderSentAt) {
      updateData.reminderSentAt = new Date(updateData.reminderSentAt);
    }
    if (updateData.confirmationReceivedAt) {
      updateData.confirmationReceivedAt = new Date(updateData.confirmationReceivedAt);
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

// POST /api/appointments/:id/archive - Archive appointment
router.post('/:id/archive', async (req: Request, res: Response) => {
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

    // Archive the appointment
    const archivedAppointment = await db
      .update(appointments)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    res.json({
      appointment: archivedAppointment[0],
      message: 'Appointment archived successfully'
    });
  } catch (error) {
    console.error('Failed to archive appointment:', error);
    res.status(500).json({ error: 'Failed to archive appointment' });
  }
});

// POST /api/appointments/:id/unarchive - Unarchive appointment
router.post('/:id/unarchive', async (req: Request, res: Response) => {
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

    // Unarchive the appointment
    const unarchivedAppointment = await db
      .update(appointments)
      .set({
        isArchived: false,
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    res.json({
      appointment: unarchivedAppointment[0],
      message: 'Appointment unarchived successfully'
    });
  } catch (error) {
    console.error('Failed to unarchive appointment:', error);
    res.status(500).json({ error: 'Failed to unarchive appointment' });
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

    // Delete appointment (this will cascade delete reminders)
    await db
      .delete(appointments)
      .where(eq(appointments.id, id));

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Failed to delete appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// POST /api/appointments/:id/confirm - Confirm appointment (public endpoint for customers)
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
router.post('/:id/send-reschedule-email', async (req: Request, res: Response) => {
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

export default router;

