import { Router, Request, Response } from 'express';
import { and, eq, desc, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  appointmentReminders,
  appointments,
  emailContacts,
  bouncedEmails,
  createAppointmentReminderSchema,
} from '@shared/schema';
import { authenticateToken, requireTenant, requirePermission } from '../middleware/auth-middleware';
import { authenticateInternalService, InternalServiceRequest } from '../middleware/internal-service-auth';
import { logActivity } from '../utils/activityLogger';
import { triggerSendReminder, triggerScheduleReminder, triggerBulkReminders, cancelReminderRun } from '../lib/trigger';
import type { ReminderPayload } from '../../src/trigger/reminders';

const router = Router();

// Helper function to check if an email is suppressed
const checkEmailSuppression = async (email: string): Promise<{ isSuppressed: boolean; reason?: string }> => {
  const emailLower = email.toLowerCase().trim();

  const suppression = await db.query.bouncedEmails.findFirst({
    where: and(
      eq(bouncedEmails.email, emailLower),
      eq(bouncedEmails.isActive, true)
    ),
  });

  if (suppression) {
    return {
      isSuppressed: true,
      reason: suppression.bounceReason || suppression.bounceType || 'Email is suppressed'
    };
  }

  return { isSuppressed: false };
};

// Internal endpoint for Trigger.dev webhook to update reminder status
// Secured with HMAC signature verification
router.put('/internal/:id/status', authenticateInternalService, async (req: InternalServiceRequest, res: Response) => {
  console.log('📧 [Internal Status] Received authenticated request:', {
    id: req.params.id,
    service: req.internalService?.service,
    body: req.body,
  });

  try {
    const { id } = req.params;

    // Validate ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid reminder ID format' });
    }

    const { status, errorMessage: rawErrorMessage } = req.body;
    // Cap errorMessage length to prevent abuse
    const errorMessage = typeof rawErrorMessage === 'string' ? rawErrorMessage.slice(0, 1000) : undefined;

    if (!['pending', 'sent', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify reminder exists
    const existingReminder = await db
      .select()
      .from(appointmentReminders)
      .where(eq(appointmentReminders.id, id))
      .limit(1);

    if (existingReminder.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Update reminder status
    const updatedReminder = await db
      .update(appointmentReminders)
      .set({
        status,
        errorMessage: status === 'failed' ? errorMessage : null,
        sentAt: status === 'sent' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(appointmentReminders.id, id))
      .returning();

    console.log(`📧 [Internal] Reminder ${id} status updated to: ${status}`);
    res.json({
      reminder: updatedReminder[0],
      message: 'Reminder status updated successfully'
    });
  } catch (error) {
    console.error('Failed to update reminder status (internal):', error);
    res.status(500).json({ error: 'Failed to update reminder status' });
  }
});

// Apply authentication and tenant isolation to all routes below this point
router.use(authenticateToken);
router.use(requireTenant);

// GET /api/appointment-reminders - List reminders
router.get('/', async (req: Request, res: Response) => {
  try {
    const { appointmentId, status, dateFrom, dateTo, page, limit: limitParam } = req.query;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Pagination defaults
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limitParam as string, 10) || 50));
    const offset = (pageNum - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(appointmentReminders.tenantId, tenantId)];

    if (appointmentId) {
      conditions.push(eq(appointmentReminders.appointmentId, appointmentId as string));
    }

    if (status && status !== 'all') {
      conditions.push(eq(appointmentReminders.status, status as string));
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom as string);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'Invalid dateFrom parameter' });
      }
      conditions.push(gte(appointmentReminders.scheduledFor, fromDate));
    }

    if (dateTo) {
      const toDate = new Date(dateTo as string);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ error: 'Invalid dateTo parameter' });
      }
      conditions.push(lte(appointmentReminders.scheduledFor, toDate));
    }

    // Fetch reminders with appointment details
    const remindersList = await db
      .select({
        id: appointmentReminders.id,
        appointmentId: appointmentReminders.appointmentId,
        customerId: appointmentReminders.customerId,
        reminderType: appointmentReminders.reminderType,
        reminderTiming: appointmentReminders.reminderTiming,
        scheduledFor: appointmentReminders.scheduledFor,
        sentAt: appointmentReminders.sentAt,
        status: appointmentReminders.status,
        content: appointmentReminders.content,
        errorMessage: appointmentReminders.errorMessage,
        customMinutesBefore: appointmentReminders.customMinutesBefore,
        metadata: appointmentReminders.metadata,
        createdAt: appointmentReminders.createdAt,
        updatedAt: appointmentReminders.updatedAt,
        // Appointment details
        appointment: {
          id: appointments.id,
          title: appointments.title,
          appointmentDate: appointments.appointmentDate,
        },
        // Customer details
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointmentReminders)
      .leftJoin(appointments, eq(appointmentReminders.appointmentId, appointments.id))
      .leftJoin(emailContacts, eq(appointmentReminders.customerId, emailContacts.id))
      .where(and(...conditions))
      .orderBy(desc(appointmentReminders.scheduledFor))
      .limit(pageSize)
      .offset(offset);

    res.json({
      reminders: remindersList,
      total: remindersList.length,
      page: pageNum,
      limit: pageSize,
    });
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/appointment-reminders - Create reminder
router.post('/', requirePermission('appointments.manage_reminders'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Validate request body
    const validatedData = createAppointmentReminderSchema.parse(req.body);

    // Verify appointment belongs to this tenant and get customer details
    const appointmentWithCustomer = await db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
        location: appointments.location,
        confirmationToken: appointments.confirmationToken,
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
        eq(appointments.id, validatedData.appointmentId),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointmentWithCustomer.length === 0) {
      return res.status(400).json({ error: 'Appointment not found or does not belong to your organization' });
    }

    const appointment = appointmentWithCustomer[0];
    const isSendNow = validatedData.reminderTiming === 'now';

    // For email reminders, check if the recipient is suppressed
    if (validatedData.reminderType === 'email' && appointment.customer?.email) {
      // Check local customer status
      const customerRecord = await db.query.emailContacts.findFirst({
        where: and(
          eq(emailContacts.id, appointment.customerId),
          eq(emailContacts.tenantId, tenantId)
        ),
      });

      if (customerRecord && (customerRecord.status === 'unsubscribed' || customerRecord.status === 'bounced')) {
        return res.status(400).json({
          error: `Cannot schedule email reminder: Customer is ${customerRecord.status}`,
          code: 'EMAIL_SUPPRESSED'
        });
      }

      // Check global suppression list
      const suppressionCheck = await checkEmailSuppression(appointment.customer.email);
      if (suppressionCheck.isSuppressed) {
        return res.status(400).json({
          error: `Cannot schedule email reminder: ${suppressionCheck.reason}`,
          code: 'EMAIL_SUPPRESSED'
        });
      }
    }

    // Create reminder
    const reminderData: any = {
      tenantId,
      customerId: appointment.customerId,
      appointmentId: validatedData.appointmentId,
      reminderType: validatedData.reminderType,
      reminderTiming: validatedData.reminderTiming,
      scheduledFor: validatedData.scheduledFor,
      timezone: validatedData.timezone || 'America/Chicago',
      content: validatedData.content,
      status: isSendNow ? 'sent' : 'pending',
      sentAt: isSendNow ? new Date() : null,
    };

    // Only add customMinutesBefore if it's provided (to handle cases where migration hasn't been applied yet)
    if (validatedData.customMinutesBefore !== undefined) {
      reminderData.customMinutesBefore = validatedData.customMinutesBefore;
    }

    const newReminder = await db
      .insert(appointmentReminders)
      .values(reminderData)
      .returning();

    // Prepare common payload data for Trigger.dev
    const appointmentDate = new Date(appointment.appointmentDate);
    const customerName = appointment.customer?.firstName
      ? `${appointment.customer.firstName} ${appointment.customer.lastName || ''}`.trim()
      : 'Valued Customer';

    const reminderPayload = {
      reminderId: newReminder[0].id,
      appointmentId: appointment.id,
      customerId: appointment.customerId,
      customerEmail: appointment.customer?.email,
      customerName,
      appointmentTitle: appointment.title,
      appointmentDate: appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: validatedData.timezone || 'America/Chicago',
      }),
      appointmentTime: appointmentDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: validatedData.timezone || 'America/Chicago',
      }),
      location: appointment.location || undefined,
      reminderType: validatedData.reminderType,
      content: validatedData.content || undefined,
      tenantId,
      timezone: validatedData.timezone || 'America/Chicago',
    };

    // Send to Trigger.dev - either immediately or scheduled
    if (appointment.customer?.email) {
      try {
        const triggerPayload: ReminderPayload = {
          ...reminderPayload,
          customerEmail: appointment.customer?.email || '',
          scheduledFor: isSendNow ? undefined : validatedData.scheduledFor.toISOString(),
          confirmationToken: appointment.confirmationToken || undefined,
        };

        let result;
        if (isSendNow) {
          // Send immediately via Trigger.dev
          console.log(`📧 [Trigger.dev] Sending immediate reminder:`, JSON.stringify(triggerPayload, null, 2));
          result = await triggerSendReminder(triggerPayload);
        } else {
          // Schedule for later via Trigger.dev
          console.log(`📅 [Trigger.dev] Scheduling reminder for ${validatedData.scheduledFor.toISOString()}:`, JSON.stringify(triggerPayload, null, 2));
          result = await triggerScheduleReminder(triggerPayload);
        }

        if (!result.success) {
          console.error(`Failed to ${isSendNow ? 'send' : 'schedule'} reminder via Trigger.dev:`, result.error);
          // Update reminder status to failed
          await db
            .update(appointmentReminders)
            .set({ status: 'failed', errorMessage: `Failed to ${isSendNow ? 'send' : 'schedule'} via Trigger.dev: ${result.error}`, updatedAt: new Date() })
            .where(eq(appointmentReminders.id, newReminder[0].id));
        } else {
          // Store the Trigger.dev run ID for potential cancellation later (using inngestEventId field for backwards compatibility)
          await db
            .update(appointmentReminders)
            .set({
              inngestEventId: result.runId || null,
              updatedAt: new Date()
            })
            .where(eq(appointmentReminders.id, newReminder[0].id));

          if (isSendNow) {
            console.log(`📧 Immediate reminder triggered for appointment ${appointment.id} to ${appointment.customer.email}, runId: ${result.runId}`);
          } else {
            console.log(`📅 Scheduled reminder for appointment ${appointment.id} at ${validatedData.scheduledFor.toISOString()} (${validatedData.timezone || 'America/Chicago'}), runId: ${result.runId}`);
          }
        }
      } catch (triggerError) {
        console.error('Error calling Trigger.dev for reminder:', triggerError);
        // Update reminder status to failed
        await db
          .update(appointmentReminders)
          .set({
            status: 'failed',
            errorMessage: triggerError instanceof Error ? triggerError.message : 'Unknown error'
          })
          .where(eq(appointmentReminders.id, newReminder[0].id));
      }
    }

    // Log activity for reminder creation
    try {
      await logActivity({
        tenantId,
        userId: user.id,
        entityType: 'appointment',
        entityId: validatedData.appointmentId,
        entityName: appointment.title,
        activityType: isSendNow ? 'sent' : 'scheduled',
        description: isSendNow
          ? `Sent reminder for appointment "${appointment.title}"`
          : `Scheduled reminder for appointment "${appointment.title}"`,
        metadata: {
          reminderId: newReminder[0].id,
          reminderType: validatedData.reminderType,
          reminderTiming: validatedData.reminderTiming,
          scheduledFor: validatedData.scheduledFor,
          customerEmail: appointment.customer?.email,
          customerName,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log reminder creation:', error);
    }

    res.status(201).json({
      reminder: newReminder[0],
      message: isSendNow ? 'Reminder sent immediately' : 'Reminder scheduled successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Failed to create reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// POST /api/appointment-reminders/send - Send reminders for appointments
router.post('/send', requirePermission('appointments.manage_reminders'), async (req: Request, res: Response) => {
  try {
    const { appointmentIds, reminderType = 'email' } = req.body;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ error: 'appointmentIds array is required' });
    }

    // Validate array bounds and UUID format
    if (appointmentIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 appointment IDs allowed per request' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const invalidIds = appointmentIds.filter((id: any) => typeof id !== 'string' || !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: 'All appointmentIds must be valid UUIDs' });
    }

    // Validate reminderType
    const validReminderTypes = ['email', 'sms', 'push'];
    if (!validReminderTypes.includes(reminderType)) {
      return res.status(400).json({ error: 'Invalid reminderType. Must be one of: email, sms, push' });
    }

    // Fetch appointments with customer details
    const appointmentsList = await db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        title: appointments.title,
        description: appointments.description,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        serviceType: appointments.serviceType,
        reminderSent: appointments.reminderSent,
        confirmationToken: appointments.confirmationToken,
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          status: emailContacts.status,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.tenantId, tenantId),
        inArray(appointments.id, appointmentIds)
      ));

    if (appointmentsList.length === 0) {
      return res.status(400).json({ error: 'No valid appointments found' });
    }

    const remindersCreated = [];
    const errors = [];

    for (const appointment of appointmentsList) {
      try {
        // Generate reminder content
        const customerName = appointment.customer?.firstName
          ? `${appointment.customer.firstName} ${appointment.customer?.lastName || ''}`.trim()
          : appointment.customer?.email || 'Valued Customer';

        // Skip appointments with no customer
        if (!appointment.customerId) {
          errors.push({
            appointmentId: appointment.id,
            error: 'No customer assigned to this appointment'
          });
          continue;
        }

        // For email reminders, check if the recipient is suppressed
        if (reminderType === 'email' && appointment.customer?.email) {
          // Check local customer status first
          const customerStatus = appointment.customer?.status;
          if (customerStatus === 'unsubscribed' || customerStatus === 'bounced') {
            errors.push({
              appointmentId: appointment.id,
              error: `Customer is ${customerStatus}`
            });
            continue;
          }

          // Check global suppression list
          const suppressionCheck = await checkEmailSuppression(appointment.customer.email);
          if (suppressionCheck.isSuppressed) {
            errors.push({
              appointmentId: appointment.id,
              error: `Email suppressed: ${suppressionCheck.reason}`
            });
            continue;
          }
        }

        // Calculate when to send the reminder based on reminder timing
        const appointmentTime = new Date(appointment.appointmentDate);

        // Default to 1 hour before if no specific timing provided
        // TODO: This could be made configurable per appointment or tenant setting
        const reminderTiming = '1h' as const;
        const timingMinutes: Record<typeof reminderTiming | '5m' | '30m' | '5h' | '10h', number> = {
          '5m': 5,
          '30m': 30,
          '1h': 60,
          '5h': 300,
          '10h': 600,
        };
        const minutesBefore = timingMinutes[reminderTiming] || 60;
        const reminderTime = new Date(appointmentTime.getTime() - (minutesBefore * 60 * 1000));

        // Create reminder record with 'pending' status until Trigger.dev confirms delivery
        const newReminder = await db
          .insert(appointmentReminders)
          .values({
            tenantId,
            appointmentId: appointment.id,
            customerId: appointment.customerId,
            reminderType: reminderType as 'email' | 'sms' | 'push',
            reminderTiming: reminderTiming,
            scheduledFor: reminderTime,
            status: 'pending',
          })
          .returning();

        // Update appointment to mark reminder as sent
        await db
          .update(appointments)
          .set({
            reminderSent: true,
            reminderSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(appointments.id, appointment.id));

        remindersCreated.push(newReminder[0]);

      } catch (reminderError) {
        console.error(`Failed to send reminder for appointment ${appointment.id}:`, reminderError);
        errors.push({
          appointmentId: appointment.id,
          error: reminderError instanceof Error ? reminderError.message : 'Unknown error'
        });
      }
    }

    // Send all created reminders via Trigger.dev bulk send
    if (remindersCreated.length > 0) {
      const reminderPayloads = remindersCreated
        .map(reminder => {
          const matchingAppt = appointmentsList.find(a => a.id === reminder.appointmentId);
          if (!matchingAppt || !matchingAppt.customer?.email) return null;

          const appointmentDate = new Date(matchingAppt.appointmentDate);
          const cName = matchingAppt.customer?.firstName
            ? `${matchingAppt.customer.firstName} ${matchingAppt.customer?.lastName || ''}`.trim()
            : matchingAppt.customer?.email || 'Valued Customer';

          return {
            reminderId: reminder.id,
            appointmentId: matchingAppt.id,
            customerId: matchingAppt.customerId!,
            customerEmail: matchingAppt.customer.email,
            customerName: cName,
            appointmentTitle: matchingAppt.title,
            appointmentDate: appointmentDate.toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            }),
            appointmentTime: appointmentDate.toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', hour12: true,
            }),
            location: matchingAppt.location || undefined,
            reminderType: reminderType as 'email' | 'sms' | 'push',
            content: reminder.content || undefined,
            tenantId,
            confirmationToken: matchingAppt.confirmationToken || undefined,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (reminderPayloads.length > 0) {
        try {
          const bulkResult = await triggerBulkReminders(reminderPayloads as ReminderPayload[]);
          if (bulkResult.success) {
            console.log(`📧 [Trigger.dev] Bulk reminders triggered, runId: ${bulkResult.runId}`);
          } else {
            console.error(`📧 [Trigger.dev] Bulk reminders failed: ${bulkResult.error}`);
            // Mark all as failed
            for (const reminder of remindersCreated) {
              await db
                .update(appointmentReminders)
                .set({ status: 'failed', errorMessage: `Trigger.dev bulk send failed: ${bulkResult.error}`, updatedAt: new Date() })
                .where(eq(appointmentReminders.id, reminder.id));
            }
          }
        } catch (triggerError) {
          console.error('📧 [Trigger.dev] Error triggering bulk reminders:', triggerError);
          for (const reminder of remindersCreated) {
            await db
              .update(appointmentReminders)
              .set({ status: 'failed', errorMessage: triggerError instanceof Error ? triggerError.message : 'Unknown error', updatedAt: new Date() })
              .where(eq(appointmentReminders.id, reminder.id));
          }
        }
      }
    }

    res.json({
      message: `Processed ${appointmentsList.length} appointments`,
      remindersCreated: remindersCreated.length,
      errors: errors.length,
      details: {
        successful: remindersCreated.map(r => r.id),
        failed: errors
      }
    });

  } catch (error) {
    console.error('Failed to send reminders:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

// PUT /api/appointment-reminders/:id/reschedule - Reschedule a pending reminder
router.put('/:id/reschedule', requirePermission('appointments.manage_reminders'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduledFor, timezone } = req.body;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    if (!scheduledFor) {
      return res.status(400).json({ error: 'scheduledFor is required' });
    }

    const newScheduledTime = new Date(scheduledFor);
    if (isNaN(newScheduledTime.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledFor date' });
    }

    // Reject past dates
    const now = new Date();
    now.setSeconds(0, 0);
    if (newScheduledTime <= now) {
      return res.status(400).json({ error: 'Reminder scheduled time must be in the future' });
    }

    // Verify reminder exists and belongs to tenant
    const existingReminder = await db
      .select()
      .from(appointmentReminders)
      .where(and(
        eq(appointmentReminders.id, id),
        eq(appointmentReminders.tenantId, tenantId)
      ))
      .limit(1);

    if (existingReminder.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const reminder = existingReminder[0];

    // Only allow rescheduling pending reminders
    if (reminder.status !== 'pending') {
      return res.status(400).json({
        error: 'Can only reschedule pending reminders',
        currentStatus: reminder.status
      });
    }

    // Cancel the existing Trigger.dev run if it exists
    let oldRunCancelled = false;
    if (reminder.inngestEventId && reminder.inngestEventId.startsWith('run_')) {
      try {
        const cancelResult = await cancelReminderRun(reminder.inngestEventId);
        if (cancelResult.success) {
          console.log(`🔄 [Reschedule] Cancelled old Trigger.dev run ${reminder.inngestEventId}`);
          oldRunCancelled = true;
        } else {
          console.warn(`🔄 [Reschedule] Failed to cancel old run: ${cancelResult.error}`);
        }
      } catch (cancelError) {
        console.warn(`🔄 [Reschedule] Error cancelling old run:`, cancelError);
      }
    }

    // Get appointment details for the new trigger payload
    const appointmentWithCustomer = await db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
        location: appointments.location,
        confirmationToken: appointments.confirmationToken,
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(eq(appointments.id, reminder.appointmentId))
      .limit(1);

    if (appointmentWithCustomer.length === 0) {
      return res.status(400).json({ error: 'Associated appointment not found' });
    }

    const appointment = appointmentWithCustomer[0];
    const reminderTimezone = timezone || reminder.timezone || 'America/Chicago';

    // Create new Trigger.dev run with updated schedule
    let newRunId: string | null = null;
    if (appointment.customer?.email) {
      const appointmentDate = new Date(appointment.appointmentDate);
      const customerName = appointment.customer?.firstName
        ? `${appointment.customer.firstName} ${appointment.customer.lastName || ''}`.trim()
        : 'Valued Customer';

      const triggerPayload: ReminderPayload = {
        reminderId: reminder.id,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        customerEmail: appointment.customer.email,
        customerName,
        appointmentTitle: appointment.title,
        appointmentDate: appointmentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: reminderTimezone,
        }),
        appointmentTime: appointmentDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: reminderTimezone,
        }),
        location: appointment.location || undefined,
        reminderType: reminder.reminderType as 'email' | 'sms' | 'push',
        content: reminder.content || undefined,
        tenantId,
        timezone: reminderTimezone,
        scheduledFor: newScheduledTime.toISOString(),
        confirmationToken: appointment.confirmationToken || undefined,
      };

      try {
        console.log(`🔄 [Reschedule] Creating new Trigger.dev run for ${newScheduledTime.toISOString()}`);
        const result = await triggerScheduleReminder(triggerPayload);

        if (result.success) {
          newRunId = result.runId || null;
          console.log(`🔄 [Reschedule] New run created: ${newRunId}`);
        } else {
          console.error(`🔄 [Reschedule] Failed to create new run: ${result.error}`);
        }
      } catch (triggerError) {
        console.error('🔄 [Reschedule] Error creating new Trigger.dev run:', triggerError);
      }
    }

    // Update reminder in database
    const updatedReminder = await db
      .update(appointmentReminders)
      .set({
        scheduledFor: newScheduledTime,
        timezone: reminderTimezone,
        inngestEventId: newRunId,
        updatedAt: new Date(),
      })
      .where(eq(appointmentReminders.id, id))
      .returning();

    console.log(`🔄 [Reschedule] Reminder ${id} rescheduled from ${reminder.scheduledFor} to ${newScheduledTime.toISOString()}`);

    res.json({
      reminder: updatedReminder[0],
      message: 'Reminder rescheduled successfully',
      oldRunCancelled,
      newRunId,
    });
  } catch (error) {
    console.error('Failed to reschedule reminder:', error);
    res.status(500).json({ error: 'Failed to reschedule reminder' });
  }
});

