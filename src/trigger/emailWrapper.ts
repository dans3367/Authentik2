import { logger } from "@trigger.dev/sdk/v3";
import { createHmac } from "crypto";

/**
 * Email design settings returned from the internal API
 */
export interface EmailDesign {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerMode: string | null;
  logoUrl: string | null;
  logoSize: string | null;
  logoAlignment: string | null;
  bannerUrl: string | null;
  showCompanyName: string | null;
  headerText: string | null;
  footerText: string | null;
  socialLinks: string | null;
  companyName: string;
}

/**
 * Sanitize CSS color value to prevent CSS injection.
 * Only allows valid hex colors, RGB(A), HSL(A), and named colors.
 * Rejects any value containing semicolons, url(), or other injection vectors.
 */
function sanitizeColor(color: string | undefined | null, fallback: string = '#3B82F6'): string {
  if (!color) return fallback;

  const normalized = color.trim().toLowerCase();

  // Validate hex colors (#RGB, #RRGGBB, #RRGGBBAA)
  const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/;
  if (hexPattern.test(normalized)) {
    return normalized;
  }

  // Validate RGB/RGBA
  const rgbPattern = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
  const rgbMatch = normalized.match(rgbPattern);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    if (parseInt(r) <= 255 && parseInt(g) <= 255 && parseInt(b) <= 255) {
      return normalized;
    }
  }

  // Validate HSL/HSLA
  const hslPattern = /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
  const hslMatch = normalized.match(hslPattern);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    if (parseInt(h) <= 360 && parseInt(s) <= 100 && parseInt(l) <= 100) {
      return normalized;
    }
  }

  // Whitelist of safe CSS named colors
  const namedColors = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
    'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
    'teal', 'aqua', 'maroon', 'olive', 'silver', 'fuchsia', 'transparent'
  ];

  if (namedColors.includes(normalized)) {
    return normalized;
  }

  // If no valid pattern matched, return fallback
  logger.warn(`Invalid color format rejected: ${color}`);
  return fallback;
}

/**
 * Sanitize font family to prevent CSS injection.
 * Only allows known safe font stacks.
 */
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

/**
 * Escape HTML characters to prevent injection
 */
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

/**
 * Validate that a URL is HTTP/HTTPS
 */
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch the master email design for a tenant via the internal API
 */
