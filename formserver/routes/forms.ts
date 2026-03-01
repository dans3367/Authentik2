import express, { Request, Response, NextFunction } from 'express';
import { db } from '../database.js';
import { forms, formResponses } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_DATA_BYTES = 512 * 1024; // 512 KB
const MIN_SUBMIT_TIME_MS = 2000; // Minimum 2 seconds between form load and submit

// ─── Rate limiter for form submissions ───────────────────────────────────────
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 3, // limit each IP to 3 submissions per window
  message: { error: 'Too many form submissions from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Middleware: validate :id is a UUID ───────────────────────────────────────
function validateUuidParam(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Invalid form ID format' });
  }
  next();
}

// Schema for form response submission (includes bot protection fields)
const formResponseSchema = z.object({
  responseData: z.record(z.unknown()).refine(
    (val) => JSON.stringify(val).length <= MAX_RESPONSE_DATA_BYTES,
    { message: `Response data must not exceed ${MAX_RESPONSE_DATA_BYTES / 1024} KB` }
  ),
  _hp_email: z.string().optional(), // Honeypot field — must be empty
  _ft: z.number().optional(), // Form load timestamp for timing check
});

// GET /api/forms/:id - Get a specific form by UUID
router.get('/:id', validateUuidParam, async (req, res) => {
  try {
    const formId = req.params.id;

    // Get form data, only if it's active
    const form = await db.select({
      id: forms.id,
      title: forms.title,
      description: forms.description,
      category: forms.category,
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
      category: formRecord.category || 'intake',
      formData: parsedFormData,
      theme: formRecord.theme || 'modern'
    });

  } catch (error) {
    console.error('Error fetching form:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// POST /api/forms/:id/submit - Submit a form response
router.post('/:id/submit', submitLimiter, validateUuidParam, async (req, res) => {
  try {
    const formId = req.params.id;

    // Validate request body
    const validation = formResponseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors
      });
    }

    const { responseData, _hp_email, _ft } = validation.data;

    // ─── Bot Protection ────────────────────────────────────────────────
    // 1. Honeypot check: if the hidden field has a value, it's a bot
    if (_hp_email && _hp_email.length > 0) {
      // Silently accept to not reveal detection to bots
      console.warn(`[Bot Protection] Honeypot triggered for form ${formId} from IP ${req.ip}`);
      return res.status(201).json({
        success: true,
        responseId: 'blocked',
        message: 'Form response submitted successfully'
      });
    }

    // 2. Timing check: reject submissions that happen too fast
    if (_ft) {
      const elapsed = Date.now() - _ft;
      if (elapsed < MIN_SUBMIT_TIME_MS) {
        console.warn(`[Bot Protection] Timing check failed for form ${formId} from IP ${req.ip} (${elapsed}ms)`);
        return res.status(201).json({
          success: true,
          responseId: 'blocked',
          message: 'Form response submitted successfully'
        });
      }
    }

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