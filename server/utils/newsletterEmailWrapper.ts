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
    'Arial, Helvetica, sans-serif',
    'Georgia, serif',
    'Tahoma, Geneva, sans-serif',
    'Verdana, Geneva, sans-serif',
    'Times New Roman, Times, serif',
    'Courier New, Courier, monospace',
    'Trebuchet MS, Helvetica, sans-serif',
    'Impact, Charcoal, sans-serif',
    'Lucida Console, Monaco, monospace',
    'Arial, sans-serif',
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
  const namedColors = ['black','white','red','green','blue','yellow','orange','purple','pink','brown','gray','grey','cyan','magenta','lime','navy','teal','aqua','maroon','olive','silver','fuchsia','transparent'];
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

// ── HTML builder ────────────────────────────────────────────────────────

/**
 * Wrap newsletter body HTML in the full branded email template.
 * This must produce identical structure to:
 *  - client/src/utils/email-preview-wrapper.ts  (client preview)
 *  - src/trigger/emailWrapper.ts                (Trigger.dev wrapper)
 *  - the inline template in emailManagementRoutes.ts
 */
export function buildNewsletterEmailHtml(design: NewsletterDesign, bodyContent: string): string {
  const fontFamily = design.fontFamily;
  const primaryColor = design.primaryColor;
  const safeCompanyName = escapeHtml(design.displayCompanyName || '');
  const safeHeaderText = design.headerText ? escapeHtml(design.headerText) : null;
  const safeFooterText = design.footerText ? escapeHtml(design.footerText) : null;
  const showName = design.showCompanyName;

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
    ? `<img src="${escapeHtml(design.logoUrl)}" alt="${safeCompanyName}" style="display: block; height: ${logoHeight}; width: auto; margin: 0 ${logoMR} 20px ${logoML}; object-fit: contain;" />`
    : (safeCompanyName && showName)
      ? `<div style="height: 48px; width: 48px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 ${logoMR} 16px ${logoML}; line-height: 48px; font-size: 20px; font-weight: bold; color: #ffffff; text-align: center;">${escapeHtml((design.displayCompanyName || 'C').charAt(0))}</div>`
      : '';

  // Social links
  let socialLinksHtml = '';
  if (design.socialLinks) {
    const linkStyle = "color: #64748b; text-decoration: none; margin: 0 10px; font-weight: 500;";
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
  </head>
  <body style="font-family: ${fontFamily}; margin: 0; padding: 0; background-color: #f7fafc; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">

      <!-- Hero Header -->
      ${useBanner ? `
      <div style="padding: 0 24px;">
        <img src="${escapeHtml(design.bannerUrl!)}" alt="${safeCompanyName}" style="display: block; width: 100%; height: auto; border: 0; outline: none;" />
      </div>
      ${(safeCompanyName && showName) || safeHeaderText ? `
      <div style="padding: 16px 24px; text-align: center; background-color: ${primaryColor}; color: #ffffff;">
        ${safeCompanyName && showName ? `<h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: bold; letter-spacing: -0.025em; color: #ffffff;">${safeCompanyName}</h1>` : ''}
        ${safeHeaderText ? `<p style="margin: 0 auto; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">${safeHeaderText}</p>` : ''}
      </div>
      ` : ''}
      ` : `
      <div style="padding: 40px 24px; text-align: ${logoAlign}; background-color: ${primaryColor}; color: #ffffff;">
        ${logoSection}
        ${safeCompanyName && showName ? `<h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; letter-spacing: -0.025em; color: #ffffff;">${safeCompanyName}</h1>` : ''}
        ${safeHeaderText ? `<p style="margin: 0 ${logoMR} 0 ${logoML}; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">${safeHeaderText}</p>` : ''}
      </div>
      `}

      <!-- Body Content -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="padding: 0; font-size: 16px; line-height: 1.625; color: #334155;">
            ${bodyContent}
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b;">
        ${socialLinksHtml}
        ${safeFooterText ? `<p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.5; color: #64748b;">${safeFooterText}</p>` : ''}
        ${safeCompanyName && showName ? `
          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">
            <p style="margin: 0;">Sent via ${safeCompanyName}</p>
          </div>
        ` : ''}
      </div>

    </div>
  </body>
</html>`;
}

/**
 * Convenience: fetch design + wrap content in one call.
 */
export async function wrapNewsletterContent(tenantId: string, bodyContent: string): Promise<string> {
  const design = await fetchNewsletterDesign(tenantId);
  return buildNewsletterEmailHtml(design, bodyContent);
}
