/**
 * Server-side utility to wrap newsletter body content in the tenant's master
 * email design template.  Mirrors the client-side preview wrapper
 * (client/src/utils/email-preview-wrapper.ts) and the Trigger.dev wrapper
 * (src/trigger/emailWrapper.ts) so that sent emails match the editor preview.
 */

import { db } from '../db';
import { masterEmailDesign, companies } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// ── Sanitisation helpers (same logic as emailManagementRoutes) ──────────

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c: string) => {
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
  } catch {
    return false;
  }
}

function sanitizeFontFamily(fontFamily: string | undefined | null): string {
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

function sanitizeColor(color: string | undefined | null, fallback: string = '#3B82F6'): string {
  if (!color) return fallback;
  const normalized = color.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(normalized)) return normalized;
  const rgbMatch = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/);
  if (rgbMatch && parseInt(rgbMatch[1]) <= 255 && parseInt(rgbMatch[2]) <= 255 && parseInt(rgbMatch[3]) <= 255) return normalized;
  const namedColors = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy', 'teal', 'aqua', 'maroon', 'olive', 'silver', 'fuchsia', 'transparent'];
  if (namedColors.includes(normalized)) return normalized;
  return fallback;
}

// ── Design fetching ─────────────────────────────────────────────────────

interface NewsletterDesign {
  primaryColor: string;
  fontFamily: string;
  logoUrl: string | null;
  logoSize: string;
  logoAlignment: string;
  bannerUrl: string | null;
  headerMode: string;
  showCompanyName: boolean;
  headerText: string | null;
  footerText: string;
  displayCompanyName: string;
  socialLinks: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string } | null;
}

export async function fetchNewsletterDesign(tenantId: string): Promise<NewsletterDesign> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.tenantId, tenantId),
  });
  const companyName = (company?.name || '').trim();

  const emailDesign = await db.query.masterEmailDesign.findFirst({
    where: sql`${masterEmailDesign.tenantId} = ${tenantId}`,
  });

  let socialLinks: NewsletterDesign['socialLinks'] = null;
  if (emailDesign?.socialLinks) {
    try {
      const parsed = JSON.parse(emailDesign.socialLinks);
      if (parsed && typeof parsed === 'object') socialLinks = parsed;
    } catch { /* ignore */ }
  }

  return {
    primaryColor: sanitizeColor(emailDesign?.primaryColor, '#3B82F6'),
    fontFamily: sanitizeFontFamily(emailDesign?.fontFamily),
    logoUrl: emailDesign?.logoUrl || (company as any)?.logoUrl || null,
    logoSize: emailDesign?.logoSize || 'medium',
    logoAlignment: emailDesign?.logoAlignment || 'center',
    bannerUrl: emailDesign?.bannerUrl || null,
    headerMode: emailDesign?.headerMode || 'logo',
    showCompanyName: (emailDesign?.showCompanyName ?? 'true') === 'true',
    headerText: emailDesign?.headerText || null,
    footerText: emailDesign?.footerText || (companyName ? `© ${new Date().getFullYear()} ${companyName}. All rights reserved.` : ''),
    displayCompanyName: emailDesign?.companyName || companyName,
    socialLinks,
  };
}

// ── Puck data color extraction ───────────────────────────────────────────

/**
 * Extract content and body background colors from stored puckData JSON.
 * Returns undefined values if puckData is missing or invalid.
 */
export function extractPuckColorOverrides(puckDataJson: string | null | undefined): NewsletterColorOverrides | undefined {
  if (!puckDataJson) return undefined;
  try {
    const puckData = JSON.parse(puckDataJson);
    const rootProps = puckData?.root?.props;
    if (!rootProps) return undefined;
    const overrides: NewsletterColorOverrides = {};
    if (rootProps.backgroundColor) overrides.contentBackgroundColor = rootProps.backgroundColor;
    if (rootProps.bodyBackgroundColor) overrides.bodyBackgroundColor = rootProps.bodyBackgroundColor;
    if (rootProps.footerTextColor) overrides.footerTextColor = rootProps.footerTextColor;
    return Object.keys(overrides).length > 0 ? overrides : undefined;
  } catch {
    return undefined;
  }
}

