/**
 * Sparkle Cake Birthday e‑card template
 *
 * Generates responsive, email‑client‑friendly HTML that features a large
 * birthday image (the provided cake photo), elegant headline text, and a
 * short message. All styles are inlined for maximum compatibility.
 */

export interface SparkleCakeEcardParams {
  recipientName?: string;
  message?: string;
  imageUrl: string; // URL of the provided birthday image
  primaryColor?: string; // accents and buttons
  textColor?: string; // body text color
  backgroundColor?: string; // email background
}

/**
 * Render a single‑column HTML email. Designed to look great in Gmail, Outlook,
 * Apple Mail, and most mobile clients. Uses tables and inlined CSS.
 */
export function renderSparkleCakeEcard({
  recipientName = 'Friend',
  message = 'Wishing you a day filled with joy, laughter, and sweet memories! 🎂',
  imageUrl,
  primaryColor = '#111827',
  textColor = '#374151',
  backgroundColor = '#F9FAFB',
}: SparkleCakeEcardParams): string {
  const headline = `Happy Birthday, ${escapeHtml(recipientName)}!`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Happy Birthday</title>
    <style>
      /* Fallbacks for some clients that respect <style> */
      @media only screen and (max-width: 600px) {
        .container { width: 100% !important; }
        .inner { padding: 20px !important; }
        .hero-img { height: auto !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:${backgroundColor}; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${backgroundColor};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" class="container" style="width:600px; max-width:100%; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <tr>
              <td>
                <!-- Hero Image -->
                <img src="${escapeHtml(imageUrl)}" alt="Happy Birthday" width="600" style="display:block; width:100%; height:auto; line-height:0; border:0;" class="hero-img" />
              </td>
            </tr>
            <tr>
              <td class="inner" style="padding:32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; color:${textColor};">
                <!-- Headline -->
                <h1 style="margin:0 0 12px 0; font-size:28px; line-height:1.2; color:${primaryColor}; font-weight:800;">
                  ${headline}
                </h1>

                <!-- Subtext -->
                <p style="margin:0 0 20px 0; font-size:16px; line-height:1.6;">
                  ${escapeHtml(message)}
                </p>

                <!-- Divider -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                  <tr>
                    <td style="height:1px; background:#E5E7EB; line-height:1px; font-size:0;">&nbsp;</td>
                  </tr>
                </table>

                <!-- Signature -->
                <p style="margin:0; font-size:14px; color:#6B7280;">
                  With warm wishes,<br/>
                  <strong>Your friends at {{brand_name}}</strong>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
 </html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default renderSparkleCakeEcard;


