import { Router, Request, Response } from 'express';
import { and, eq, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { 
  appointmentReminders, 
  appointments,
  emailContacts,
  createAppointmentReminderSchema,
} from '@shared/schema';
import { authenticateToken } from '../middleware/auth-middleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/appointment-reminders - List reminders
router.get('/', async (req: Request, res: Response) => {
  try {
    const { appointmentId, status, dateFrom, dateTo } = req.query;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Build where conditions
    const conditions = [eq(appointmentReminders.tenantId, tenantId)];

    if (appointmentId) {
      conditions.push(eq(appointmentReminders.appointmentId, appointmentId as string));
    }

    if (status && status !== 'all') {
      conditions.push(eq(appointmentReminders.status, status as string));
    }

    if (dateFrom) {
      conditions.push(gte(appointmentReminders.scheduledFor, new Date(dateFrom as string)));
    }

    if (dateTo) {
      conditions.push(lte(appointmentReminders.scheduledFor, new Date(dateTo as string)));
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
      .orderBy(desc(appointmentReminders.scheduledFor));

    res.json({ 
      reminders: remindersList,
      total: remindersList.length 
    });
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/appointment-reminders - Create reminder
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Validate request body
    const validatedData = createAppointmentReminderSchema.parse(req.body);

    // Verify appointment belongs to this tenant
    const appointment = await db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
      })
      .from(appointments)
      .where(and(
        eq(appointments.id, validatedData.appointmentId),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(400).json({ error: 'Appointment not found or does not belong to your organization' });
    }

    // Create reminder
    const newReminder = await db
      .insert(appointmentReminders)
      .values({
        tenantId,
        customerId: appointment[0].customerId,
        ...validatedData,
      })
      .returning();

    res.status(201).json({ 
      reminder: newReminder[0],
      message: 'Reminder created successfully' 
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
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { appointmentIds, reminderType = 'email' } = req.body;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ error: 'appointmentIds array is required' });
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
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.tenantId, tenantId),
        // Only include appointments in the provided IDs
        ...appointmentIds.map(id => eq(appointments.id, id))
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

        const appointmentDateTime = new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const content = `Hi ${customerName},

This is a reminder about your upcoming appointment:

📅 ${appointment.title}
🕐 ${appointmentDateTime}
${appointment.location ? `📍 ${appointment.location}` : ''}
${appointment.duration ? `⏱️ Duration: ${appointment.duration} minutes` : ''}

Please confirm your attendance by clicking the link below:
${process.env.FRONTEND_URL || 'https://your-domain.com'}/confirm-appointment/${appointment.id}?token=${appointment.confirmationToken}

If you need to reschedule or have any questions, please contact us.

Best regards,
Your Team`;

        // Calculate when to send the reminder (24 hours before by default)
        const appointmentTime = new Date(appointment.appointmentDate);
        const reminderTime = new Date(appointmentTime.getTime() - (24 * 60 * 60 * 1000)); // 24 hours before

        // Create reminder record
        const newReminder = await db
          .insert(appointmentReminders)
          .values({
            tenantId,
            appointmentId: appointment.id,
            customerId: appointment.customerId,
            reminderType: reminderType as 'email' | 'sms' | 'push',
            reminderTiming: '24h',
            scheduledFor: reminderTime,
            status: 'sent', // Mark as sent immediately for now
            content,
            sentAt: new Date(),
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

        // TODO: Integrate with actual email/SMS service here
        // For now, we'll just log the reminder
        console.log(`📧 Reminder sent for appointment ${appointment.id}:`, {
          to: appointment.customer?.email,
          subject: `Reminder: ${appointment.title}`,
          content: content.substring(0, 100) + '...'
        });

      } catch (reminderError) {
        console.error(`Failed to send reminder for appointment ${appointment.id}:`, reminderError);
        errors.push({
          appointmentId: appointment.id,
          error: reminderError instanceof Error ? reminderError.message : 'Unknown error'
        });
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

// PUT /api/appointment-reminders/:id/status - Update reminder status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, errorMessage } = req.body;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    if (!['pending', 'sent', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if reminder exists and belongs to tenant
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

    res.json({ 
      reminder: updatedReminder[0],
      message: 'Reminder status updated successfully' 
    });
  } catch (error) {
    console.error('Failed to update reminder status:', error);
    res.status(500).json({ error: 'Failed to update reminder status' });
  }
});

export default router;