export async function fetchEmailDesign(tenantId: string): Promise<EmailDesign | null> {
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  if (!secret) {
    logger.warn("INTERNAL_SERVICE_SECRET not configured, cannot fetch email design");
    return null;
  }

  const timestamp = Date.now();
  const body = {};
  const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
  const signature = createHmac('sha256', secret).update(signaturePayload).digest('hex');

  try {
    const response = await fetch(`${apiUrl}/api/internal/email-design/${tenantId}`, {
      method: 'GET',
      headers: {
        'x-internal-service': 'trigger.dev',
        'x-internal-timestamp': timestamp.toString(),
        'x-internal-signature': signature,
      },
    });

    if (!response.ok) {
      logger.warn(`Failed to fetch email design: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.success && data.design) {
      return data.design as EmailDesign;
    }

    return null;
  } catch (err) {
    logger.warn(`Error fetching email design: ${err}`);
    return null;
  }
}

/**
 * Wrap email body content in the tenant's master email design template.
 * Falls back to a clean default design if the master design can't be fetched.
 *
 * @param tenantId - The tenant ID to fetch design for
 * @param bodyContent - The inner HTML content (will be placed in the body section)
 * @returns Full HTML email string
 */
export async function wrapInEmailDesign(tenantId: string, bodyContent: string): Promise<string> {
  const design = await fetchEmailDesign(tenantId);

  if (!design) {
    // Fallback: return content wrapped in a minimal clean layout
    return buildEmailHtml({
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      accentColor: '#10B981',
      fontFamily: 'Arial, sans-serif',
      headerMode: 'logo',
      logoUrl: null,
      logoSize: null,
      logoAlignment: 'center',
      bannerUrl: null,
      showCompanyName: 'true',
      headerText: null,
      footerText: '',
      socialLinks: null,
      companyName: '',
    }, bodyContent);
  }

  return buildEmailHtml(design, bodyContent);
}

/**
 * Build the full HTML email using the design settings and body content
 */
function buildEmailHtml(design: EmailDesign, bodyContent: string): string {
  // Sanitize all user-controlled values
  const fontFamily = sanitizeFontFamily(design.fontFamily);
  const sanitizedPrimaryColor = sanitizeColor(design.primaryColor, '#3B82F6');
  const sanitizedSecondaryColor = sanitizeColor(design.secondaryColor, '#1E40AF');
  const sanitizedAccentColor = sanitizeColor(design.accentColor, '#10B981');

  const safeCompanyName = escapeHtml(design.companyName || '');
  const safeHeaderText = design.headerText ? escapeHtml(design.headerText) : null;
  const safeFooterText = design.footerText ? escapeHtml(design.footerText) : null;
  const showCompanyName = (design.showCompanyName ?? 'true') === 'true';

  // Build social links HTML
  let socialLinksHtml = '';
  if (design.socialLinks) {
    try {
      const parsed = typeof design.socialLinks === 'string'
        ? JSON.parse(design.socialLinks)
        : design.socialLinks;

      if (parsed && typeof parsed === 'object') {
        const links: string[] = [];
        const linkStyle = "color: #64748b; text-decoration: none; margin: 0 10px; font-weight: 500;";

        if (parsed.facebook && isValidHttpUrl(parsed.facebook)) {
          links.push(`<a href="${escapeHtml(parsed.facebook)}" style="${linkStyle}">Facebook</a>`);
        }
        if (parsed.twitter && isValidHttpUrl(parsed.twitter)) {
          links.push(`<a href="${escapeHtml(parsed.twitter)}" style="${linkStyle}">Twitter</a>`);
        }
        if (parsed.instagram && isValidHttpUrl(parsed.instagram)) {
          links.push(`<a href="${escapeHtml(parsed.instagram)}" style="${linkStyle}">Instagram</a>`);
        }
        if (parsed.linkedin && isValidHttpUrl(parsed.linkedin)) {
          links.push(`<a href="${escapeHtml(parsed.linkedin)}" style="${linkStyle}">LinkedIn</a>`);
        }

        if (links.length > 0) {
          socialLinksHtml = `<div style="margin-bottom: 24px;">${links.join(' | ')}</div>`;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Determine header mode
  const headerMode = design.headerMode || 'logo';
  const useBanner = headerMode === 'banner' && design.bannerUrl && isValidHttpUrl(design.bannerUrl);

  // Build logo/header section (used when headerMode is 'logo')
  const logoSizeMap: Record<string, string> = { small: '64px', medium: '96px', large: '128px', xlarge: '160px' };
  const logoHeight = logoSizeMap[design.logoSize || 'medium'] || '48px';
  const logoAlign = design.logoAlignment || 'center';
  const logoMarginLeft = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? 'auto' : '0';
  const logoMarginRight = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? '0' : 'auto';
  const logoSection = design.logoUrl && isValidHttpUrl(design.logoUrl)
    ? `<img src="${escapeHtml(design.logoUrl)}" alt="${safeCompanyName}" style="display: block; height: ${logoHeight}; width: auto; margin: 0 ${logoMarginRight} 20px ${logoMarginLeft}; object-fit: contain;" />`
    : (safeCompanyName && showCompanyName)
      ? `<div style="height: 48px; width: 48px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 ${logoMarginRight} 16px ${logoMarginLeft}; line-height: 48px; font-size: 20px; font-weight: bold; color: #ffffff; text-align: center;">${escapeHtml((design.companyName || 'C').charAt(0))}</div>`
      : '';

  // Build banner section (used when headerMode is 'banner')
  const bannerSection = useBanner
    ? `<img src="${escapeHtml(design.bannerUrl!)}" alt="${safeCompanyName}" style="display: block; width: 100%; height: auto; border: 0; outline: none;" />`
    : '';

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
      ${bannerSection}
      ${(safeCompanyName && showCompanyName) || safeHeaderText ? `
      <div style="padding: 16px 32px; text-align: center; background-color: ${sanitizedPrimaryColor}; color: #ffffff;">
        ${safeCompanyName && showCompanyName ? `
          <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: bold; letter-spacing: -0.025em; color: #ffffff;">
            ${safeCompanyName}
          </h1>
        ` : ''}
        ${safeHeaderText ? `
          <p style="margin: 0 auto; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">
            ${safeHeaderText}
          </p>
        ` : ''}
      </div>
      ` : ''}
      ` : `
      <div style="padding: 40px 32px; text-align: ${logoAlign}; background-color: ${sanitizedPrimaryColor}; color: #ffffff;">
        ${logoSection}
        ${safeCompanyName && showCompanyName ? `
          <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; letter-spacing: -0.025em; color: #ffffff;">
            ${safeCompanyName}
          </h1>
        ` : ''}
        ${safeHeaderText ? `
          <p style="margin: 0 ${logoMarginRight} 0 ${logoMarginLeft}; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">
            ${safeHeaderText}
          </p>
        ` : ''}
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
        
        ${safeFooterText ? `
          <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.5; color: #64748b;">${safeFooterText}</p>
        ` : ''}
        
        ${safeCompanyName && (design.showCompanyName ?? 'true') === 'true' ? `
          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">
            <p style="margin: 0;">
              Sent via ${safeCompanyName}
            </p>
          </div>
        ` : ''}
      </div>
      
    </div>
  </body>
</html>`.trim();
}