// ── HTML builder ────────────────────────────────────────────────────────

/**
 * Wrap newsletter body HTML in the full branded email template.
 * This must produce identical structure to:
 *  - client/src/utils/email-preview-wrapper.ts  (client preview)
 *  - src/trigger/emailWrapper.ts                (Trigger.dev wrapper)
 *  - the inline template in emailManagementRoutes.ts
 */
function stripOuterHtmlWrapper(html: string): string {
  let content = html.trim();
  content = content.replace(/^<!DOCTYPE\s+html[^>]*>/i, '').trim();
  content = content.replace(/^<html[^>]*>/i, '').replace(/<\/html\s*>$/i, '').trim();
  content = content.replace(/^<head[^>]*>[\s\S]*?<\/head\s*>/i, '').trim();
  content = content.replace(/^<body[^>]*>/i, '').replace(/<\/body\s*>$/i, '').trim();
  return content;
}

/**
 * Add email-compatible inline styles to Tiptap-generated data tables.
 *
 * Puck (classic editor) uses `<table role="presentation">` for layout;
 * those must NOT receive borders/padding.  Only TipTap data tables
 * (which lack role="presentation") get styled.
 *
 * Uses a linear scan with a depth counter to correctly handle nested tables.
 */
function styleTablesForEmail(html: string): string {
  let presDepth = 0;
  let dataDepth = 0;

  html = html.replace(
    /<(\/?)(?:table|td|th)\b[^>]*>/gi,
    (fullTag) => {
      const tagLower = fullTag.toLowerCase();

      if (tagLower.startsWith('</table')) {
        if (presDepth > 0) { presDepth--; return fullTag; }
        if (dataDepth > 0) { dataDepth--; }
        return fullTag;
      }

      if (tagLower.startsWith('<table')) {
        const isPresentation = /role\s*=\s*["']presentation["']/i.test(fullTag);
        if (isPresentation || presDepth > 0) {
          presDepth++;
          return fullTag;
        }
        dataDepth++;
        if (/style\s*=\s*"/i.test(fullTag)) {
          return fullTag.replace(
            /style="([^"]*)"/i,
            (_: string, s: string) => `style="border-collapse: collapse; width: 100%; border-radius: 0; ${s}"`
          );
        }
        return fullTag.replace(/<table/i, '<table style="border-collapse: collapse; width: 100%; border-radius: 0;"');
      }

      if (presDepth > 0) return fullTag;

      // Border defaults to transparent (untouched tables read as "no border");
      // a per-cell `border-color` chosen in the editor is appended after and wins.
      if (dataDepth > 0) {
        if (tagLower.startsWith('<th')) {
          const thStyle = 'border: 1px solid transparent; padding: 8px 12px; text-align: left; background-color: #f3f4f6; font-weight: 600; font-size: 14px; line-height: 1.5; vertical-align: top;';
          if (/style\s*=\s*"/i.test(fullTag)) {
            return fullTag.replace(
              /style="([^"]*)"/i,
              (_: string, s: string) => `style="${thStyle} ${s}"`
            );
          }
          return fullTag.replace(/<th/i, `<th style="${thStyle}"`);
        }
        if (tagLower.startsWith('<td')) {
          const tdStyle = 'border: 1px solid transparent; padding: 8px 12px; font-size: 14px; line-height: 1.5; vertical-align: top;';
          if (/style\s*=\s*"/i.test(fullTag)) {
            return fullTag.replace(
              /style="([^"]*)"/i,
              (_: string, s: string) => `style="${tdStyle} ${s}"`
            );
          }
          return fullTag.replace(/<td/i, `<td style="${tdStyle}"`);
        }
      }

      return fullTag;
    }
  );

  // Second pass: zero-out margins on block elements inside data-table cells.
  html = html.replace(
    /<(t[dh])\b[^>]*border: 1px solid[^>]*>[\s\S]*?<\/\1>/gi,
    (cellBlock) => {
      return cellBlock.replace(
        /<(p|div|ul|ol|h[1-6])(\s[^>]*?)style="([^"]*?)"([^>]*?)>/gi,
        (_m: string, tag: string, before: string, style: string, after: string) =>
          `<${tag}${before}style="margin: 0; padding: 0; ${style}"${after}>`
      ).replace(
        /<(p|div|ul|ol|h[1-6])(?![^>]*style=)(\s[^>]*?)?>/gi,
        (_m: string, tag: string, attrs: string) =>
          `<${tag} style="margin: 0; padding: 0;"${attrs || ''}>`
      );
    }
  );

  return html;
}

