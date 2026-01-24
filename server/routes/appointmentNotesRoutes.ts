import { Router, Request, Response } from 'express';
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { 
  appointmentNotes,
  appointments,
  betterAuthUser,
  createAppointmentNoteSchema,
  updateAppointmentNoteSchema,
} from '@shared/schema';
import { authenticateToken } from '../middleware/auth-middleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/appointment-notes/:appointmentId - Get all notes for an appointment
router.get('/:appointmentId', async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Verify appointment belongs to tenant
    const appointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, appointmentId),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Fetch notes with user details
    const notes = await db
      .select({
        id: appointmentNotes.id,
        appointmentId: appointmentNotes.appointmentId,
        userId: appointmentNotes.userId,
        content: appointmentNotes.content,
        createdAt: appointmentNotes.createdAt,
        updatedAt: appointmentNotes.updatedAt,
        user: {
          id: betterAuthUser.id,
          name: betterAuthUser.name,
          firstName: betterAuthUser.firstName,
          lastName: betterAuthUser.lastName,
        }
      })
      .from(appointmentNotes)
      .leftJoin(betterAuthUser, eq(appointmentNotes.userId, betterAuthUser.id))
      .where(and(
        eq(appointmentNotes.appointmentId, appointmentId),
        eq(appointmentNotes.tenantId, tenantId)
      ))
      .orderBy(desc(appointmentNotes.createdAt));

    res.json({ notes });
  } catch (error) {
    console.error('Failed to fetch appointment notes:', error);
    res.status(500).json({ error: 'Failed to fetch appointment notes' });
  }
});

// POST /api/appointment-notes - Create a new note
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.tenantId;
    const userId = user.id;

    // Validate request body
    const validatedData = createAppointmentNoteSchema.parse(req.body);

    // Verify appointment belongs to tenant
    const appointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, validatedData.appointmentId),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Create note
    const newNote = await db
      .insert(appointmentNotes)
      .values({
        tenantId,
        userId,
        appointmentId: validatedData.appointmentId,
        content: validatedData.content,
      })
      .returning();

    // Fetch the note with user details
    const noteWithUser = await db
      .select({
        id: appointmentNotes.id,
        appointmentId: appointmentNotes.appointmentId,
        userId: appointmentNotes.userId,
        content: appointmentNotes.content,
        createdAt: appointmentNotes.createdAt,
        updatedAt: appointmentNotes.updatedAt,
        user: {
          id: betterAuthUser.id,
          name: betterAuthUser.name,
          firstName: betterAuthUser.firstName,
          lastName: betterAuthUser.lastName,
        }
      })
      .from(appointmentNotes)
      .leftJoin(betterAuthUser, eq(appointmentNotes.userId, betterAuthUser.id))
      .where(eq(appointmentNotes.id, newNote[0].id))
      .limit(1);

    res.status(201).json({ 
      note: noteWithUser[0],
      message: 'Note created successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    console.error('Failed to create appointment note:', error);
    res.status(500).json({ error: 'Failed to create appointment note' });
  }
});

// PATCH /api/appointment-notes/:id - Update a note
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Validate request body
    const validatedData = updateAppointmentNoteSchema.parse(req.body);

    // Check if note exists and belongs to tenant
    const existingNote = await db
      .select()
      .from(appointmentNotes)
      .where(and(
        eq(appointmentNotes.id, id),
        eq(appointmentNotes.tenantId, tenantId)
      ))
      .limit(1);

    if (existingNote.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Update note
    const updatedNote = await db
      .update(appointmentNotes)
      .set({
        content: validatedData.content,
        updatedAt: new Date(),
      })
      .where(eq(appointmentNotes.id, id))
      .returning();

    // Fetch the note with user details
    const noteWithUser = await db
      .select({
        id: appointmentNotes.id,
        appointmentId: appointmentNotes.appointmentId,
        userId: appointmentNotes.userId,
        content: appointmentNotes.content,
        createdAt: appointmentNotes.createdAt,
        updatedAt: appointmentNotes.updatedAt,
        user: {
          id: betterAuthUser.id,
          name: betterAuthUser.name,
          firstName: betterAuthUser.firstName,
          lastName: betterAuthUser.lastName,
        }
      })
      .from(appointmentNotes)
      .leftJoin(betterAuthUser, eq(appointmentNotes.userId, betterAuthUser.id))
      .where(eq(appointmentNotes.id, updatedNote[0].id))
      .limit(1);

    res.json({ 
      note: noteWithUser[0],
      message: 'Note updated successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    console.error('Failed to update appointment note:', error);
    res.status(500).json({ error: 'Failed to update appointment note' });
  }
});

// DELETE /api/appointment-notes/:id - Delete a note
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Check if note exists and belongs to tenant
    const existingNote = await db
      .select()
      .from(appointmentNotes)
      .where(and(
        eq(appointmentNotes.id, id),
        eq(appointmentNotes.tenantId, tenantId)
      ))
      .limit(1);

    if (existingNote.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete note
    await db
      .delete(appointmentNotes)
      .where(eq(appointmentNotes.id, id));

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Failed to delete appointment note:', error);
    res.status(500).json({ error: 'Failed to delete appointment note' });
  }
});

export default router;
