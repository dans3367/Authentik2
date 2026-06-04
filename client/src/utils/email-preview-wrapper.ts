/**
 * Client-side email wrapper that mirrors the server-side buildEmailHtml()
 * from src/trigger/emailWrapper.ts. Used to show an accurate preview of
 * how the newsletter will look when received in an email client.
 */

export interface PreviewEmailDesign {
  primaryColor?: string;
  companyName?: string;
  headerMode?: string;
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
  logoSize?: string;
  logoAlignment?: string;
  bannerUrl?: string;
  showCompanyName?: string;
  fontFamily?: string;
  contentBackgroundColor?: string;
  bodyBackgroundColor?: string;
  footerTextColor?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

const DEFAULT_DESIGN: Required<Omit<PreviewEmailDesign, 'socialLinks'>> & { socialLinks?: PreviewEmailDesign['socialLinks'] } = {
  primaryColor: '#3B82F6',
  companyName: '',
  headerMode: 'logo',
  headerText: '',
  footerText: '',
  logoUrl: '',
  logoSize: 'medium',
  logoAlignment: 'center',
  bannerUrl: '',
  showCompanyName: 'true',
  fontFamily: 'Arial, Helvetica, sans-serif',
  contentBackgroundColor: '#ffffff',
  bodyBackgroundColor: '#f7fafc',
  footerTextColor: '#64748b',
  socialLinks: undefined,
};

const LOGO_SIZE_MAP: Record<string, string> = {
  small: '64px',
  medium: '96px',
  large: '128px',
  xlarge: '160px',
};

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

function sanitizeColor(color: string | undefined | null, fallback: string = '#3B82F6'): string {
  if (!color) return fallback;

  const normalized = color.trim().toLowerCase();
  const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/;
  if (hexPattern.test(normalized)) {
    return normalized;
  }

  const rgbPattern = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
  const rgbMatch = normalized.match(rgbPattern);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    if (parseInt(r) <= 255 && parseInt(g) <= 255 && parseInt(b) <= 255) {
      return normalized;
    }
  }

