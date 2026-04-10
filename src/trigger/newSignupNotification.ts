import { task, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { EMAIL_RETRY_CONFIG, emailSendCatchError } from "./retryStrategy";
import { sendSESEmail } from "./ses";

// ─── Schema ──────────────────────────────────────────────────────────────────

const newSignupNotificationSchema = z.object({
  userName: z.string(),
  userEmail: z.string().email(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  planName: z.string(),
  planPrice: z.string(),
  billingCycle: z.enum(["monthly", "yearly"]),
  signupDate: z.string(),
  /** Optional extras */
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  isFreePlan: z.boolean().optional(),
});

export type NewSignupNotificationPayload = z.infer<typeof newSignupNotificationSchema>;

// ─── Task ────────────────────────────────────────────────────────────────────

export const sendNewSignupNotificationTask = task({
  id: "send-new-signup-notification",
  maxDuration: 60,
  retry: EMAIL_RETRY_CONFIG,
  catchError: emailSendCatchError,
  run: async (payload: NewSignupNotificationPayload) => {
    const data = newSignupNotificationSchema.parse(payload);

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "dan@zendwise.com";
    const appName = process.env.APP_NAME || "Zendwise";
    const fromEmail = process.env.EMAIL_FROM || "noreply@zendwise.com";
    const baseUrl = process.env.BASE_URL || "https://web.zendwise.work";

    const signupDate = new Date(data.signupDate).toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Chicago",
    });

    logger.info("Sending new signup admin notification", {
      userEmail: data.userEmail,
      planName: data.planName,
      tenantName: data.tenantName,
    });

    const subject = `🎉 New Signup: ${data.userName} joined ${appName} (${data.planName})`;

    const htmlContent = buildHtml(data, appName, baseUrl, signupDate, adminEmail);
    const textContent = buildPlainText(data, appName, baseUrl, signupDate);

    const result = await sendSESEmail({
      from: { email: fromEmail, name: `${appName} Notifications` },
      recipients: [{ email: adminEmail }],
      subject,
      html_content: htmlContent,
      text_content: textContent,
      tags: {
        type: "admin-new-signup-notification",
        plan: data.planName.replace(/[^a-zA-Z0-9_\-\.@]/g, "_"),
      },
    });

    const messageId = result.data?.[0]?.id || "unknown";

    logger.info("New signup notification sent", {
      messageId,
      to: adminEmail,
      userEmail: data.userEmail,
    });

    return {
      success: true,
      messageId,
      to: adminEmail,
      sentAt: new Date().toISOString(),
    };
  },
});

// ─── HTML Builder ────────────────────────────────────────────────────────────

function buildHtml(
  data: NewSignupNotificationPayload,
  appName: string,
  baseUrl: string,
  signupDate: string,
  adminEmail: string,
): string {
  const priceLabel = data.isFreePlan
    ? "Free"
    : `$${esc(data.planPrice)}/${data.billingCycle === "yearly" ? "yr" : "mo"}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Signup Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <!-- Header -->
              <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:white;padding:28px;text-align:center;border-radius:12px 12px 0 0;">
                <span style="font-size:36px;display:block;margin-bottom:6px;">🎉</span>
                <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#fff;">New User Signup!</h1>
                <p style="margin:0;font-size:14px;opacity:0.9;color:#e0e7ff;">${esc(appName)} · ${esc(signupDate)}</p>
              </div>

              <!-- Body -->
              <div style="padding:28px 28px 12px;">

                <!-- User Card -->
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin-bottom:16px;">
                  <p style="margin:0 0 4px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">User</p>
                  <p style="margin:0 0 2px 0;font-size:18px;font-weight:700;color:#1e293b;">${esc(data.userName)}</p>
                  <p style="margin:0;font-size:14px;color:#6366f1;font-weight:500;">${esc(data.userEmail)}</p>
                </div>

                <!-- Details Grid -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
                  <tr>
                    <td width="50%" style="padding-right:6px;vertical-align:top;">
                      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#86efac;">Plan</p>
                        <p style="margin:0;font-size:16px;font-weight:700;color:#166534;">${esc(data.planName)}</p>
                        <p style="margin:4px 0 0 0;font-size:13px;color:#22c55e;font-weight:600;">${priceLabel}</p>
                      </div>
                    </td>
                    <td width="50%" style="padding-left:6px;vertical-align:top;">
                      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#93c5fd;">Tenant</p>
                        <p style="margin:0;font-size:16px;font-weight:700;color:#1e40af;">${esc(data.tenantName)}</p>
                        <p style="margin:4px 0 0 0;font-size:12px;color:#60a5fa;font-family:monospace;">${esc(data.tenantSlug)}</p>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Metadata -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
                  ${data.firstName ? `<tr>
                    <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:110px;">Name</td>
                    <td style="padding:6px 0;font-size:13px;color:#334155;font-weight:500;">${esc(data.firstName)}${data.lastName ? " " + esc(data.lastName) : ""}</td>
                  </tr>` : ""}
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:110px;">Billing Cycle</td>
                    <td style="padding:6px 0;font-size:13px;color:#334155;font-weight:500;">${data.billingCycle === "yearly" ? "Annual" : "Monthly"}</td>
                  </tr>
                  ${data.tenantId ? `<tr>
                    <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:110px;">Tenant ID</td>
                    <td style="padding:6px 0;font-size:12px;color:#64748b;font-family:monospace;">${esc(data.tenantId)}</td>
                  </tr>` : ""}
                  ${data.userId ? `<tr>
                    <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:110px;">User ID</td>
                    <td style="padding:6px 0;font-size:12px;color:#64748b;font-family:monospace;">${esc(data.userId)}</td>
                  </tr>` : ""}
                </table>

                <!-- CTA -->
                <div style="text-align:center;margin-bottom:20px;">
                  <a href="${esc(baseUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(99,102,241,0.3);">
                    Open Admin Dashboard &rarr;
                  </a>
                </div>

                <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
                  <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                    This notification was sent to ${esc(adminEmail)} because a new user signed up on ${esc(appName)}.
                  </p>
                </div>
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

// ─── Plain Text Builder ──────────────────────────────────────────────────────

function buildPlainText(
  data: NewSignupNotificationPayload,
  appName: string,
  baseUrl: string,
  signupDate: string,
): string {
  const priceLabel = data.isFreePlan
    ? "Free"
    : `$${data.planPrice}/${data.billingCycle === "yearly" ? "yr" : "mo"}`;

  return [
    `🎉 NEW SIGNUP — ${appName}`,
    "",
    `User: ${data.userName}`,
    `Email: ${data.userEmail}`,
    data.firstName ? `Name: ${data.firstName}${data.lastName ? " " + data.lastName : ""}` : null,
    "",
    `── PLAN ──`,
    `Plan: ${data.planName}`,
    `Price: ${priceLabel}`,
    `Billing: ${data.billingCycle === "yearly" ? "Annual" : "Monthly"}`,
    "",
    `── TENANT ──`,
    `Tenant: ${data.tenantName}`,
    `Slug: ${data.tenantSlug}`,
    data.tenantId ? `Tenant ID: ${data.tenantId}` : null,
    data.userId ? `User ID: ${data.userId}` : null,
    "",
    `Date: ${signupDate}`,
    "",
    `Dashboard: ${baseUrl}`,
  ].filter(Boolean).join("\n");
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str.replace(/[&<>"']/g, (c) => {
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
