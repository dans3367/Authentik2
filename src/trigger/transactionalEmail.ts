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
  type: z.enum(["verification", "welcome"]),
  recipientEmail: z.string().email(),
  recipientName: z.string().nullable().optional(),
  /** Required for verification emails */
  verificationToken: z.string().optional(),
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

    const baseUrl = data.baseUrl || process.env.BASE_URL || "http://localhost:5000";
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

        logger.info("Verification URL generated", { verificationUrl, recipientHash });
        break;
      }

      case "welcome": {
        subject = `Welcome to ${appName}! Your account is now verified`;
        htmlContent = buildWelcomeEmailHtml(displayName, baseUrl, appName);
        textContent = buildWelcomeEmailText(displayName, baseUrl, appName);
        break;
      }

      default:
        throw new Error(`Unknown transactional email type: ${data.type}`);
    }

    const result = await sendSESEmail({
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

                <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">If the button doesn't work, copy and paste this link into your browser:</p>
                <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 13px; color: #475569; margin-bottom: 20px;">
                  ${escapeHtml(verificationUrl)}
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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${escapeHtml(appName)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7fafc;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f7fafc;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff;">🎉 Account Verified!</h1>
                <p style="margin: 0; font-size: 16px; opacity: 0.9; color: #ffffff;">Welcome to ${escapeHtml(appName)}</p>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1e293b;">Hi${escapeHtml(displayName)}!</h2>
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                  Congratulations! Your email address has been successfully verified and your account is now fully activated.
                </p>

                <p style="margin: 0 0 12px 0; font-size: 16px; color: #475569;">You can now:</p>
                <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #475569; font-size: 15px; line-height: 2;">
                  <li>Access all features of ${escapeHtml(appName)}</li>
                  <li>Manage your profile and account settings</li>
                  <li>Enable two-factor authentication for extra security</li>
                  <li>Manage your active sessions across devices</li>
                </ul>

                <div style="text-align: center; margin: 28px 0;">
                  <a href="${escapeHtml(baseUrl)}" style="display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);">
                    Go to Dashboard
                  </a>
                </div>

                <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
                  If you have any questions or need help getting started, feel free to reach out to our support team.
                </p>

                <p style="margin: 24px 0 4px 0; font-size: 14px; color: #475569;">Thank you for joining us!</p>
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

function buildWelcomeEmailText(displayName: string, baseUrl: string, appName: string): string {
  return [
    `Hi${displayName}!`,
    "",
    `Congratulations! Your email address has been successfully verified and your account is now fully activated.`,
    "",
    `You can now:`,
    `- Access all features of ${appName}`,
    `- Manage your profile and account settings`,
    `- Enable two-factor authentication for extra security`,
    `- Manage your active sessions across devices`,
    "",
    `Go to Dashboard: ${baseUrl}`,
    "",
    `Thank you for joining us!`,
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
