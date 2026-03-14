import xss from 'xss';
import crypto from 'crypto';
import { db } from '../../db';
import { emailActivity, emailSends, emailContent } from '@shared/schema';
import { wrapNewsletterContent } from '../../utils/newsletterEmailWrapper';
import { sanitizeString } from '../../utils/sanitization';

// Sanitize HTML content for emails - allows safe formatting tags, strips scripts and event handlers
export function sanitizeEmailHtml(html: string): string {
  const preprocessed = html.replace(/url\(\s*"([^"]*?)"\s*\)/gi, "url('$1')");
  return xss(preprocessed, {
    whiteList: {
      // Text formatting
      p: ['style', 'class', 'align'],
      br: [],
      strong: ['style'],
      b: ['style'],
      em: ['style'],
      i: ['style'],
      u: ['style'],
      s: ['style'],
      strike: ['style'],
      // Headings
      h1: ['style', 'class', 'align'],
      h2: ['style', 'class', 'align'],
      h3: ['style', 'class', 'align'],
      h4: ['style', 'class', 'align'],
      h5: ['style', 'class', 'align'],
      h6: ['style', 'class', 'align'],
      // Links and images
      a: ['href', 'title', 'target', 'style', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style', 'class'],
      // Lists
      ul: ['style', 'class'],
      ol: ['style', 'class'],
      li: ['style', 'class'],
      // Layout
      div: ['style', 'class', 'align'],
      span: ['style', 'class'],
      blockquote: ['style', 'class'],
      pre: ['style', 'class'],
      code: ['style', 'class'],
      // Tables (common in emails)
      table: ['style', 'class', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'role'],
      colgroup: ['style'],
      col: ['style', 'span', 'width'],
      thead: ['style', 'class'],
      tbody: ['style', 'class'],
      tr: ['style', 'class'],
      th: ['style', 'class', 'colspan', 'rowspan', 'width', 'height', 'valign', 'align', 'background'],
      td: ['style', 'class', 'colspan', 'rowspan', 'width', 'height', 'valign', 'align', 'background', 'bgcolor'],
      // Misc
      hr: ['style'],
      center: ['style'],
    },
    css: false,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'noscript', 'iframe', 'object', 'embed'],
    onTagAttr: (tag, name, value) => {
      if (name === 'style') {
        const safeValue = value.replace(/url\(\s*"([^"]*?)"\s*\)/gi, "url('$1')");
        return `${name}="${(xss as any).escapeAttrValue(safeValue)}"`;
      }
      if (tag === 'img' && name === 'src') {
        if (value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://')) {
          return `${name}="${(xss as any).escapeAttrValue(value)}"`;
        }
        return '';
      }
      if ((tag === 'td' || tag === 'th') && name === 'background') {
        if (value.startsWith('http://') || value.startsWith('https://')) {
          return `${name}="${(xss as any).escapeAttrValue(value)}"`;
        }
        return '';
      }
      if (name === 'href') {
        const lowerValue = value.toLowerCase().trim();
        if (lowerValue.startsWith('javascript:') || lowerValue.startsWith('vbscript:') || lowerValue.startsWith('data:')) {
          return '';
        }
      }
      if (name.startsWith('on')) {
        return '';
      }
      return undefined;
    },
  });
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c: string) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

export function sanitizeFontFamily(fontFamily: string | undefined | null): string {
  if (!fontFamily) return 'Arial, sans-serif';

  const allowedFonts = [
    'Arial, sans-serif',
    'Arial, Helvetica, sans-serif',
    'Helvetica, sans-serif',
    'Georgia, serif',
    "'Times New Roman', serif",
    'Times New Roman, Times, serif',
    "'Courier New', monospace",
    'Courier New, Courier, monospace',
    'Verdana, sans-serif',
    'Verdana, Geneva, sans-serif',
    "'Trebuchet MS', sans-serif",
    'Trebuchet MS, Helvetica, sans-serif',
    "'Inter', sans-serif",
    'Tahoma, Geneva, sans-serif',
    'Impact, Charcoal, sans-serif',
    'Lucida Console, Monaco, monospace',
  ];

  const normalized = fontFamily.trim();
  const match = allowedFonts.find(f => f.toLowerCase() === normalized.toLowerCase());
  return match || 'Arial, sans-serif';
}

