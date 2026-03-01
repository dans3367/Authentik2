import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { forms, formResponses, masterEmailDesign, companies } from '@shared/schema';
import { authenticateToken, requireRole, requireTenant } from '../middleware/auth-middleware';
import { sanitizeString } from '../utils/sanitization';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

export const formsRoutes = Router();

// ─── Constants ───────────────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_CATEGORIES = ['intake', 'survey', 'email-signup'] as const;
const MAX_PAGE_LIMIT = 100;
const MAX_RESPONSE_DATA_BYTES = 512 * 1024; // 512 KB per submission
const MIN_SUBMIT_TIME_MS = 2000; // Minimum 2 seconds between form load and submit

// ─── Rate limiter for public submission endpoint ──────────────────────────────
const publicSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 3,
  message: { message: 'Too many form submissions from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Zod schema for public form submission (includes bot protection fields) ──
const publicSubmitSchema = z.object({
  data: z.record(z.unknown()).refine(
    (val) => JSON.stringify(val).length <= MAX_RESPONSE_DATA_BYTES,
    { message: `Response data must not exceed ${MAX_RESPONSE_DATA_BYTES / 1024} KB` }
  ),
  _hp_email: z.string().optional(), // Honeypot field — must be empty
  _ft: z.number().optional(), // Form load timestamp for timing check
});

// ─── Middleware: validate :id is a UUID ───────────────────────────────────────
function validateUuidParam(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ message: 'Invalid form ID format' });
  }
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parsePagination(page: unknown, limit: unknown) {
  const p = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const l = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(String(limit ?? 50), 10) || 50));
  return { page: p, limit: l, offset: (p - 1) * l };
}

function sanitizeFormData(formData: unknown): string | null {
  if (!formData) return null;
  // Ensure it is valid JSON; reject if not
  try {
    const parsed = typeof formData === 'string' ? JSON.parse(formData) : formData;
    // Recursively sanitize all string leaf values
    const sanitize = (obj: unknown): unknown => {
      if (typeof obj === 'string') return sanitizeString(obj) ?? '';
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)])
        );
      }
      return obj;
    };
    return JSON.stringify(sanitize(parsed));
  } catch {
    return null;
  }
}

