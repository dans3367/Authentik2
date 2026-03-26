import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql, eq, and } from 'drizzle-orm';
import { forms, formResponses, masterEmailDesign, companies, emailContacts, promotions, unsubscribeTokens, templates } from '@shared/schema';
import crypto from 'crypto';
import { EmailService } from '../emailService';
import { authenticateToken, requireRole, requireTenant } from '../middleware/auth-middleware';
import { sanitizeString } from '../utils/sanitization';
import { wrapNewsletterContent } from '../utils/newsletterEmailWrapper';
import { replaceEmailPlaceholders } from '../utils/emailPlaceholders';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { verifyTurnstileToken } from '../utils/turnstile';
import { getDefaultShopId, resolveShopId } from '../utils/defaultShop';

export const formsRoutes = Router();

const emailService = new EmailService();

// ─── Helper: Fetch the company name for a tenant (used for placeholder replacement) ─
async function getCompanyName(tenantId: string): Promise<string> {
  try {
    const design = await db.query.masterEmailDesign.findFirst({
      where: eq(masterEmailDesign.tenantId, tenantId),
    });
    if (design?.companyName) return design.companyName;

    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, tenantId),
    });
    return company?.name || '';
  } catch {
    return '';
  }
}

// ─── Helper: Send promotion email after successful email signup ──────────────
async function sendPromotionEmailIfEnabled(
  form: any,
  recipientEmail: string,
  firstName?: string | null,
  lastName?: string | null,
) {
  try {
    // Parse form data to check for promotion settings
    let formData: any;
    try {
      formData = typeof form.formData === 'string' ? JSON.parse(form.formData) : form.formData;
    } catch {
      return; // Can't parse form data, skip
    }

    const settings = formData?.settings;
    if (!settings?.promotionEnabled || !settings?.promotionId) {
      return; // Promotion not enabled or no promotion selected
    }

    // Fetch the promotion
    const promotion = await db.query.promotions.findFirst({
      where: sql`${promotions.id} = ${settings.promotionId} AND ${promotions.tenantId} = ${form.tenantId} AND ${promotions.isActive} = true`,
    });

    if (!promotion) {
      console.warn(`[Promotion] Promotion ${settings.promotionId} not found or inactive for form ${form.id}`);
      return;
    }

    // Fetch company name for placeholder replacement
    const companyName = await getCompanyName(form.tenantId);
    const contactInfo = { firstName, lastName, email: recipientEmail };

    // Replace placeholders in promotion content before wrapping
    const resolvedContent = replaceEmailPlaceholders(promotion.content, contactInfo, companyName);
    const resolvedTitle = replaceEmailPlaceholders(promotion.title, contactInfo, companyName);

    // Wrap promotion content in the tenant's branded email design
    let wrappedContent = await wrapNewsletterContent(form.tenantId, resolvedContent);

    // Generate unsubscribe token for the contact
    let unsubscribeUrl: string | undefined;
    try {
      const contact = await db.query.emailContacts.findFirst({
        where: and(eq(emailContacts.tenantId, form.tenantId), eq(emailContacts.email, recipientEmail)),
        columns: { id: true },
      });
      if (contact) {
        let tokenRow = await db.query.unsubscribeTokens.findFirst({
          where: and(
            eq(unsubscribeTokens.tenantId, form.tenantId),
            eq(unsubscribeTokens.contactId, contact.id),
            sql`${unsubscribeTokens.usedAt} IS NULL`
          ),
        });
        if (!tokenRow) {
          const token = crypto.randomBytes(24).toString('base64url');
          const created = await db.insert(unsubscribeTokens).values({
            tenantId: form.tenantId,
            contactId: contact.id,
            token,
          }).returning();
          tokenRow = created[0];
        }
        if (tokenRow?.token) {
          const baseUrl = process.env.APP_URL || 'http://localhost:5002';
          unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(tokenRow.token)}&type=marketing`;
          // Inject unsubscribe footer before closing </div></body>
          const unsubscribeBlock = `<div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
              Don't want to receive these emails? <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
            </p>
          </div>`;
          wrappedContent = wrappedContent.replace(/(<\/div>\s*<\/body>)/i, `${unsubscribeBlock}$1`);
        }
      }
    } catch (tokenErr) {
      console.warn('[Promotion] Failed to generate unsubscribe token:', tokenErr);
    }

    // Send the promotion email
    await emailService.sendCustomEmail(
      recipientEmail,
      resolvedTitle,
      wrappedContent,
      {
        text: promotion.description ? replaceEmailPlaceholders(promotion.description, contactInfo, companyName) : undefined,
        headers: unsubscribeUrl ? {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : undefined,
      }
    );

    // Increment promotion usage count
    await db.update(promotions)
      .set({
        usageCount: sql`${promotions.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(promotions.id, promotion.id), eq(promotions.tenantId, form.tenantId)));

    console.log(`[Promotion] Sent promotion "${promotion.title}" to ${recipientEmail} for form ${form.id}`);
  } catch (error) {
    // Non-critical: log but don't fail the signup
    console.error('[Promotion] Failed to send promotion email:', error);
  }
}

// ─── Helper: Send template-based email on any form submission ────────────────
async function sendTemplateEmailIfEnabled(
  form: any,
  recipientEmail: string,
  firstName?: string | null,
  lastName?: string | null,
) {
  try {
    let formData: any;
    try {
      formData = typeof form.formData === 'string' ? JSON.parse(form.formData) : form.formData;
    } catch {
      return;
    }

    const settings = formData?.settings;
    if (!settings?.templateEmailEnabled || !settings?.templateId) return;

    // Fetch the template
    const template = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${settings.templateId} AND ${templates.tenantId} = ${form.tenantId} AND ${templates.isActive} = true`,
    });

    if (!template) {
      console.warn(`[TemplateEmail] Template ${settings.templateId} not found or inactive for form ${form.id}`);
      return;
    }

    // Fetch company name for placeholder replacement
    const companyName = await getCompanyName(form.tenantId);
    const contactInfo = { firstName, lastName, email: recipientEmail };

    // Replace all placeholders in body and subject line
    const resolvedBody = replaceEmailPlaceholders(template.body || '', contactInfo, companyName);
    const resolvedSubject = replaceEmailPlaceholders(template.subjectLine, contactInfo, companyName);

    // Wrap in the tenant's branded email design
    const wrappedBody = await wrapNewsletterContent(form.tenantId, resolvedBody);

    // Build unsubscribe link if the contact exists
    let unsubscribeUrl: string | undefined;
    try {
      const contact = await db.query.emailContacts.findFirst({
        where: and(eq(emailContacts.tenantId, form.tenantId), eq(emailContacts.email, recipientEmail)),
        columns: { id: true },
      });
      if (contact) {
        let tokenRow = await db.query.unsubscribeTokens.findFirst({
          where: and(
            eq(unsubscribeTokens.tenantId, form.tenantId),
            eq(unsubscribeTokens.contactId, contact.id),
            sql`${unsubscribeTokens.usedAt} IS NULL`,
          ),
        });
        if (!tokenRow) {
          const token = crypto.randomBytes(24).toString('base64url');
          const created = await db.insert(unsubscribeTokens).values({
            tenantId: form.tenantId,
            contactId: contact.id,
            token,
          }).returning();
          tokenRow = created[0];
        }
        if (tokenRow?.token) {
          const baseUrl = process.env.APP_URL || 'http://localhost:5002';
          unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(tokenRow.token)}&type=marketing`;
        }
      }
    } catch (tokenErr) {
      console.warn('[TemplateEmail] Failed to generate unsubscribe token:', tokenErr);
    }

    let finalBody = wrappedBody;
    if (unsubscribeUrl) {
      const footer = `<div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Don't want to receive these emails? <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a></p>
      </div>`;
      finalBody = finalBody.replace(/(<\/div>\s*<\/body>)/i, `${footer}$1`);
    }

    await emailService.sendCustomEmail(
      recipientEmail,
      resolvedSubject,
      finalBody,
      {
        text: template.preview ? replaceEmailPlaceholders(template.preview, contactInfo, companyName) : undefined,
        headers: unsubscribeUrl ? {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : undefined,
      },
    );

    // Increment template usage count
    await db.update(templates)
      .set({ usageCount: sql`${templates.usageCount} + 1`, lastUsed: new Date(), updatedAt: new Date() })
      .where(and(eq(templates.id, template.id), eq(templates.tenantId, form.tenantId)));

    console.log(`[TemplateEmail] Sent template "${template.name}" to ${recipientEmail} for form ${form.id}`);
  } catch (error) {
    console.error('[TemplateEmail] Failed to send template email:', error);
  }
}

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
  _turnstile_token: z.string().optional(), // Cloudflare Turnstile CAPTCHA token
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

    // Shop-level filtering when a specific shop is selected
    if (req.shopId) {
      whereClause = sql`${whereClause} AND ${forms.shopId} = ${req.shopId}`;
    }

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

    // Resolve shopId from header or tenant default
    const formShopId = await resolveShopId(req.shopId, req.user.tenantId);

    const newForm = await db.insert(forms).values({
      title: sanitizedTitle,
      description: sanitizedDescription,
      category: safeCategory,
      formData: sanitizedFormData,
      theme: sanitizedTheme || 'modern',
      tenantId: req.user.tenantId,
      shopId: formShopId,
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

// ─── Rate limiter for Google Client ID endpoint ──────────────────────────────
const googleClientIdLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Google Sign-In: Serve client ID to frontend ─────────────────────────────
// NOTE: These must be defined BEFORE /public/:id to avoid matching as a UUID param
formsRoutes.get("/public/google-client-id", googleClientIdLimiter, (req: any, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.json({ clientId: null });
  }
  res.json({ clientId });
});

// ─── Rate limiter for Google Sign-In submissions ─────────────────────────────
const googleSignInLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Too many sign-in attempts from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Schema for Google Sign-In request
const googleSignInSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
  formId: z.string().regex(UUID_REGEX, 'Invalid form ID format'),
});