export function maskEmail(email: string): string {
  const trimmed = String(email || '').trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return '***';
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  return `${local[0]}***@${domain}`;
}

export type PromotionalEmailJobPayload = {
  tenantId: string;
  contactId: string;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  promoSubject: string;
  htmlPromo: string;
  unsubscribeToken?: string;
  promotionId?: string | null;
  manual?: boolean;
};

/**
 * Enqueue a promotional email job using Trigger.dev for durable scheduling
 */
export async function enqueuePromotionalEmailJob(
  payload: PromotionalEmailJobPayload,
  delayMs: number
): Promise<{ success: boolean; runId?: string; error?: string }> {
  try {
    const { tasks } = await import('@trigger.dev/sdk/v3');
    const { logTriggerTask } = await import('../../lib/trigger');
    const taskId = 'schedule-promotional-email';

    const handle = await tasks.trigger(taskId, {
      ...payload,
      delayMs,
    });

    console.log(`✅ [PromotionalEmailJob] Scheduled via Trigger.dev (ID: ${handle.id}) with ${delayMs}ms delay for ${maskEmail(payload.recipientEmail)}`);

    await logTriggerTask({
      taskId,
      runId: handle.id,
      payload: { ...payload, delayMs },
      status: 'triggered',
      tenantId: payload.tenantId,
      relatedType: 'email',
      relatedId: payload.contactId,
    });

    return {
      success: true,
      runId: handle.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ [PromotionalEmailJob] Failed to schedule via Trigger.dev:', errorMessage);

    console.log('⚠️ [PromotionalEmailJob] Falling back to direct execution');
    void sendPromotionalEmailJob(payload).catch((fallbackErr) => {
      console.error('❌ [PromotionalEmailJob] Fallback execution failed:', fallbackErr);
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function sendPromotionalEmailJob(payload: PromotionalEmailJobPayload): Promise<void> {
  const { enhancedEmailService } = await import('../../emailService');

  const wrappedHtmlPromo = await wrapNewsletterContent(payload.tenantId, payload.htmlPromo);

  const promoResult = await enhancedEmailService.sendCustomEmail(
    payload.recipientEmail,
    `🎁 ${payload.promoSubject}`,
    wrappedHtmlPromo,
    {
      text: wrappedHtmlPromo.replace(/<[^>]*>/g, ''),
      from: 'admin@zendwise.com',
      metadata: {
        type: 'birthday-promotion',
        contactId: payload.contactId,
        tenantId: payload.tenantId,
        manual: !!payload.manual,
        tags: ['birthday', ...(payload.manual ? ['manual'] : []), 'promotion', `tenant-${payload.tenantId}`],
        unsubscribeToken: payload.unsubscribeToken || 'none',
      },
    }
  );

  if (!promoResult.success) {
    console.error(`❌ [PromotionalEmailJob] Failed to send promotional email:`, {
      recipient: payload.recipientEmail,
      contactId: payload.contactId,
      tenantId: payload.tenantId,
      error: promoResult.error,
      providerId: promoResult.providerId,
    });

    try {
      await db.insert(emailActivity).values({
        tenantId: payload.tenantId,
        contactId: payload.contactId,
        activityType: 'failed',
        activityData: JSON.stringify({
          type: 'birthday-promotion',
          manual: !!payload.manual,
          split: true,
          subject: `🎁 ${payload.promoSubject}`,
          recipient: payload.recipientEmail,
          from: 'admin@zendwise.com',
          error: promoResult.error,
          providerId: promoResult.providerId,
        }),
        occurredAt: new Date(),
      });
    } catch (logError) {
      console.error(`⚠️ [PromotionalEmailJob] Failed to log failed email activity:`, logError);
    }

    try {
      const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
      await db.insert(emailSends).values({
        id: emailSendId,
        tenantId: payload.tenantId,
        recipientEmail: payload.recipientEmail,
        recipientName: payload.recipientName,
        senderEmail: 'admin@zendwise.com',
        senderName: payload.senderName,
        subject: `🎁 ${payload.promoSubject}`,
        emailType: 'promotional',
        provider: promoResult.providerId || 'resend',
        providerMessageId: promoResult.messageId || null,
        status: 'failed',
        contactId: payload.contactId,
        promotionId: payload.promotionId || null,
        sentAt: null,
      });
    } catch (logError) {
      console.error(`⚠️ [PromotionalEmailJob] Failed to log failed send to email_sends table:`, logError);
    }

    return;
  }

  const providerMessageId = promoResult.messageId || null;

  console.log(`✅ [PromotionalEmailJob] Successfully sent promotional email:`, {
    recipient: payload.recipientEmail,
    contactId: payload.contactId,
    messageId: providerMessageId,
    providerId: promoResult.providerId,
  });

  try {
    await db.insert(emailActivity).values({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      activityType: 'sent',
      activityData: JSON.stringify({
        type: 'birthday-promotion',
        manual: !!payload.manual,
        split: true,
        subject: `🎁 ${payload.promoSubject}`,
        recipient: payload.recipientEmail,
        from: 'admin@zendwise.com',
        messageId: providerMessageId,
        providerId: promoResult.providerId,
      }),
      occurredAt: new Date(),
    });
  } catch (logError) {
    console.error(`⚠️ [PromotionalEmailJob] Failed to log promotional email activity:`, logError);
  }

  try {
    const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
    await db.insert(emailSends).values({
      id: emailSendId,
      tenantId: payload.tenantId,
      recipientEmail: payload.recipientEmail,
      recipientName: payload.recipientName,
      senderEmail: 'admin@zendwise.com',
      senderName: payload.senderName,
      subject: `🎁 ${payload.promoSubject}`,
      emailType: 'promotional',
      provider: promoResult.providerId || 'resend',
      providerMessageId: providerMessageId,
      status: 'sent',
      contactId: payload.contactId,
      promotionId: payload.promotionId || null,
      sentAt: new Date(),
    });

    await db.insert(emailContent).values({
      emailSendId: emailSendId,
      htmlContent: wrappedHtmlPromo,
      textContent: wrappedHtmlPromo.replace(/<[^>]*>/g, ''),
      metadata: JSON.stringify({
        split: true,
        manual: !!payload.manual,
        birthdayCard: false,
        promotional: true,
        messageId: providerMessageId,
        providerId: promoResult.providerId,
      }),
    });
  } catch (logError) {
    console.error(`⚠️ [PromotionalEmailJob] Failed to log to email_sends/email_content table:`, logError);
  }
}

// Helper function to process placeholders in content
export function processPlaceholders(content: string, params: { recipientName?: string }): string {
  if (!content) return content;

  let processed = content;

  const nameParts = (params.recipientName || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  processed = processed.replace(/\{\{firstName\}\}/g, firstName);
  processed = processed.replace(/\{\{lastName\}\}/g, lastName);

  return processed;
}

// Helper function to render birthday template (also exported for test endpoint)
export function renderBirthdayTemplate(
  template: 'default' | 'confetti' | 'balloons' | 'custom',
  params: {
    recipientName?: string;
    message?: string;
    brandName?: string;
    customThemeData?: any;
    senderName?: string;
    promotionContent?: string;
    promotionTitle?: string;
    promotionDescription?: string;
    unsubscribeToken?: string;
  }
): string {
  // Handle custom theme with rich styling
  if (template === 'custom' && params.customThemeData) {
    let customData = null;

    try {
      const parsedData = typeof params.customThemeData === 'string'
        ? JSON.parse(params.customThemeData)
        : params.customThemeData;

      if (parsedData.themes && parsedData.themes.custom) {
        customData = parsedData.themes.custom;
      } else if (!parsedData.themes) {
        customData = parsedData;
      }
    } catch (e) {
      console.warn('Failed to parse customThemeData for custom template:', e);
      return `<html><body><p>Error loading custom theme</p></body></html>`;
    }

    if (!customData) {
      return `<html><body><p>No custom theme data found</p></body></html>`;
    }

    const title = customData.title || `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
    const message = processPlaceholders(customData.message || params.message || 'Wishing you a wonderful day!', params);
    const signature = customData.signature || '';
    const fromMessage = params.senderName || 'The Team';

    const isValidImageUrl = customData.imageUrl && (() => { try { const u = new URL(customData.imageUrl); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } })();
    const headerImageSection = isValidImageUrl
      ? `<div style="height: 200px; background-image: url('${sanitizeEmailHtml(customData.imageUrl)}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;"></div>`
      : `<div style="background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%); height: 200px; border-radius: 12px 12px 0 0;"></div>`;

    let promotionSection = '';
    if (params.promotionContent) {
      const safePromoTitle = params.promotionTitle ? sanitizeEmailHtml(processPlaceholders(params.promotionTitle, params)) : '';
      const safePromoDesc = params.promotionDescription ? sanitizeEmailHtml(processPlaceholders(params.promotionDescription, params)) : '';
      const safePromoContent = sanitizeEmailHtml(processPlaceholders(params.promotionContent, params));

      promotionSection = `
        <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px; border-left: 4px solid #667eea;">
          ${safePromoTitle ? `<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">${safePromoTitle}</h3>` : ''}
          ${safePromoDesc ? `<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${safePromoDesc}</p>` : ''}
          <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${safePromoContent}</div>
        </div>
      `;
    }

    const signatureSection = signature
      ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-style: italic; color: #718096;">${processPlaceholders(signature, params)}</div>`
      : '';

    let unsubscribeSection = '';
    if (params.unsubscribeToken && params.promotionContent) {
      const baseUrl = process.env.APP_URL || 'http://localhost:5002';
      const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(params.unsubscribeToken)}&type=customer_engagement`;
      unsubscribeSection = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 0.8rem; color: #a0aec0; line-height: 1.4;">
            Don't want to receive these emails?
            <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Manage preferences</a>
          </p>
        </div>
      `;
    }

    const fromMessageSection = !signature && fromMessage
      ? `<div style="padding: 20px 30px 10px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
           <div style="font-size: 0.9rem; color: #718096;">
             <p style="margin: 0; font-weight: 600; color: #4a5568;">${fromMessage}</p>
           </div>
        </div>
      `
      : '';

    return `<html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <!-- 1. Header Image (standalone) -->
          ${headerImageSection}

          <!-- 2. Header Text (separate from image) -->
          <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
            <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${title}</h1>
          </div>

          <!-- 3. Content Area (message) -->
          <div style="padding: 30px;">
            <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">${message}</div>
            ${promotionSection}
            ${signatureSection}
          </div>

          ${fromMessageSection}
          ${unsubscribeSection ? `<div style="padding: 0 30px 30px 30px;">${unsubscribeSection}</div>` : ''}
        </div>
      </body>
    </html>`;
  }

  const themeHeaders = {
    default: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    confetti: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    balloons: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  };

  const themeColors = {
    default: { primary: '#667eea', secondary: '#764ba2' },
    confetti: { primary: '#ff6b6b', secondary: '#feca57' },
    balloons: { primary: '#54a0ff', secondary: '#5f27cd' }
  };

  let headline = `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
  let signature = '';

  if (params.customThemeData) {
    try {
      const parsedData = typeof params.customThemeData === 'string'
        ? JSON.parse(params.customThemeData)
        : params.customThemeData;

      let themeSpecificData = null;

      if (parsedData.themes && parsedData.themes[template]) {
        themeSpecificData = parsedData.themes[template];
      } else if (!parsedData.themes) {
        themeSpecificData = parsedData;
      }

      if (themeSpecificData) {
        if (themeSpecificData.title) {
          headline = themeSpecificData.title;
        }
        if (themeSpecificData.signature) {
          signature = themeSpecificData.signature;
        }
      }
    } catch (e) {
      console.warn('Failed to parse customThemeData for template:', template, e);
    }
  }

  const headerImage = themeHeaders[template as keyof typeof themeHeaders] || themeHeaders.default;
  const colors = themeColors[template as keyof typeof themeColors] || themeColors.default;
  const fromMessage = params.senderName || 'The Team';

  let promotionSection = '';
  if (params.promotionContent) {
    const safePromoTitle = params.promotionTitle ? sanitizeEmailHtml(processPlaceholders(params.promotionTitle, params)) : '';
    const safePromoDesc = params.promotionDescription ? sanitizeEmailHtml(processPlaceholders(params.promotionDescription, params)) : '';
    const safePromoContent = sanitizeEmailHtml(processPlaceholders(params.promotionContent, params));

    promotionSection = `
      <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px; border-left: 4px solid ${colors.primary};">
        ${safePromoTitle ? `<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">${safePromoTitle}</h3>` : ''}
        ${safePromoDesc ? `<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${safePromoDesc}</p>` : ''}
        <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${safePromoContent}</div>
      </div>
    `;
  }

  const signatureSection = signature
    ? `<div style="font-size: 1rem; line-height: 1.5; color: #718096; text-align: center; font-style: italic; margin-top: 20px;">${processPlaceholders(signature, params)}</div>`
    : '';

  const fromMessageSection = !signature && fromMessage
    ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #718096; font-size: 0.9rem; font-weight: 600;">${fromMessage}</div>`
    : '';

  let unsubscribeSection = '';
  if (params.unsubscribeToken && params.promotionContent) {
    const baseUrl = process.env.APP_URL || 'http://localhost:5002';
    const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(params.unsubscribeToken)}&type=customer_engagement`;
    unsubscribeSection = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 0.8rem; color: #a0aec0; line-height: 1.4;">
          Don't want to receive these emails?
          <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Manage preferences</a>
        </p>
      </div>
    `;
  }

  return `<html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
        <!-- 1. Header Image (standalone) -->
        <div style="height: 200px; background-image: url('${headerImage}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;"></div>

        <!-- 2. Header Text (separate from image) -->
        <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
          <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${headline}</h1>
        </div>

        <!-- 3. Content Area (message) -->
        <div style="padding: 30px;">
          <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">${processPlaceholders(params.message || 'Wishing you a wonderful day!', params)}</div>
          ${promotionSection}
          ${signatureSection}
          ${fromMessageSection}
          ${unsubscribeSection}
        </div>
      </div>
    </body>
  </html>`;
}

// ── Validation helpers for master email design ──────────────────────────

export const ALLOWED_HEADER_MODES = ['logo', 'banner'] as const;
export const ALLOWED_LOGO_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
export const ALLOWED_LOGO_ALIGNMENTS = ['left', 'center', 'right'] as const;
export const ALLOWED_FONT_FAMILIES = [
  'Arial, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Helvetica, sans-serif',
  'Georgia, serif',
  "'Times New Roman', serif",
  'Times New Roman, Times, serif',
  "'Courier New', monospace",
  'Courier New, Courier, monospace',
  'Verdana, sans-serif',
  'Verdana, Geneva, sans-serif',
  "'Trebuchet MS', sans-serif",
  'Trebuchet MS, Helvetica, sans-serif',
  "'Inter', sans-serif",
  'Tahoma, Geneva, sans-serif',
  'Impact, Charcoal, sans-serif',
  'Lucida Console, Monaco, monospace',
] as const;

export function validateDesignColor(color: unknown): string | null {
  if (typeof color !== 'string') return null;
  const normalized = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)) return normalized;
  return null;
}

export function validateDesignUrl(url: unknown): string | null {
  if (url === null || url === '') return null;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return trimmed;
  } catch { /* invalid URL */ }
  return null;
}

export function sanitizeDesignText(text: unknown, maxLength: number = 500): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  return sanitizeString(text.slice(0, maxLength)) || null;
}

export function validateSocialLinks(raw: unknown): Record<string, string> | null {
  let obj: Record<string, unknown>;
  if (raw === null) return null;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }
  const allowed = ['facebook', 'twitter', 'instagram', 'linkedin'];
  const result: Record<string, string> = {};
  for (const key of allowed) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) {
      const validated = validateDesignUrl(val);
      if (validated) {
        result[key] = validated;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}