// PUT /api/appointment-reminders/:id/status - Update reminder status
// Security: Requires authenticated user with tenant ownership (internal services must use /internal/:id/status with HMAC)
router.put('/:id/status', requirePermission('appointments.manage_reminders'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, errorMessage: rawErrorMessage } = req.body;
    const user = (req as any).user;
    const tenantId = user.tenantId;
    // Cap errorMessage length to prevent abuse
    const errorMessage = typeof rawErrorMessage === 'string' ? rawErrorMessage.slice(0, 1000) : undefined;

    if (!['pending', 'sent', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Always verify tenant ownership - internal services must use the HMAC-secured /internal/:id/status endpoint
    const existingReminder = await db
      .select()
      .from(appointmentReminders)
      .where(and(
        eq(appointmentReminders.id, id),
        eq(appointmentReminders.tenantId, tenantId)
      ))
      .limit(1);

    if (existingReminder.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const reminder = existingReminder[0];

    // If cancelling a pending reminder, also cancel the Trigger.dev run
    let triggerCancelled = false;
    if (status === 'cancelled' && reminder.status === 'pending' && reminder.inngestEventId) {
      try {
        const cancelResult = await cancelReminderRun(reminder.inngestEventId);
        if (cancelResult.success) {
          console.log(`🚫 [Reminder] Cancelled Trigger.dev run ${reminder.inngestEventId} for reminder ${id}`);
          triggerCancelled = true;
        } else {
          console.warn(`🚫 [Reminder] Failed to cancel Trigger.dev run ${reminder.inngestEventId}: ${cancelResult.error}`);
        }
      } catch (cancelError) {
        console.warn(`🚫 [Reminder] Error cancelling Trigger.dev run:`, cancelError);
      }
    }

    // Update reminder status - preserve sentAt if already set
    const updatedReminder = await db
      .update(appointmentReminders)
      .set({
        status,
        errorMessage: status === 'failed' ? errorMessage : null,
        sentAt: status === 'sent' ? new Date() : reminder.sentAt,
        updatedAt: new Date(),
      })
      .where(eq(appointmentReminders.id, id))
      .returning();

    res.json({
      reminder: updatedReminder[0],
      message: 'Reminder status updated successfully',
      triggerCancelled,
    });
  } catch (error) {
    console.error('Failed to update reminder status:', error);
    res.status(500).json({ error: 'Failed to update reminder status' });
  }
});

export default router;