/**
 * Constrain images, headings, and block-level elements so they don't overflow
 * the 600px email container.  The Notion-like (TipTap) editor outputs bare
 * <img>, <h1>–<h3>, <p>, etc. without inline max-width, which causes content
 * to burst past the header/footer width in email clients.
 */
function styleContentForEmail(html: string): string {
  // Images: max-width 100%, height auto, display block
  html = html.replace(
    /<img([^>]*?)style="([^"]*?)"([^>]*?)>/gi,
    (match, before, existingStyle, after) => {
      // Skip if already has max-width
      if (/max-width/i.test(existingStyle)) return match;
      const newStyle = `max-width: 100%; height: auto; display: block; ${existingStyle}`;
      return `<img${before}style="${newStyle}"${after}>`;
    }
  );
  html = html.replace(
    /<img(?![^>]*style=)([^>]*?)>/gi,
    '<img style="max-width: 100%; height: auto; display: block;"$1>'
  );

  // Headings h1-h3: word-wrap to prevent long text overflow
  html = html.replace(
    /<(h[1-3])([^>]*?)style="([^"]*?)"([^>]*?)>/gi,
    (match, tag, before, existingStyle, after) => {
      if (/word-wrap|overflow-wrap|word-break/i.test(existingStyle)) return match;
      const newStyle = `word-wrap: break-word; overflow-wrap: break-word; ${existingStyle}`;
      return `<${tag}${before}style="${newStyle}"${after}>`;
    }
  );
  html = html.replace(
    /<(h[1-3])(?![^>]*style=)([^>]*?)>/gi,
    '<$1 style="word-wrap: break-word; overflow-wrap: break-word;"$2>'
  );

  // Divs and paragraphs: word-wrap
  html = html.replace(
    /<(p|div)([^>]*?)style="([^"]*?)"([^>]*?)>/gi,
    (match, tag, before, existingStyle, after) => {
      if (/word-wrap|overflow-wrap|word-break/i.test(existingStyle)) return match;
      const newStyle = `word-wrap: break-word; overflow-wrap: break-word; ${existingStyle}`;
      return `<${tag}${before}style="${newStyle}"${after}>`;
    }
  );

  return html;
}

export interface NewsletterColorOverrides {
  contentBackgroundColor?: string;
  bodyBackgroundColor?: string;
  footerTextColor?: string;
}