// ─── Google Sign-In: Verify token and add email to newsletter ────────────────
formsRoutes.post("/public/google-signin", googleSignInLimiter, async (req: any, res) => {
  try {
    const validation = googleSignInSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { credential, formId } = validation.data;

    // Verify the Google ID token via Google's tokeninfo endpoint
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!tokenInfoRes.ok) {
      return res.status(401).json({ message: 'Invalid Google credential' });
    }

    const tokenInfo = await tokenInfoRes.json() as {
      email?: string;
      email_verified?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
      aud?: string;
    };

    // Verify audience matches our client ID
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (!expectedClientId) {
      return res.status(500).json({ message: 'Google Sign-In is not configured' });
    }
    if (tokenInfo.aud !== expectedClientId) {
      return res.status(401).json({ message: 'Token audience mismatch' });
    }

    if (!tokenInfo.email) {
      return res.status(400).json({ message: 'No email found in Google account' });
    }

    if (tokenInfo.email_verified !== 'true') {
      return res.status(400).json({ message: 'Google email is not verified' });
    }

    // Look up the form to get the tenantId
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${formId} AND ${forms.isActive} = true`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found or inactive' });
    }

    // Check if contact already exists for this tenant
    const existingContact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.tenantId} = ${form.tenantId} AND ${emailContacts.email} = ${tokenInfo.email}`,
    });

    const clientIp = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    if (existingContact) {
      // Contact already exists — update last activity
      await db.update(emailContacts)
        .set({ lastActivity: new Date(), updatedAt: new Date() })
        .where(sql`${emailContacts.id} = ${existingContact.id}`);

      return res.status(200).json({
        success: true,
        email: tokenInfo.email,
        firstName: tokenInfo.given_name || null,
        lastName: tokenInfo.family_name || null,
        message: 'Email already subscribed',
        alreadySubscribed: true,
      });
    }

    // Create new email contact, form response, and update count in a transaction
    const formShopId = form.shopId || await getDefaultShopId(form.tenantId);
    const newContact = await db.transaction(async (tx: any) => {
      const [contact] = await tx.insert(emailContacts).values({
        tenantId: form.tenantId,
        shopId: formShopId,
        email: tokenInfo.email,
        firstName: tokenInfo.given_name || null,
        lastName: tokenInfo.family_name || null,
        status: 'active',
        consentGiven: true,
        consentDate: new Date(),
        consentMethod: 'google_signin',
        consentIpAddress: clientIp,
        consentUserAgent: userAgent,
        prefTransactional: true,
        prefMarketing: true,
        prefCustomerEngagement: true,
        prefNewsletters: true,
        prefSurveysForms: true,
      }).returning();

      await tx.insert(formResponses).values({
        tenantId: form.tenantId,
        shopId: formShopId,
        formId,
        responseData: JSON.stringify({
          email: tokenInfo.email,
          firstName: tokenInfo.given_name || '',
          lastName: tokenInfo.family_name || '',
          source: 'google_signin',
        }),
        submittedAt: new Date(),
        ipAddress: clientIp,
        userAgent,
      });

      await tx.update(forms)
        .set({
          responseCount: sql`${forms.responseCount} + 1`,
          updatedAt: new Date(),
        })
        .where(sql`${forms.id} = ${formId}`);

      return contact;
    });

    // Send promotion email if enabled for this form (non-blocking)
    sendPromotionEmailIfEnabled(form, tokenInfo.email, tokenInfo.given_name, tokenInfo.family_name);

    res.status(201).json({
      success: true,
      email: tokenInfo.email,
      firstName: tokenInfo.given_name || null,
      lastName: tokenInfo.family_name || null,
      contactId: newContact.id,
      message: 'Successfully subscribed via Google Sign-In',
      alreadySubscribed: false,
    });

  } catch (error) {
    console.error('Google Sign-In error:', error);
    res.status(500).json({ message: 'Failed to process Google sign-in' });
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
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
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

    const { data, _hp_email, _ft, _turnstile_token } = parsed.data;

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

    // 3. Server-side suspicion scoring — require Turnstile if suspicious
    if (process.env.TURNSTILE_SECRET_KEY) {
      let suspicionScore = 0;
      const signals: string[] = [];

      // Near-threshold timing (passed 2s check but still fast)
      if (_ft) {
        const elapsed = Date.now() - _ft;
        if (elapsed < 4000) { suspicionScore += 30; signals.push(`fast-timing:${elapsed}ms`); }
      }

      // Missing or bot-like User-Agent
      const ua = req.get('User-Agent') || '';
      if (!ua || /bot|crawl|spider|curl|wget|python|httpx|axios|node-fetch|go-http/i.test(ua)) {
        suspicionScore += 40; signals.push('suspicious-ua');
      }

      // Missing typical browser headers
      if (!req.get('Accept-Language')) { suspicionScore += 10; signals.push('no-accept-language'); }
      if (!req.get('Referer') && !req.get('Origin')) { suspicionScore += 10; signals.push('no-referer-origin'); }

      // No form load timestamp at all (bots often skip this)
      if (!_ft) { suspicionScore += 20; signals.push('no-timestamp'); }

      if (suspicionScore >= 50) {
        if (!_turnstile_token) {
          console.warn(`[Bot Protection] Suspicion score ${suspicionScore} for form ${id} from IP ${req.ip} — requiring CAPTCHA [${signals.join(', ')}]`);
          return res.status(449).json({
            requireCaptcha: true,
            message: 'Additional verification required',
          });
        }

        // Verify the provided Turnstile token
        const verification = await verifyTurnstileToken(_turnstile_token, req.ip);
        if (!verification.success) {
          console.warn(`[Bot Protection] Turnstile verification failed for form ${id} from IP ${req.ip}`);
          return res.status(201).json({
            message: 'Form submitted successfully',
            responseId: 'blocked',
          });
        }
      }
    }

    // Check if form exists and is active
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.isActive} = true`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found or not active' });
    }

    // Resolve shop from form or tenant default
    const publicFormShopId = form.shopId || await getDefaultShopId(form.tenantId);

    // Create form response
    const newResponse = await db.insert(formResponses).values({
      tenantId: form.tenantId,
      shopId: publicFormShopId,
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

    // Extract email from submission data for template/promotion emails
    const submittedData = typeof data === 'object' ? data : {};
    const submittedEmail = Object.values(submittedData).find(
      (val) => typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
    ) as string | undefined;

    // Derive first/last name from submission data if available
    const submittedFirstName = (() => {
      const entries = Object.entries(submittedData);
      const firstNameEntry = entries.find(([k]) => /first.?name/i.test(k));
      return typeof firstNameEntry?.[1] === 'string' ? firstNameEntry[1] : null;
    })();

    const submittedLastName = (() => {
      const entries = Object.entries(submittedData);
      const lastNameEntry = entries.find(([k]) => /last.?name/i.test(k));
      return typeof lastNameEntry?.[1] === 'string' ? lastNameEntry[1] : null;
    })();

    if (submittedEmail) {
      // Send template-based confirmation email (all form categories)
      sendTemplateEmailIfEnabled(form, submittedEmail, submittedFirstName, submittedLastName);

      // For email-signup forms, add new subscribers to the email contacts list
      if (form.category === 'email-signup') {
        const existingContact = await db.query.emailContacts.findFirst({
          where: sql`${emailContacts.tenantId} = ${form.tenantId} AND ${emailContacts.email} = ${submittedEmail}`,
        });

        if (existingContact) {
          // Contact already exists — update last activity
          await db.update(emailContacts)
            .set({ lastActivity: new Date(), updatedAt: new Date() })
            .where(sql`${emailContacts.id} = ${existingContact.id}`);
        } else {
          // Create new email contact — default to 'Preferred Customer' for email-only signups
          const contactFirstName = submittedFirstName || 'Preferred';
          const contactLastName = submittedLastName || 'Customer';
          const clientIp = req.ip || 'unknown';
          const userAgent = req.get('User-Agent') || 'unknown';

          await db.insert(emailContacts).values({
            tenantId: form.tenantId,
            shopId: publicFormShopId,
            email: submittedEmail,
            firstName: contactFirstName,
            lastName: contactLastName,
            status: 'active',
            consentGiven: true,
            consentDate: new Date(),
            consentMethod: 'form_submission',
            consentIpAddress: clientIp,
            consentUserAgent: userAgent,
            prefTransactional: true,
            prefMarketing: true,
            prefCustomerEngagement: true,
            prefNewsletters: true,
            prefSurveysForms: true,
          });

          // Send promotion email for new subscribers only
          sendPromotionEmailIfEnabled(form, submittedEmail, contactFirstName, contactLastName);
        }
      }
    }

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