  const hslPattern = /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
  const hslMatch = normalized.match(hslPattern);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    if (parseInt(h) <= 360 && parseInt(s) <= 100 && parseInt(l) <= 100) {
      return normalized;
    }
  }

  const namedColors = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
    'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
    'teal', 'aqua', 'maroon', 'olive', 'silver', 'fuchsia', 'transparent',
  ];

  if (namedColors.includes(normalized)) {
    return normalized;
  }

  return fallback;
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
  const match = allowedFonts.find((font) => font.toLowerCase() === normalized.toLowerCase());
  return match || 'Arial, sans-serif';
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function esc(str: string): string {
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

/**
 * Add email-compatible inline styles to Tiptap-generated data tables.
 * Mirrors server-side styleTablesForEmail() in newsletterEmailWrapper.ts.
 *
 * Puck (classic editor) uses `<table role="presentation">` for layout;
 * those must NOT receive borders/padding.  Only TipTap data tables
 * (which lack role="presentation") get styled.
 *
 * Uses a linear scan with a depth counter to correctly handle nested tables.
 */
function styleTablesForEmail(html: string): string {
  // Track nesting depth inside presentation tables.
  // When presDepth > 0 we are inside a layout table and must not add borders.
  let presDepth = 0;
  // Also track whether we're inside a data table (for margin zeroing)
  let dataDepth = 0;

  // Match every table-related opening/closing tag in one pass
  html = html.replace(
    /<(\/?)(?:table|td|th)\b[^>]*>/gi,
    (fullTag) => {
      const tagLower = fullTag.toLowerCase();

      // ── Closing tags: adjust depth ──
      if (tagLower.startsWith('</table')) {
        if (presDepth > 0) { presDepth--; return fullTag; }
        if (dataDepth > 0) { dataDepth--; }
        return fullTag;
      }

      // ── Opening <table> ──
      if (tagLower.startsWith('<table')) {
        const isPresentation = /role\s*=\s*["']presentation["']/i.test(fullTag);
        if (isPresentation || presDepth > 0) {
          presDepth++;
          return fullTag;
        }
        // Data table
        dataDepth++;
        // Add border-collapse and width
        if (/style\s*=\s*"/i.test(fullTag)) {
          return fullTag.replace(
            /style="([^"]*)"/i,
            (_: string, s: string) => `style="border-collapse: collapse; width: 100%; border-radius: 0; ${s}"`
          );
        }
        return fullTag.replace(/<table/i, '<table style="border-collapse: collapse; width: 100%; border-radius: 0;"');
      }

      // Inside a presentation table → don't touch td/th
      if (presDepth > 0) return fullTag;

      // Inside a data table → style td/th. The border defaults to transparent
      // (so untouched tables read as "no border"); a per-cell `border-color`
      // chosen in the editor is appended after and overrides it.
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
  // Data table cells now have the injected "border: 1px solid" marker so we
  // can identify them without nesting logic.
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

function sanitizeBodyContent(html: string): string {
  if (!html) {
    return '';
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const forbiddenTags = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'];

  forbiddenTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === 'href' || name === 'src') {
        try {
          const parsed = new URL(value, window.location.origin);
          if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
            el.removeAttribute(attr.name);
          }
        } catch {
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  return doc.body.innerHTML;
}

/**
 * Wrap newsletter body HTML in the full email template, matching the
 * server-side wrapper so the preview is accurate.
 */
export function wrapInEmailPreview(
  bodyContent: string,
  design: PreviewEmailDesign = {},
): string {
  const d = { ...DEFAULT_DESIGN, ...design };
  const fontFamily = sanitizeFontFamily(d.fontFamily);
  const primaryColor = sanitizeColor(d.primaryColor, DEFAULT_DESIGN.primaryColor);
  const companyName = esc(d.companyName);
  const headerText = d.headerText ? esc(d.headerText) : '';
  const footerText = d.footerText ? esc(d.footerText) : '';
  const socialLinks = d.socialLinks;
  const logoSizeKey = d.logoSize && LOGO_SIZE_MAP[d.logoSize] ? d.logoSize : DEFAULT_DESIGN.logoSize;
  const logoHeight = LOGO_SIZE_MAP[logoSizeKey] || '48px';
  const showName = typeof d.showCompanyName === 'boolean'
    ? d.showCompanyName
    : (d.showCompanyName ?? 'true') === 'true';
  const contentBgColor = sanitizeColor(d.contentBackgroundColor, '#ffffff');
  const bodyBgColor = sanitizeColor(d.bodyBackgroundColor, '#f7fafc');
  const footerTextColor = sanitizeColor(d.footerTextColor, '#64748b');
  const safeBodyContent = styleTablesForEmail(sanitizeBodyContent(bodyContent));
  const sanitizedLogoUrl = d.logoUrl && isValidHttpUrl(d.logoUrl) ? d.logoUrl : '';
  const sanitizedBannerUrl = d.bannerUrl && isValidHttpUrl(d.bannerUrl) ? d.bannerUrl : '';
  const headerMode = d.headerMode || 'logo';
  const useBanner = headerMode === 'banner' && !!sanitizedBannerUrl;
  const logoAlign = d.logoAlignment || 'center';
  const logoML = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? 'auto' : '0';
  const logoMR = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? '0' : 'auto';

  const logoSection = sanitizedLogoUrl
    ? `<img class="email-hero-logo" src="${esc(sanitizedLogoUrl)}" alt="${companyName}" style="display:block;max-height:${logoHeight};width:auto;margin:0 ${logoMR} 20px ${logoML};object-fit:contain;" />`
    : (companyName && showName)
      ? `<div style="height:48px;width:48px;background-color:rgba(255,255,255,0.2);border-radius:50%;margin:0 ${logoMR} 16px ${logoML};line-height:48px;font-size:20px;font-weight:bold;color:#ffffff;text-align:center;">${esc(d.companyName.charAt(0))}</div>`
      : '';

  // Build social links HTML
  let socialLinksHtml = '';
  if (socialLinks) {
    const linkStyle = `color:${footerTextColor};text-decoration:none;margin:0 10px;font-weight:500;`;
    const links: string[] = [];
    if (socialLinks.facebook && isValidHttpUrl(socialLinks.facebook)) {
      links.push(`<a href="${esc(socialLinks.facebook)}" style="${linkStyle}">Facebook</a>`);
    }
    if (socialLinks.twitter && isValidHttpUrl(socialLinks.twitter)) {
      links.push(`<a href="${esc(socialLinks.twitter)}" style="${linkStyle}">Twitter</a>`);
    }
    if (socialLinks.instagram && isValidHttpUrl(socialLinks.instagram)) {
      links.push(`<a href="${esc(socialLinks.instagram)}" style="${linkStyle}">Instagram</a>`);
    }
    if (socialLinks.linkedin && isValidHttpUrl(socialLinks.linkedin)) {
      links.push(`<a href="${esc(socialLinks.linkedin)}" style="${linkStyle}">LinkedIn</a>`);
    }
    if (links.length > 0) {
      socialLinksHtml = `<div style="margin-bottom:24px;">${links.join(' | ')}</div>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Reset for email-like rendering inside iframe */
    html, body { margin: 0; padding: 0; height: 100%; }
    img { max-width: 100%; }
    * { box-sizing: border-box; }
    /* Match editor table cell spacing */
    td p, td div, td ul, td ol, td h1, td h2, td h3, td h4, td h5, td h6,
    th p, th div, th ul, th ol, th h1, th h2, th h3, th h4, th h5, th h6 {
      margin: 0;
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
<body style="font-family:${fontFamily};margin:0;padding:0;background-color:${bodyBgColor};-webkit-font-smoothing:antialiased;min-height:100%;">
  <div style="background-color:${bodyBgColor};min-height:100%;padding:0;">
    <div style="max-width:600px;margin:0 auto;background-color:${contentBgColor};overflow:hidden;">

    <!-- Hero Header -->
    ${useBanner ? `
    <img src="${esc(sanitizedBannerUrl)}" alt="${companyName}" style="display:block;width:100%;height:auto;border:0;outline:none;" />
    ${(companyName && showName) || headerText ? `
    <div class="email-hero-header-banner" style="padding:16px 24px;text-align:center;background-color:${primaryColor};color:#ffffff;">
      ${companyName && showName ? `<h1 class="email-hero-title" style="margin:0 0 4px 0;font-size:24px;font-weight:bold;letter-spacing:0;color:#ffffff;line-height:1.2;">${companyName}</h1>` : ''}
      ${headerText ? `<p class="email-hero-copy" style="margin:0 auto;font-size:16px;opacity:0.95;max-width:400px;line-height:1.5;color:#ffffff;">${headerText}</p>` : ''}
    </div>
    ` : ''}
    ` : `
    <div class="email-hero-header" style="padding:40px 24px;text-align:${logoAlign};background-color:${primaryColor};color:#ffffff;">
      ${logoSection}
      ${companyName && showName ? `<h1 class="email-hero-title" style="margin:0 0 10px 0;font-size:24px;font-weight:bold;letter-spacing:0;color:#ffffff;line-height:1.2;">${companyName}</h1>` : ''}
      ${headerText ? `<p class="email-hero-copy" style="margin:0 ${logoMR} 0 ${logoML};font-size:16px;opacity:0.95;max-width:400px;line-height:1.5;color:#ffffff;">${headerText}</p>` : ''}
    </div>
    `}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
      <tr>
        <td class="email-content" style="padding:20px 24px 32px 24px;font-size:16px;line-height:1.625;color:#334155;border:none;background-color:${contentBgColor};vertical-align:top;">
          ${safeBodyContent}
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="background-color:${contentBgColor};padding:32px;text-align:center;border-top:1px solid #e2e8f0;color:${footerTextColor};">
      ${socialLinksHtml}
      ${footerText ? `<p style="margin:0 0 16px 0;font-size:12px;line-height:1.5;color:${footerTextColor};">${footerText}</p>` : ''}
      ${companyName && showName ? `<div style="font-size:12px;line-height:1.5;color:${footerTextColor};opacity:0.7;"><p style="margin:0;">Sent via ${companyName}</p></div>` : ''}
    </div>

    </div>
  </div>
</body>
</html>`;
}
