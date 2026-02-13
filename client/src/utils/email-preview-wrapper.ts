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
 * Wrap newsletter body HTML in the full email template, matching the
 * server-side wrapper so the preview is accurate.
 */
export function wrapInEmailPreview(
  bodyContent: string,
  design: PreviewEmailDesign = {},
): string {
  const d = { ...DEFAULT_DESIGN, ...design };
  const fontFamily = d.fontFamily;
  const primaryColor = d.primaryColor;
  const companyName = esc(d.companyName);
  const headerText = d.headerText ? esc(d.headerText) : '';
  const footerText = d.footerText ? esc(d.footerText) : '';
  const socialLinks = d.socialLinks;
  const logoHeight = LOGO_SIZE_MAP[d.logoSize || 'medium'] || '48px';
  const showName = (d.showCompanyName ?? 'true') === 'true';

  const logoSection = d.logoUrl
    ? `<img src="${esc(d.logoUrl)}" alt="${companyName}" style="height:${logoHeight};width:auto;margin-bottom:20px;object-fit:contain;" />`
    : companyName
      ? `<div style="height:48px;width:48px;background-color:rgba(255,255,255,0.2);border-radius:50%;margin:0 auto 16px auto;line-height:48px;font-size:20px;font-weight:bold;color:#ffffff;text-align:center;">${esc(d.companyName.charAt(0))}</div>`
      : '';

  // Build social links HTML
  let socialLinksHtml = '';
  if (socialLinks) {
    const linkStyle = "color:#64748b;text-decoration:none;margin:0 10px;font-weight:500;";
    const links: string[] = [];
    if (socialLinks.facebook) links.push(`<a href="${esc(socialLinks.facebook)}" style="${linkStyle}">Facebook</a>`);
    if (socialLinks.twitter) links.push(`<a href="${esc(socialLinks.twitter)}" style="${linkStyle}">Twitter</a>`);
    if (socialLinks.instagram) links.push(`<a href="${esc(socialLinks.instagram)}" style="${linkStyle}">Instagram</a>`);
    if (socialLinks.linkedin) links.push(`<a href="${esc(socialLinks.linkedin)}" style="${linkStyle}">LinkedIn</a>`);
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
    <div style="padding:48px 40px;min-height:200px;">
      <div style="font-size:16px;line-height:1.625;color:#334155;">
        ${bodyContent}
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color:#f8fafc;padding:32px;text-align:center;border-top:1px solid #e2e8f0;color:#64748b;">
      ${socialLinksHtml}
      ${footerText ? `<p style="margin:0 0 16px 0;font-size:12px;line-height:1.5;color:#64748b;">${footerText}</p>` : ''}
      ${companyName ? `<div style="font-size:12px;line-height:1.5;color:#94a3b8;"><p style="margin:0;">Sent via ${companyName}</p></div>` : ''}
    </div>

  </div>
</body>
</html>`;
}
