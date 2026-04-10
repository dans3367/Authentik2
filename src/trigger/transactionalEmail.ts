import { task, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { createHash } from "crypto";
import { EMAIL_RETRY_CONFIG, emailSendCatchError } from "./retryStrategy";
import { sendSESEmail } from "./ses";

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 16);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visibleLocal = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visibleLocal}***@${domain}`;
}

/**
 * Schema for transactional email payloads.
 * Supports: verification, welcome, and generic transactional emails.
 */
const transactionalEmailSchema = z.object({
  type: z.enum(["verification", "welcome", "password-reset"]),
  recipientEmail: z.string().email(),
  recipientName: z.string().nullable().optional(),
  /** Required for verification emails */
  verificationToken: z.string().optional(),
  /** Required for password-reset emails */
  resetToken: z.string().optional(),
  /** Base URL of the application (for building links) */
  baseUrl: z.string().optional(),
  /** Application name for branding */
  appName: z.string().optional(),
});

export type TransactionalEmailPayload = z.infer<typeof transactionalEmailSchema>;

/**
 * Send transactional emails (verification, welcome) via Amazon SES.
 *
 * This task is dispatched from the auth signup flow and resend-verification
 * endpoint instead of sending emails synchronously in the request.
 * All transactional emails use the existing Amazon SES configuration.
 */
export const sendTransactionalEmailTask = task({
  id: "send-transactional-email",
  maxDuration: 60,
  retry: EMAIL_RETRY_CONFIG,
  catchError: emailSendCatchError,
  run: async (payload: TransactionalEmailPayload) => {
    const data = transactionalEmailSchema.parse(payload);

    const baseUrl = data.baseUrl || process.env.BASE_URL || "http://localhost:5002";
    const appName = data.appName || process.env.APP_NAME || "Zendwise";
    const fromEmail = "noreply@zendwise.com";
    const displayName = data.recipientName ? ` ${data.recipientName}` : "";

    const recipientHash = hashEmail(data.recipientEmail);

    logger.info("Sending transactional email via SES", {
      type: data.type,
      recipientHash,
    });

    let subject: string;
    let htmlContent: string;
    let textContent: string;

    switch (data.type) {
      case "verification": {
        if (!data.verificationToken) {
          throw new Error("verificationToken is required for verification emails");
        }

        const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(data.verificationToken)}`;

        subject = `Welcome to ${appName} - Please verify your email`;
        htmlContent = buildVerificationEmailHtml(displayName, verificationUrl, appName);
        textContent = buildVerificationEmailText(displayName, verificationUrl, appName);

        logger.info("Verification URL generated", { recipientHash, verificationUrl: verificationUrl.replace(/([?&]token=)[^&]+/, "$1[REDACTED]") });
        break;
      }

      case "welcome": {
        subject = `Welcome to ${appName}! Your account is now verified`;
        htmlContent = buildWelcomeEmailHtml(displayName, baseUrl, appName);
        textContent = buildWelcomeEmailText(displayName, baseUrl, appName);
        break;
      }

      case "password-reset": {
        if (!data.resetToken) {
          throw new Error("resetToken is required for password-reset emails");
        }

        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(data.resetToken)}`;

        subject = `Reset your ${appName} password`;
        htmlContent = buildPasswordResetEmailHtml(displayName, resetUrl, appName);
        textContent = buildPasswordResetEmailText(displayName, resetUrl, appName);

        logger.info("Password reset URL generated", { recipientHash, resetUrl: resetUrl.replace(/([?&]token=)[^&]+/, "$1[REDACTED]") });
        break;
      }

      default:
        throw new Error(`Unknown transactional email type: ${data.type}`);
    }

    let result;
    try {
      result = await sendSESEmail({
        from: {
          email: fromEmail,
          name: appName,
        },
        recipients: [{ email: data.recipientEmail }],
        subject,
        html_content: htmlContent,
        text_content: textContent,
        tags: {
          type: `transactional-${data.type}`,
          recipient: data.recipientEmail,
        },
      });
    } catch (error) {
      logger.error("Failed to send email via SES", { error });
      throw error; // Re-throw to trigger Trigger.dev retries
    }

    const messageId = result.data?.[0]?.id || "unknown";

    logger.info("Transactional email sent via SES", {
      type: data.type,
      messageId,
      to: maskEmail(data.recipientEmail),
    });

    return {
      success: true,
      type: data.type,
      messageId,
      to: data.recipientEmail,
      sentAt: new Date().toISOString(),
    };
  },
});

// ─── HTML Template Generators ────────────────────────────────────────────────

function buildVerificationEmailHtml(displayName: string, verificationUrl: string, appName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7fafc;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f7fafc;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff;">${escapeHtml(appName)}</h1>
                <p style="margin: 0; font-size: 16px; opacity: 0.9; color: #ffffff;">Welcome to our platform!</p>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1e293b;">Hi${escapeHtml(displayName)}!</h2>
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                  Thank you for signing up for ${escapeHtml(appName)}. To complete your registration and start using your account, please verify your email address by clicking the button below:
                </p>

                <div style="text-align: center; margin: 28px 0;">
                  <a href="${escapeHtml(verificationUrl)}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);">
                    Verify Email Address
                  </a>
                </div>

                <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;"><strong>This verification link will expire in 24 hours.</strong></p>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">If you didn't create an account with us, you can safely ignore this email.</p>

                <p style="margin: 24px 0 4px 0; font-size: 14px; color: #475569;">Welcome aboard!</p>
                <p style="margin: 0; font-size: 14px; color: #475569; font-weight: 600;">The ${escapeHtml(appName)} Team</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildVerificationEmailText(displayName: string, verificationUrl: string, appName: string): string {
  return [
    `Hi${displayName}!`,
    "",
    `Thank you for signing up for ${appName}. To complete your registration, please verify your email address by visiting the link below:`,
    "",
    verificationUrl,
    "",
    `This verification link will expire in 24 hours.`,
    "",
    `If you didn't create an account with us, you can safely ignore this email.`,
    "",
    `Welcome aboard!`,
    `The ${appName} Team`,
  ].join("\n");
}

