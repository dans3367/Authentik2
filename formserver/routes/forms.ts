import express, { Request, Response, NextFunction } from 'express';
import { db } from '../database.js';
import { forms, formResponses, emailContacts, promotions, masterEmailDesign, companies } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// ─── Email Design Wrapper ────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}

async function wrapInEmailDesign(tenantId: string, bodyContent: string): Promise<string> {
  try {
    // Fetch the tenant's email design
    const design = await db.select()
      .from(masterEmailDesign)
      .where(eq(masterEmailDesign.tenantId, tenantId))
      .limit(1);

    // Fetch company name as fallback
    const company = await db.select({ name: companies.name })
      .from(companies)
      .where(and(eq(companies.tenantId, tenantId), eq(companies.isActive, true)))
      .limit(1);

    const companyName = design[0]?.companyName || company[0]?.name || '';
    const d = design[0];
    const primaryColor = d?.primaryColor || '#3B82F6';
    const fontFamily = d?.fontFamily || 'Arial, sans-serif';
    const headerMode = d?.headerMode || 'logo';
    const logoUrl = d?.logoUrl || null;
    const logoSize = d?.logoSize || 'medium';
    const logoAlignment = d?.logoAlignment || 'center';
    const bannerUrl = d?.bannerUrl || null;
    const showCompanyName = (d?.showCompanyName ?? 'true') === 'true';
    const headerText = d?.headerText || null;
    const footerText = d?.footerText || (companyName ? `&copy; ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.` : '');

    // Social links
    let socialLinksHtml = '';
    if (d?.socialLinks) {
      try {
        const parsed = JSON.parse(d.socialLinks);
        const linkStyle = "color: #64748b; text-decoration: none; margin: 0 10px; font-weight: 500;";
        const links: string[] = [];
        if (parsed.facebook && isValidHttpUrl(parsed.facebook)) links.push(`<a href="${escapeHtml(parsed.facebook)}" style="${linkStyle}">Facebook</a>`);
        if (parsed.twitter && isValidHttpUrl(parsed.twitter)) links.push(`<a href="${escapeHtml(parsed.twitter)}" style="${linkStyle}">Twitter</a>`);
        if (parsed.instagram && isValidHttpUrl(parsed.instagram)) links.push(`<a href="${escapeHtml(parsed.instagram)}" style="${linkStyle}">Instagram</a>`);
        if (parsed.linkedin && isValidHttpUrl(parsed.linkedin)) links.push(`<a href="${escapeHtml(parsed.linkedin)}" style="${linkStyle}">LinkedIn</a>`);
        if (links.length > 0) socialLinksHtml = `<div style="margin-bottom: 24px;">${links.join(' | ')}</div>`;
      } catch { /* ignore */ }
    }

    const safeCompanyName = escapeHtml(companyName);
    const safeHeaderText = headerText ? escapeHtml(headerText) : null;
    const useBanner = headerMode === 'banner' && bannerUrl && isValidHttpUrl(bannerUrl);

    // Logo
    const logoSizeMap: Record<string, string> = { small: '64px', medium: '96px', large: '128px', xlarge: '160px' };
    const logoHeight = logoSizeMap[logoSize] || '96px';
    const logoML = logoAlignment === 'center' ? 'auto' : logoAlignment === 'right' ? 'auto' : '0';
    const logoMR = logoAlignment === 'center' ? 'auto' : logoAlignment === 'right' ? '0' : 'auto';
    const logoSection = logoUrl && isValidHttpUrl(logoUrl)
      ? `<img src="${escapeHtml(logoUrl)}" alt="${safeCompanyName}" style="display: block; height: ${logoHeight}; width: auto; margin: 0 ${logoMR} 20px ${logoML}; object-fit: contain;" />`
      : (safeCompanyName && showCompanyName)
        ? `<div style="height: 48px; width: 48px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 ${logoMR} 16px ${logoML}; line-height: 48px; font-size: 20px; font-weight: bold; color: #ffffff; text-align: center;">${escapeHtml(companyName.charAt(0))}</div>`
        : '';

    return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family: ${fontFamily}; margin: 0; padding: 0; background-color: #f7fafc; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
      ${useBanner ? `
      <img src="${escapeHtml(bannerUrl!)}" alt="${safeCompanyName}" style="display: block; width: 100%; height: auto; border: 0;" />
      ${(safeCompanyName && showCompanyName) || safeHeaderText ? `
      <div style="padding: 16px 24px; text-align: center; background-color: ${primaryColor}; color: #ffffff;">
        ${safeCompanyName && showCompanyName ? `<h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: bold; color: #ffffff;">${safeCompanyName}</h1>` : ''}
        ${safeHeaderText ? `<p style="margin: 0 auto; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">${safeHeaderText}</p>` : ''}
      </div>` : ''}
      ` : `
      <div style="padding: 40px 24px; text-align: ${logoAlignment}; background-color: ${primaryColor}; color: #ffffff;">
        ${logoSection}
        ${safeCompanyName && showCompanyName ? `<h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; color: #ffffff;">${safeCompanyName}</h1>` : ''}
        ${safeHeaderText ? `<p style="margin: 0 ${logoMR} 0 ${logoML}; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">${safeHeaderText}</p>` : ''}
      </div>
      `}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr><td style="padding: 0; font-size: 16px; line-height: 1.625; color: #334155;">${bodyContent}</td></tr>
      </table>
      <div style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b;">
        ${socialLinksHtml}
        ${footerText ? `<p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.5; color: #64748b;">${footerText}</p>` : ''}
        ${safeCompanyName && showCompanyName ? `<div style="font-size: 12px; color: #94a3b8;"><p style="margin: 0;">Sent via ${safeCompanyName}</p></div>` : ''}
      </div>
    </div>
  </body>
</html>`;
  } catch (err) {
    console.error('[Promotion] Failed to wrap email in design:', err);
    return bodyContent; // Fallback: send unwrapped
  }
}

// ─── Helper: Send promotion email after successful email signup ──────────────
async function sendPromotionEmailIfEnabled(formRecord: { id: string; tenantId: string; formData: string }, recipientEmail: string, firstName?: string | null) {
  try {
    let formData: any;
    try {
      formData = typeof formRecord.formData === 'string' ? JSON.parse(formRecord.formData) : formRecord.formData;
    } catch {
      return;
    }

    const settings = formData?.settings;
    if (!settings?.promotionEnabled || !settings?.promotionId) {
      return;
    }

    // Fetch the promotion
    const promo = await db.select()
      .from(promotions)
      .where(and(
        eq(promotions.id, settings.promotionId),
        eq(promotions.tenantId, formRecord.tenantId),
        eq(promotions.isActive, true)
      ))
      .limit(1);

    if (promo.length === 0) {
      console.warn(`[Promotion] Promotion ${settings.promotionId} not found or inactive for form ${formRecord.id}`);
      return;
    }

    const promotion = promo[0];
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'admin@zendwise.com';

    if (!resendApiKey) {
      console.warn('[Promotion] RESEND_API_KEY not set, skipping promotion email');
      return;
    }

    // Wrap promotion content in the tenant's branded email design
    const wrappedContent = await wrapInEmailDesign(formRecord.tenantId, promotion.content);

    // Send via Resend HTTP API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: promotion.title,
        html: wrappedContent,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Promotion] Resend API error: ${res.status} ${errBody}`);
      return;
    }

    // Increment promotion usage count
    await db.update(promotions)
      .set({
        usageCount: sql`${promotions.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, promotion.id));

    console.log(`[Promotion] Sent promotion "${promotion.title}" to ${recipientEmail} for form ${formRecord.id}`);
  } catch (error) {
    console.error('[Promotion] Failed to send promotion email:', error);
  }
}

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
      tenantId: forms.tenantId,
      category: forms.category,
      formData: forms.formData,
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

    // Send promotion email if enabled for this email-signup form (non-blocking, new emails only)
    if (formRecord.category === 'email-signup') {
      const submittedEmail = Object.values(responseData).find(
        (val) => typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val as string)
      ) as string | undefined;
      if (submittedEmail) {
        // Only send promotion if this email doesn't already exist in contacts
        const existingEmail = await db.select({ id: emailContacts.id })
          .from(emailContacts)
          .where(and(
            eq(emailContacts.tenantId, formRecord.tenantId),
            eq(emailContacts.email, submittedEmail)
          ))
          .limit(1);
        if (existingEmail.length === 0) {
          sendPromotionEmailIfEnabled(formRecord, submittedEmail);
        }
      }
    }

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

// ─── Rate limiter for Google Client ID endpoint ──────────────────────────────
const googleClientIdLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Google Sign-In: Serve client ID to frontend ─────────────────────────────
router.get('/google-client-id', googleClientIdLimiter, (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.json({ clientId: null });
  }
  res.json({ clientId });
});

// ─── Rate limiter for Google Sign-In submissions ─────────────────────────────
const googleSignInLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 5, // limit each IP to 5 Google sign-in attempts per window
  message: { error: 'Too many sign-in attempts from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Schema for Google Sign-In request
const googleSignInSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
  formId: z.string().regex(UUID_REGEX, 'Invalid form ID format'),
});

// ─── Google Sign-In: Verify token and add email to newsletter ────────────────
router.post('/google-signin', googleSignInLimiter, async (req, res) => {
  try {
    const validation = googleSignInSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { credential, formId } = validation.data;

    // Verify the Google ID token by fetching Google's tokeninfo endpoint
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!tokenInfoRes.ok) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    const tokenInfo = await tokenInfoRes.json() as {
      email?: string;
      email_verified?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
      aud?: string;
    };

    // Verify the audience matches our client ID
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (!expectedClientId) {
      return res.status(500).json({ error: 'Google Sign-In is not configured' });
    }
    if (tokenInfo.aud !== expectedClientId) {
      return res.status(401).json({ error: 'Token audience mismatch' });
    }

    if (!tokenInfo.email) {
      return res.status(400).json({ error: 'No email found in Google account' });
    }

    if (tokenInfo.email_verified !== 'true') {
      return res.status(400).json({ error: 'Google email is not verified' });
    }

    // Look up the form to get the tenantId
    const form = await db.select({
      id: forms.id,
      tenantId: forms.tenantId,
      category: forms.category,
      formData: forms.formData,
    })
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.isActive, true)))
      .limit(1);

    if (form.length === 0) {
      return res.status(404).json({ error: 'Form not found or inactive' });
    }

    const formRecord = form[0];

    // Check if contact already exists for this tenant
    const existingContact = await db.select({ id: emailContacts.id, email: emailContacts.email })
      .from(emailContacts)
      .where(
        and(
          eq(emailContacts.tenantId, formRecord.tenantId),
          eq(emailContacts.email, tokenInfo.email)
        )
      )
      .limit(1);

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    if (existingContact.length > 0) {
      // Contact already exists — update last activity
      await db.update(emailContacts)
        .set({ lastActivity: new Date(), updatedAt: new Date() })
        .where(eq(emailContacts.id, existingContact[0].id));

      return res.status(200).json({
        success: true,
        email: tokenInfo.email,
        firstName: tokenInfo.given_name || null,
        lastName: tokenInfo.family_name || null,
        message: 'Email already subscribed',
        alreadySubscribed: true,
      });
    }

    // Create new email contact for the newsletter
    const newContact = await db.insert(emailContacts).values({
      tenantId: formRecord.tenantId,
      email: tokenInfo.email,
      firstName: tokenInfo.given_name || null,
      lastName: tokenInfo.family_name || null,
      status: 'active',
      consentGiven: true,
      consentDate: new Date(),
      consentMethod: 'google_signin',
      consentIpAddress: clientIp,
      consentUserAgent: userAgent,
      prefNewsletters: true,
      prefMarketing: false,
    }).returning({ id: emailContacts.id });

    // Also record as a form response for tracking
    const responseData = JSON.stringify({
      email: tokenInfo.email,
      firstName: tokenInfo.given_name || '',
      lastName: tokenInfo.family_name || '',
      source: 'google_signin',
    });

    await db.insert(formResponses).values({
      tenantId: formRecord.tenantId,
      formId,
      responseData,
      ipAddress: clientIp,
      userAgent,
    });

    // Update form response count
    await db.update(forms)
      .set({
        responseCount: sql`${forms.responseCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(forms.id, formId));

    // Send promotion email if enabled for this form (non-blocking)
    sendPromotionEmailIfEnabled(formRecord, tokenInfo.email, tokenInfo.given_name);

    res.status(201).json({
      success: true,
      email: tokenInfo.email,
      firstName: tokenInfo.given_name || null,
      lastName: tokenInfo.family_name || null,
      contactId: newContact[0].id,
      message: 'Successfully subscribed via Google Sign-In',
      alreadySubscribed: false,
    });

  } catch (error) {
    console.error('Google Sign-In error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to process Google sign-in' });
  }
});

export { router as formRouter };