export function buildNewsletterEmailHtml(design: NewsletterDesign, bodyContent: string, colorOverrides?: NewsletterColorOverrides): string {
  bodyContent = stripOuterHtmlWrapper(bodyContent);
  bodyContent = styleTablesForEmail(bodyContent);
  bodyContent = styleContentForEmail(bodyContent);
  const fontFamily = design.fontFamily;
  const primaryColor = design.primaryColor;
  const safeCompanyName = escapeHtml(design.displayCompanyName || '');
  const safeHeaderText = design.headerText ? escapeHtml(design.headerText) : null;
  const safeFooterText = design.footerText ? escapeHtml(design.footerText) : null;
  const showName = design.showCompanyName;
  const contentBgColor = sanitizeColor(colorOverrides?.contentBackgroundColor, '#ffffff');
  const bodyBgColor = sanitizeColor(colorOverrides?.bodyBackgroundColor, '#ffffff');
  const footerTextColor = sanitizeColor(colorOverrides?.footerTextColor, '#64748b');

  // Logo sizing
  const logoSizeMap: Record<string, string> = { small: '64px', medium: '96px', large: '128px', xlarge: '160px' };
  const logoHeight = logoSizeMap[design.logoSize] || '96px';
  const logoAlign = design.logoAlignment || 'center';
  const logoML = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? 'auto' : '0';
  const logoMR = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? '0' : 'auto';

  // Header mode
  const useBanner = design.headerMode === 'banner' && design.bannerUrl && isValidHttpUrl(design.bannerUrl);

  // Logo section (non-banner mode)
  const logoSection = design.logoUrl && isValidHttpUrl(design.logoUrl)
    ? `<img class="email-hero-logo" src="${escapeHtml(design.logoUrl)}" alt="${safeCompanyName}" style="display: block; max-height: ${logoHeight}; width: auto; margin: 0 ${logoMR} 20px ${logoML}; object-fit: contain;" />`
    : (safeCompanyName && showName)
      ? `<div style="height: 48px; width: 48px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 ${logoMR} 16px ${logoML}; line-height: 48px; font-size: 20px; font-weight: bold; color: #ffffff; text-align: center;">${escapeHtml((design.displayCompanyName || 'C').charAt(0))}</div>`
      : '';

  // Social links
  let socialLinksHtml = '';
  if (design.socialLinks) {
    const linkStyle = `color: ${footerTextColor}; text-decoration: none; margin: 0 10px; font-weight: 500;`;
    const links: string[] = [];
    if (design.socialLinks.facebook && isValidHttpUrl(design.socialLinks.facebook))
      links.push(`<a href="${escapeHtml(design.socialLinks.facebook)}" style="${linkStyle}">Facebook</a>`);
    if (design.socialLinks.twitter && isValidHttpUrl(design.socialLinks.twitter))
      links.push(`<a href="${escapeHtml(design.socialLinks.twitter)}" style="${linkStyle}">Twitter</a>`);
    if (design.socialLinks.instagram && isValidHttpUrl(design.socialLinks.instagram))
      links.push(`<a href="${escapeHtml(design.socialLinks.instagram)}" style="${linkStyle}">Instagram</a>`);
    if (design.socialLinks.linkedin && isValidHttpUrl(design.socialLinks.linkedin))
      links.push(`<a href="${escapeHtml(design.socialLinks.linkedin)}" style="${linkStyle}">LinkedIn</a>`);
    if (links.length > 0) socialLinksHtml = `<div style="margin-bottom: 24px;">${links.join(' | ')}</div>`;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if mso]>
    <style type="text/css">
      table { border-collapse: collapse; }
      img { display: block; outline: none; border: 0; }
    </style>
    <![endif]-->
    <style type="text/css">
      img { max-width: 100% !important; height: auto !important; }
      /* TipTap data tables carry an inline min-width (sum of column widths)
         that beats max-width/width; neutralize so they can shrink on phones. */
      .email-content table:not([role="presentation"]) { max-width: 100% !important; min-width: 0 !important; }
      .email-content table:not([role="presentation"]) col,
      .email-content table:not([role="presentation"]) td,
      .email-content table:not([role="presentation"]) th { min-width: 0 !important; }
      .email-content td, .email-content th,
      .email-content p, .email-content li, .email-content a,
      .email-content blockquote {
        overflow-wrap: anywhere; word-break: break-word;
      }
      @media screen and (max-width: 480px) {
        .email-hero-header { padding: 24px 18px !important; }
        .email-hero-header-banner { padding: 12px 18px !important; }
        .email-hero-logo { max-height: 72px !important; margin-bottom: 12px !important; }
        .email-hero-title { font-size: 20px !important; line-height: 1.2 !important; letter-spacing: 0 !important; }
        .email-hero-copy { font-size: 14px !important; line-height: 1.4 !important; max-width: 280px !important; }
        .email-content h1 { font-size: 22px !important; line-height: 1.25 !important; }
        .email-content h2 { font-size: 20px !important; line-height: 1.3 !important; }
        .email-content h3 { font-size: 18px !important; line-height: 1.35 !important; }
        /* Collapse authored-width data tables to fit narrow screens
           instead of overflowing — mirrors the editor mobile preview. */
        .email-content table:not([role="presentation"]) { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }
        .email-content table:not([role="presentation"]) col { width: auto !important; min-width: 0 !important; }
        .email-content table:not([role="presentation"]) td,
        .email-content table:not([role="presentation"]) th { width: auto !important; min-width: 0 !important; }
      }
      @media screen and (max-width: 360px) {
        .email-hero-header { padding: 20px 16px !important; }
        .email-hero-header-banner { padding: 10px 16px !important; }
        .email-hero-title { font-size: 18px !important; }
        .email-hero-copy { font-size: 13px !important; }
        .email-content h1 { font-size: 20px !important; }
        .email-content h2 { font-size: 18px !important; }
        .email-content h3 { font-size: 17px !important; }
      }
    </style>
  </head>
  <body style="font-family: ${fontFamily}; margin: 0; padding: 0; background-color: ${bodyBgColor}; -webkit-font-smoothing: antialiased;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="width:600px;"><tr><td><![endif]-->
    <div style="max-width: 600px; margin: 0 auto; background-color: ${contentBgColor}; overflow: hidden;">

      <!-- Hero Header -->
      ${useBanner ? `
      <img src="${escapeHtml(design.bannerUrl!)}" alt="${safeCompanyName}" style="display: block; width: 100%; height: auto; border: 0; outline: none;" />
      ${(safeCompanyName && showName) || safeHeaderText ? `
      <div class="email-hero-header-banner" style="padding: 16px 24px; text-align: center; background-color: ${primaryColor}; color: #ffffff;">
        ${safeCompanyName && showName ? `<h1 class="email-hero-title" style="margin: 0 0 4px 0; font-size: 24px; font-weight: bold; letter-spacing: 0; color: #ffffff; line-height: 1.2;">${safeCompanyName}</h1>` : ''}
        ${safeHeaderText ? `<p class="email-hero-copy" style="margin: 0 auto; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">${safeHeaderText}</p>` : ''}
      </div>
      ` : ''}
      ` : `
      <div class="email-hero-header" style="padding: 40px 24px; text-align: ${logoAlign}; background-color: ${primaryColor}; color: #ffffff;">
        ${logoSection}
        ${safeCompanyName && showName ? `<h1 class="email-hero-title" style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; letter-spacing: 0; color: #ffffff; line-height: 1.2;">${safeCompanyName}</h1>` : ''}
        ${safeHeaderText ? `<p class="email-hero-copy" style="margin: 0 ${logoMR} 0 ${logoML}; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">${safeHeaderText}</p>` : ''}
      </div>
      `}

      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
        <tr>
          <td class="email-content" style="padding: 20px 24px 32px 24px; font-size: 16px; line-height: 1.625; color: #334155; border: none; background-color: ${contentBgColor};">
            ${bodyContent}
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <div style="background-color: ${contentBgColor}; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0; color: ${footerTextColor};">
        ${socialLinksHtml}
        ${safeFooterText ? `<p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.5; color: ${footerTextColor};">${safeFooterText}</p>` : ''}
        ${safeCompanyName && showName ? `
          <div style="font-size: 12px; line-height: 1.5; color: ${footerTextColor}; opacity: 0.7;">
            <p style="margin: 0;">Sent via ${safeCompanyName}</p>
          </div>
        ` : ''}
      </div>

    </div>
    <!--[if mso]></td></tr></table><![endif]-->
  </body>
</html>`;
}

/**
 * Convenience: fetch design + wrap content in one call.
 */
export async function wrapNewsletterContent(tenantId: string, bodyContent: string, colorOverrides?: NewsletterColorOverrides): Promise<string> {
  try {
    const design = await fetchNewsletterDesign(tenantId);
    return buildNewsletterEmailHtml(design, bodyContent, colorOverrides);
  } catch (err) {
    console.error(`⚠️ [wrapNewsletterContent] Failed to wrap email in master design for tenant ${tenantId}, sending unwrapped:`, err);
    return bodyContent;
  }
}