function buildWelcomeEmailHtml(displayName: string, baseUrl: string, appName: string): string {
  const safeName = escapeHtml(displayName);
  const safeBase = escapeHtml(baseUrl);
  const safeApp = escapeHtml(appName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>No. 001 — Welcome to ${safeApp}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: Georgia, 'Times New Roman', serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#ede3ce;font-family:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,'Times New Roman',serif;color:#1c1a17;-webkit-font-smoothing:antialiased;">

  <!-- Preheader (hidden preview text in inbox list) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ede3ce;">
    The presses are warm. Your first edition has arrived — welcome to ${safeApp}.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#ede3ce;">
    <tr>
      <td align="center" style="padding:44px 16px;">

        <!-- THE PAGE -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:#f7efdb;border:1px solid #d9cdad;">

          <!-- Broadsheet top rule: heavy + hairline -->
          <tr>
            <td style="border-top:6px solid #1c1a17;padding:0;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="height:3px;line-height:3px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #1c1a17;padding:0;line-height:0;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Masthead -->
          <tr>
            <td style="padding:26px 44px 20px 44px;border-bottom:1px solid #1c1a17;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle" style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#7d2b2b;font-weight:700;">
                    Vol.&nbsp;I &middot; No.&nbsp;001
                  </td>
                  <td align="right" valign="middle" style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#6b5d4a;font-weight:700;">
                    Delivered by hand
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:42px;line-height:1.02;font-weight:900;letter-spacing:-0.015em;color:#1c1a17;text-align:center;">
                The ${safeApp} Dispatch
              </h1>
              <p style="margin:0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13px;color:#6b5d4a;letter-spacing:0.04em;">
                — A broadside for the people who still believe in the inbox —
              </p>
            </td>
          </tr>

          <!-- Headline / Editor's note -->
          <tr>
            <td style="padding:44px 48px 8px 48px;">
              <p style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:#7d2b2b;font-weight:700;">
                ❧&nbsp;&nbsp;The Welcome&nbsp;&nbsp;❧
              </p>
              <h2 style="margin:0 0 22px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:38px;line-height:1.08;font-weight:800;letter-spacing:-0.018em;color:#1c1a17;">
                Welcome${safeName},<br>
                <span style="font-style:italic;font-weight:400;color:#7d2b2b;">the presses are warm.</span>
              </h2>
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.72;color:#3a342a;">
                Your studio is verified, the ink is mixed, and your audience is waiting at the door. Consider this your first edition — a small ceremony to mark the start of something that, with any luck, will fill a great many inboxes.
              </p>
            </td>
          </tr>

          <!-- Ornamental rule -->
          <tr>
            <td align="center" style="padding:32px 48px 4px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="90" style="border-top:1px solid #1c1a17;line-height:1px;font-size:0;">&nbsp;</td>
                  <td style="padding:0 16px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#7d2b2b;line-height:1;">§</td>
                  <td width="90" style="border-top:1px solid #1c1a17;line-height:1px;font-size:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- In This Issue -->
          <tr>
            <td style="padding:16px 48px 8px 48px;">
              <p style="margin:0 0 22px 0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#6b5d4a;font-weight:700;">
                In This Issue
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="54" valign="top" style="padding:4px 0 22px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:30px;line-height:1;font-style:italic;color:#7d2b2b;font-weight:700;">I.</td>
                  <td valign="top" style="padding:4px 0 22px 0;">
                    <p style="margin:0 0 5px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:16px;font-weight:700;color:#1c1a17;">Compose your first letter.</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:#3a342a;">Open the editor, pour a coffee, and draft something your readers will actually look forward to.</p>
                  </td>
                </tr>
                <tr>
                  <td width="54" valign="top" style="padding:4px 0 22px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:30px;line-height:1;font-style:italic;color:#7d2b2b;font-weight:700;">II.</td>
                  <td valign="top" style="padding:4px 0 22px 0;">
                    <p style="margin:0 0 5px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:16px;font-weight:700;color:#1c1a17;">Gather your subscribers.</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:#3a342a;">Bring your list in from a CSV or a previous provider. We handle the cleanup; you keep the goodwill.</p>
                  </td>
                </tr>
                <tr>
                  <td width="54" valign="top" style="padding:4px 0 4px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:30px;line-height:1;font-style:italic;color:#7d2b2b;font-weight:700;">III.</td>
                  <td valign="top" style="padding:4px 0 4px 0;">
                    <p style="margin:0 0 5px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:16px;font-weight:700;color:#1c1a17;">Verify your sending domain.</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:#3a342a;">A ten-minute chore that earns a lifetime of inboxes. Worth every second.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Broadsheet pull quote -->
          <tr>
            <td style="padding:28px 48px 28px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:3px double #1c1a17;border-bottom:3px double #1c1a17;">
                <tr>
                  <td align="center" style="padding:24px 18px;">
                    <p style="margin:0 0 10px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:20px;line-height:1.35;font-style:italic;color:#1c1a17;">
                      &ldquo;The best newsletters feel like a letter from a friend who happens to know everything.&rdquo;
                    </p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#6b5d4a;font-weight:700;">
                      — From the Editorial Desk
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA: stamped block button -->
          <tr>
            <td align="center" style="padding:4px 48px 36px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1c1a17" style="background-color:#1c1a17;">
                    <a href="${safeBase}" style="display:block;padding:17px 44px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#f7efdb;text-decoration:none;font-weight:700;">
                      Enter the Studio&nbsp;&nbsp;→
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:11px;font-style:italic;color:#6b5d4a;text-align:center;">
                or paste this into your browser:<br>
                <span style="color:#7d2b2b;font-style:normal;">${safeBase}</span>
              </p>
            </td>
          </tr>

          <!-- Broadsheet bottom rule: hairline + heavy -->
          <tr>
            <td style="border-top:1px solid #1c1a17;padding:0;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="height:3px;line-height:3px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="border-top:6px solid #1c1a17;padding:0;line-height:0;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Colophon -->
          <tr>
            <td style="padding:28px 44px 34px 44px;text-align:center;">
              <p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:#6b5d4a;font-weight:700;">Colophon</p>
              <p style="margin:0 0 16px 0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:13px;font-style:italic;color:#3a342a;line-height:1.65;">
                Set in Iowan Old Style &amp; Georgia. Printed with care.<br>
                Signed, — The Editors, ${safeApp}
              </p>
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:10px;color:#8b7e68;letter-spacing:0.06em;line-height:1.7;">
                You are receiving this because you just joined ${safeApp}.<br>
                Questions? Simply reply to this letter — a real person is listening.
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

function buildWelcomeEmailText(displayName: string, baseUrl: string, appName: string): string {
  const name = displayName.trim();
  const greeting = name ? `Welcome, ${name},` : "Welcome,";

  return [
    `THE ${appName.toUpperCase()} DISPATCH`,
    `Vol. I  ·  No. 001  ·  Delivered by hand`,
    `— A broadside for the people who still believe in the inbox —`,
    ``,
    `═══════════════════════════════════════════`,
    ``,
    `❧   THE WELCOME   ❧`,
    ``,
    `${greeting} the presses are warm.`,
    ``,
    `Your studio is verified, the ink is mixed, and your`,
    `audience is waiting at the door. Consider this your`,
    `first edition — a small ceremony to mark the start of`,
    `something that, with any luck, will fill a great many`,
    `inboxes.`,
    ``,
    `                     §`,
    ``,
    `IN THIS ISSUE`,
    ``,
    `  I.  Compose your first letter.`,
    `      Open the editor, pour a coffee, and draft`,
    `      something your readers will actually look`,
    `      forward to.`,
    ``,
    ` II.  Gather your subscribers.`,
    `      Bring your list in from a CSV or a previous`,
    `      provider. We handle the cleanup; you keep`,
    `      the goodwill.`,
    ``,
    `III.  Verify your sending domain.`,
    `      A ten-minute chore that earns a lifetime`,
    `      of inboxes. Worth every second.`,
    ``,
    `═══════════════════════════════════════════`,
    ``,
    `  "The best newsletters feel like a letter from`,
    `   a friend who happens to know everything."`,
    `                       — From the Editorial Desk`,
    ``,
    `═══════════════════════════════════════════`,
    ``,
    `→ ENTER THE STUDIO`,
    `  ${baseUrl}`,
    ``,
    `───────────────────────────────────────────`,
    ``,
    `COLOPHON`,
    `Set in Iowan Old Style & Georgia. Printed with care.`,
    `Signed, — The Editors, ${appName}`,
    ``,
    `You are receiving this because you just joined ${appName}.`,
    `Questions? Simply reply to this letter — a real person`,
    `is listening.`,
  ].join("\n");
}

function buildPasswordResetEmailHtml(displayName: string, resetUrl: string, appName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7fafc;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f7fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h1 style="font-size: 24px; font-weight: 600; color: #1a202c; margin: 0 0 16px;">Reset your password</h1>
              <p style="font-size: 16px; color: #4a5568; margin: 0 0 24px;">Hi${escapeHtml(displayName)}, we received a request to reset your ${escapeHtml(appName)} password. Click the button below to choose a new password.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="background-color: #4f46e5; border-radius: 6px;">
                    <a href="${escapeHtml(resetUrl)}" style="display: inline-block; padding: 12px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #718096; margin: 0 0 8px;">This link will expire in 1 hour.</p>
              <p style="font-size: 14px; color: #718096; margin: 0 0 8px;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              <p style="font-size: 12px; color: #a0aec0; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #4f46e5; word-break: break-all; margin: 4px 0 0;">${escapeHtml(resetUrl)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPasswordResetEmailText(displayName: string, resetUrl: string, appName: string): string {
  return [
    `Hi${displayName},`,
    "",
    `We received a request to reset your ${appName} password.`,
    "",
    `Click the link below to choose a new password:`,
    resetUrl,
    "",
    `This link will expire in 1 hour.`,
    "",
    `If you didn't request a password reset, you can safely ignore this email.`,
    "",
    `The ${appName} Team`,
  ].join("\n");
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c: string) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}