function sanitizeTheme(theme: unknown): string | null {
  if (!theme) return null;
  try {
    const parsed = typeof theme === 'string' ? JSON.parse(theme) : theme;
    if (typeof parsed !== 'object' || parsed === null) return null;
    // Only keep safe known keys
    const safe: Record<string, unknown> = {};
    if (typeof parsed.id === 'string') safe.id = sanitizeString(parsed.id) ?? '';
    if (typeof parsed.name === 'string') safe.name = sanitizeString(parsed.name) ?? '';
    if (parsed.customColors !== undefined) safe.customColors = parsed.customColors;
    return JSON.stringify(safe);
  } catch {
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Get all forms for the user's company
formsRoutes.get("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page: rawPage, limit: rawLimit, search, published, category } = req.query;
    const { page, limit, offset } = parsePagination(rawPage, rawLimit);

    let whereClause = sql`${forms.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${forms.title} ILIKE ${`%${sanitizedSearch}%`} OR
        ${forms.description} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (published !== undefined) {
      whereClause = sql`${whereClause} AND ${forms.isActive} = ${published === 'true'}`;
    }

    if (category) {
      const sanitizedCategory = sanitizeString(category as string);
      whereClause = sql`${whereClause} AND ${forms.category} = ${sanitizedCategory}`;
    }

    const formsList = await db.query.forms.findMany({
      where: whereClause,
      orderBy: sql`${forms.updatedAt} DESC`,
      limit,
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(forms).where(whereClause);

    res.json({
      forms: formsList,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / limit),
      },
    });
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ message: 'Failed to get forms' });
  }
});

// Get specific form
formsRoutes.get("/:id", authenticateToken, requireTenant, validateUuidParam, async (req: any, res) => {
  try {
    const { id } = req.params;

    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json(form);
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ message: 'Failed to get form' });
  }
});

// Create new form
formsRoutes.post("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { title, description, formData, theme, category } = req.body;

    if (!title || !formData) {
      return res.status(400).json({ message: 'Title and formData are required' });
    }

    // Validate category against allowed values
    const safeCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'intake';

    const sanitizedTitle = sanitizeString(title) ?? title.trim();
    const sanitizedDescription = description ? sanitizeString(description) : null;
    const sanitizedFormData = sanitizeFormData(formData);
    const sanitizedTheme = sanitizeTheme(theme);

    if (!sanitizedFormData) {
      return res.status(400).json({ message: 'Invalid formData: must be valid JSON' });
    }

    const newForm = await db.insert(forms).values({
      title: sanitizedTitle,
      description: sanitizedDescription,
      category: safeCategory,
      formData: sanitizedFormData,
      theme: sanitizedTheme || 'modern',
      tenantId: req.user.tenantId,
      userId: req.user.id,
      isActive: true,
    }).returning();

    res.status(201).json(newForm[0]);
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ message: 'Failed to create form' });
  }
});

// Update form
formsRoutes.put("/:id", authenticateToken, requireTenant, validateUuidParam, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { title, description, formData, schema, settings, theme, published, category } = req.body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) {
      updateData.title = sanitizeString(title);
    }

    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : null;
    }

    if (formData !== undefined) {
      const sanitizedFormData = sanitizeFormData(formData);
      if (!sanitizedFormData) {
        return res.status(400).json({ message: 'Invalid formData: must be valid JSON' });
      }
      updateData.formData = sanitizedFormData;
    }

    if (schema !== undefined) {
      updateData.schema = JSON.stringify(schema);
    }

    if (settings !== undefined) {
      updateData.settings = settings ? JSON.stringify(settings) : null;
    }

    if (theme !== undefined) {
      updateData.theme = sanitizeTheme(theme);
    }

    if (published !== undefined) {
      updateData.published = published;
    }

    if (category !== undefined) {
      updateData.category = ALLOWED_CATEGORIES.includes(category) ? category : undefined;
    }

    // Include tenantId in WHERE to prevent TOCTOU cross-tenant update
    const updatedForm = await db.update(forms)
      .set(updateData)
      .where(sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`)
      .returning();

    if (updatedForm.length === 0) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json(updatedForm[0]);
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ message: 'Failed to update form' });
  }
});

// Delete form
formsRoutes.delete("/:id", authenticateToken, requireTenant, validateUuidParam, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Include tenantId in WHERE to prevent TOCTOU cross-tenant delete
    const deleted = await db.delete(forms)
      .where(sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`)
      .returning({ id: forms.id });

    if (deleted.length === 0) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ message: 'Failed to delete form' });
  }
});

// Get form responses
formsRoutes.get("/:id/responses", authenticateToken, requireTenant, validateUuidParam, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { page: rawPage, limit: rawLimit } = req.query;
    const { page, limit, offset } = parsePagination(rawPage, rawLimit);

    // Check if form exists and belongs to user's company
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const responses = await db.query.formResponses.findMany({
      where: sql`${formResponses.formId} = ${id}`,
      orderBy: sql`${formResponses.submittedAt} DESC`,
      limit,
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(formResponses).where(sql`${formResponses.formId} = ${id}`);

    res.json({
      responses,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / limit),
      },
    });
  } catch (error) {
    console.error('Get form responses error:', error);
    res.status(500).json({ message: 'Failed to get form responses' });
  }
});

// Get form statistics
formsRoutes.get("/:id/stats", authenticateToken, requireTenant, validateUuidParam, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if form exists and belongs to user's company
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const stats = await db.select({
      totalResponses: sql<number>`count(*)`,
      responsesToday: sql<number>`count(*) filter (where submitted_at >= current_date)`,
      responsesThisWeek: sql<number>`count(*) filter (where submitted_at >= current_date - interval '7 days')`,
      responsesThisMonth: sql<number>`count(*) filter (where submitted_at >= current_date - interval '30 days')`,
    }).from(formResponses).where(sql`${formResponses.formId} = ${id}`);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get form stats error:', error);
    res.status(500).json({ message: 'Failed to get form statistics' });
  }
});

// Public form access (no authentication required)
formsRoutes.get("/public/:id", validateUuidParam, async (req: any, res) => {
  try {
    const { id } = req.params;

    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.isActive} = true`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found or not active' });
    }

    // Fetch company logo from email design settings and company name
    let logoUrl: string | null = null;
    let companyName: string | null = null;

    try {
      const emailDesign = await db.query.masterEmailDesign.findFirst({
        where: eq(masterEmailDesign.tenantId, form.tenantId),
      });

      if (emailDesign?.logoUrl) {
        logoUrl = emailDesign.logoUrl;
      }

      // Use companyName from email design first, then fall back to companies table
      if (emailDesign?.companyName) {
        companyName = emailDesign.companyName;
      } else {
        const company = await db.query.companies.findFirst({
          where: eq(companies.tenantId, form.tenantId),
        });
        if (company?.name) {
          companyName = company.name;
        }
      }
    } catch (e) {
      // Non-critical: proceed without logo/company name
    }

    // Return only the necessary data for public access
    res.json({
      id: form.id,
      title: form.title,
      description: form.description,
      category: form.category,
      formData: form.formData ? JSON.parse(form.formData) : null,
      theme: form.theme || 'modern',
      logoUrl,
      companyName,
    });
  } catch (error) {
    console.error('Get public form error:', error);
    res.status(500).json({ message: 'Failed to get form' });
  }
});

