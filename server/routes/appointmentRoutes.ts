import { Router, Request, Response } from 'express';
import { and, eq, desc, asc, like, gte, lte, isNull, isNotNull } from 'drizzle-orm';
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

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/appointments - List appointments with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, status, customerId, dateFrom, dateTo, serviceType } = req.query;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Build where conditions
    const conditions = [eq(appointments.tenantId, tenantId)];

    if (search) {
      conditions.push(like(appointments.title, `%${search}%`));
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
    const appointmentsList = await db
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
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(...conditions))
      .orderBy(desc(appointments.appointmentDate));

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
router.post('/', requireRole(['Owner', 'Administrator', 'Manager']), async (req: Request, res: Response) => {
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

// PUT /api/appointments/:id - Update appointment
router.put('/:id', requireRole(['Owner', 'Administrator', 'Manager']), async (req: Request, res: Response) => {
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

    // Update appointment
    const updatedAppointment = await db
      .update(appointments)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    res.json({ 
      appointment: updatedAppointment[0],
      message: 'Appointment updated successfully' 
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

export default router;
