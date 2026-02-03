import express from 'express';
import { db } from '../database.js';
import { forms, formResponses } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Schema for form response submission
const formResponseSchema = z.object({
  responseData: z.record(z.any())
});

// GET /api/forms/:id - Get a specific form by UUID
router.get('/:id', async (req, res) => {
  try {
    const formId = req.params.id;

    if (!formId) {
      return res.status(400).json({ error: 'Form ID is required' });
    }

    // Get form data, only if it's active
    const form = await db.select({
      id: forms.id,
      title: forms.title,
      description: forms.description,
      formData: forms.formData,
      theme: forms.theme
    })
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.isActive, true)))
      .limit(1);

    if (form.length === 0) {
      return res.status(404).json({ error: 'Form not found or inactive' });
    }

    const formRecord = form[0];

    // Parse the form data JSON
    let parsedFormData;
    try {
      parsedFormData = JSON.parse(formRecord.formData);
    } catch (error) {
      return res.status(500).json({ error: 'Invalid form data format' });
    }

    res.json({
      id: formRecord.id,
      title: formRecord.title,
      description: formRecord.description,
      formData: parsedFormData,
      theme: formRecord.theme || 'modern'
    });

  } catch (error) {
    console.error('Error fetching form:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// POST /api/forms/:id/submit - Submit a form response
router.post('/:id/submit', async (req, res) => {
  try {
    const formId = req.params.id;

    if (!formId) {
      return res.status(400).json({ error: 'Form ID is required' });
    }

    // Validate request body
    const validation = formResponseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors
      });
    }

    const { responseData } = validation.data;

    // Verify the form exists and is active
    const form = await db.select({
      id: forms.id,
      tenantId: forms.tenantId
    })
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.isActive, true)))
      .limit(1);

    if (form.length === 0) {
      return res.status(404).json({ error: 'Form not found or inactive' });
    }

    const formRecord = form[0];

    // Get client IP and user agent for tracking
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Insert form response
    const newResponse = await db.insert(formResponses).values({
      tenantId: formRecord.tenantId,
      formId: formId,
      responseData: JSON.stringify(responseData),
      ipAddress: clientIp,
      userAgent: userAgent
    }).returning({ id: formResponses.id });

    // Update response count
    await db.update(forms)
      .set({
        responseCount: sql`${forms.responseCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(forms.id, formId));

    res.status(201).json({
      success: true,
      responseId: newResponse[0].id,
      message: 'Form response submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting form response:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to submit form response' });
  }
});

export { router as formRouter };