// Submit form response (public endpoint)
formsRoutes.post("/public/:id/submit", publicSubmitLimiter, validateUuidParam, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Validate and bound the request body with Zod
    const parsed = publicSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid submission data', details: parsed.error.errors });
    }

    const { data, _hp_email, _ft } = parsed.data;

    // ─── Bot Protection ────────────────────────────────────────────────
    // 1. Honeypot check: if the hidden field has a value, it's a bot
    if (_hp_email && _hp_email.length > 0) {
      console.warn(`[Bot Protection] Honeypot triggered for form ${id} from IP ${req.ip}`);
      return res.status(201).json({
        message: 'Form submitted successfully',
        responseId: 'blocked',
      });
    }

    // 2. Timing check: reject submissions that happen too fast
    if (_ft) {
      const elapsed = Date.now() - _ft;
      if (elapsed < MIN_SUBMIT_TIME_MS) {
        console.warn(`[Bot Protection] Timing check failed for form ${id} from IP ${req.ip} (${elapsed}ms)`);
        return res.status(201).json({
          message: 'Form submitted successfully',
          responseId: 'blocked',
        });
      }
    }

    // Check if form exists and is active
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.isActive} = true`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found or not active' });
    }

    // Create form response
    const newResponse = await db.insert(formResponses).values({
      tenantId: form.tenantId,
      formId: id,
      responseData: JSON.stringify(data),
      submittedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    }).returning();

    // Update response count
    await db.update(forms)
      .set({
        responseCount: sql`${forms.responseCount} + 1`,
        updatedAt: new Date()
      })
      .where(sql`${forms.id} = ${id}`);

    res.status(201).json({
      message: 'Form submitted successfully',
      responseId: newResponse[0].id,
    });
  } catch (error) {
    console.error('Submit form error:', error);
    res.status(500).json({ message: 'Failed to submit form' });
  }
});

// Serve form embed script
formsRoutes.get("/js/authentik-forms.js", (req: any, res) => {
  const script = `
    (function() {
      // Authentik Forms Embed Script
      console.log('Authentik Forms script loaded');
    })();
  `;
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

// Form embed example page
formsRoutes.get("/embed-example", (req: any, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Form Embed Example</title>
    </head>
    <body>
      <h1>Form Embed Example</h1>
      <p>This is an example of how to embed forms.</p>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Simple form example page
formsRoutes.get("/simple-example", (req: any, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Simple Form Example</title>
    </head>
    <body>
      <h1>Simple Form Example</h1>
      <p>This is a simple form example.</p>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});