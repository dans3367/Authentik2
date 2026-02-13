/**
 * Client-side email wrapper that mirrors the server-side buildEmailHtml()
 * from src/trigger/emailWrapper.ts. Used to show an accurate preview of
 * how the newsletter will look when received in an email client.
 */

export interface PreviewEmailDesign {
  primaryColor?: string;
  companyName?: string;
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
  logoSize?: string;
  showCompanyName?: string;
  fontFamily?: string;
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
  headerText: '',
  footerText: '',
  logoUrl: '',
  logoSize: 'medium',
  showCompanyName: 'true',
  fontFamily: 'Arial, Helvetica, sans-serif',
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
  const safeBodyContent = sanitizeBodyContent(bodyContent);
  const sanitizedLogoUrl = d.logoUrl && isValidHttpUrl(d.logoUrl) ? d.logoUrl : '';

  const logoSection = sanitizedLogoUrl
    ? `<img src="${esc(sanitizedLogoUrl)}" alt="${companyName}" style="display:block;height:${logoHeight};width:auto;margin:0 auto 20px auto;object-fit:contain;" />`
    : (companyName && showName)
      ? `<div style="height:48px;width:48px;background-color:rgba(255,255,255,0.2);border-radius:50%;margin:0 auto 16px auto;line-height:48px;font-size:20px;font-weight:bold;color:#ffffff;text-align:center;">${esc(d.companyName.charAt(0))}</div>`
      : '';

  // Build social links HTML
  let socialLinksHtml = '';
  if (socialLinks) {
    const linkStyle = "color:#64748b;text-decoration:none;margin:0 10px;font-weight:500;";
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
    body { margin: 0; padding: 0; }
    img { max-width: 100%; }
    * { box-sizing: border-box; }
  </style>
</head>
<body style="font-family:${fontFamily};margin:0;padding:0;background-color:#f7fafc;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;background:white;">

    <!-- Hero Header -->
    <div style="padding:40px 32px;text-align:center;background-color:${primaryColor};color:#ffffff;">
      ${logoSection}
      ${companyName && showName ? `<h1 style="margin:0 0 10px 0;font-size:24px;font-weight:bold;letter-spacing:-0.025em;color:#ffffff;">${companyName}</h1>` : ''}
      ${headerText ? `<p style="margin:0 auto;font-size:16px;opacity:0.95;max-width:400px;line-height:1.5;color:#ffffff;">${headerText}</p>` : ''}
    </div>

    <!-- Body Content -->
    <div style="padding:24px 20px;min-height:200px;">
      <div style="font-size:16px;line-height:1.625;color:#334155;">
        ${safeBodyContent}
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color:#f8fafc;padding:32px;text-align:center;border-top:1px solid #e2e8f0;color:#64748b;">
      ${socialLinksHtml}
      ${footerText ? `<p style="margin:0 0 16px 0;font-size:12px;line-height:1.5;color:#64748b;">${footerText}</p>` : ''}
      ${companyName && showName ? `<div style="font-size:12px;line-height:1.5;color:#94a3b8;"><p style="margin:0;">Sent via ${companyName}</p></div>` : ''}
    </div>

  </div>
</body>
</html>`;
}
