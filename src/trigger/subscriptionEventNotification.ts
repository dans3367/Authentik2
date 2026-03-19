import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";
import { EMAIL_RETRY_CONFIG, emailSendCatchError } from "./retryStrategy";
import { sendAhaEmail } from "./ahasend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

// ─── Schema ──────────────────────────────────────────────────────────────────

const subscriptionEventSchema = z.object({
  eventType: z.enum(["payment_succeeded", "payment_failed", "subscription_cancelled", "subscription_updated"]),
  ownerEmail: z.string().email(),
  ownerName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  planName: z.string(),
  planPrice: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  /** For payment events */
  invoiceAmount: z.string().optional(),
  invoiceUrl: z.string().optional(),
  /** For subscription_updated — what changed */
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  /** Period info */
  periodEnd: z.string().optional(),
});

export type SubscriptionEventPayload = z.infer<typeof subscriptionEventSchema>;

// ─── Task ────────────────────────────────────────────────────────────────────

export const sendSubscriptionEventNotificationTask = task({
  id: "send-subscription-event-notification",
  maxDuration: 60,
  retry: EMAIL_RETRY_CONFIG,
  catchError: emailSendCatchError,
  run: async (payload: SubscriptionEventPayload) => {
    const data = subscriptionEventSchema.parse(payload);

    logger.info("Sending subscription event notification", {
      eventType: data.eventType,
      ownerEmail: data.ownerEmail,
      planName: data.planName,
    });

    const displayName = data.ownerName ? ` ${data.ownerName}` : "";
    const appName = process.env.APP_NAME || "Zendwise";
    const baseURL = process.env.BASE_URL || process.env.FRONTEND_URL || "https://web.zendwise.work";

    const periodEndFormatted = data.periodEnd
      ? new Date(data.periodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : null;

    const config = getEventConfig(data);
    const fullHtml = buildHtml(data, config, displayName, appName, baseURL, periodEndFormatted);
    const plainText = buildPlainText(data, config, displayName, appName, baseURL, periodEndFormatted);
    const fromEmail = process.env.EMAIL_FROM || "admin@zendwise.com";

    try {
      let emailData: any = null;
      let sendError: any = null;

      const { data: resendData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: data.ownerEmail,
        subject: config.subject,
        html: fullHtml,
        text: plainText,
        tags: [
          { name: "type", value: "subscription-event" },
          { name: "eventType", value: data.eventType },
        ],
      });

      emailData = resendData;
      sendError = resendError;

      if (sendError) {
        logger.warn("Resend failed, falling back to AhaSend", { error: sendError.message });
        try {
          const ahaResult = await sendAhaEmail({
            from: { email: fromEmail },
            recipients: [{ email: data.ownerEmail }],
            subject: config.subject,
            html_content: fullHtml,
            text_content: plainText,
          });
          const ahaMessages: any[] = ahaResult?.data || [];
          emailData = { id: ahaMessages[0]?.id || ahaResult.id || "ahasend-sub-event" };
          sendError = null;
        } catch (ahaError) {
          logger.error("AhaSend fallback also failed", {
            error: ahaError instanceof Error ? ahaError.message : String(ahaError),
          });
          sendError = ahaError;
        }
      }

      if (sendError) {
        logger.error("Failed to send via both providers", { error: sendError });
        return { success: false, ownerEmail: data.ownerEmail, eventType: data.eventType, error: sendError.message || String(sendError) };
      }

      logger.info("Subscription event notification sent", { emailId: emailData?.id, eventType: data.eventType });
      return { success: true, emailId: emailData?.id, ownerEmail: data.ownerEmail, eventType: data.eventType, sentAt: new Date().toISOString() };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending subscription event notification", { error: errorMessage });
      return { success: false, ownerEmail: data.ownerEmail, eventType: data.eventType, error: errorMessage };
    }
  },
});

// ─── Event Configuration ─────────────────────────────────────────────────────

interface EventConfig {
  subject: string;
  icon: string;
  title: string;
  subtitle: string;
  gradientStart: string;
  gradientEnd: string;
  bodyText: string;
  statusColor: string;
  statusBg: string;
  statusLabel: string;
  ctaText: string;
  ctaUrl: string;
}

function getEventConfig(data: SubscriptionEventPayload): EventConfig {
  const baseURL = process.env.BASE_URL || process.env.FRONTEND_URL || "https://web.zendwise.work";
  const planName = data.planName;

  switch (data.eventType) {
    case "payment_succeeded":
      return {
        subject: `Payment Received - ${planName} Plan`,
        icon: "✅",
        title: "Payment Successful",
        subtitle: `Your payment for the ${escapeHtml(planName)} plan has been processed`,
        gradientStart: "#10b981",
        gradientEnd: "#059669",
        bodyText: "Your payment has been successfully processed. Your subscription remains active and all features are available.",
        statusColor: "#16a34a",
        statusBg: "#f0fdf4",
        statusLabel: "Active",
        ctaText: "View Billing History",
        ctaUrl: `${baseURL}/subscribe`,
      };
    case "payment_failed":
      return {
        subject: `Action Required: Payment Failed - ${planName} Plan`,
        icon: "⚠️",
        title: "Payment Failed",
        subtitle: `We were unable to process your payment for the ${escapeHtml(planName)} plan`,
        gradientStart: "#ef4444",
        gradientEnd: "#dc2626",
        bodyText: "We were unable to process your latest payment. Please update your payment method to avoid any interruption to your service. Your account has been marked as past due.",
        statusColor: "#dc2626",
        statusBg: "#fef2f2",
        statusLabel: "Past Due",
        ctaText: "Update Payment Method",
        ctaUrl: `${baseURL}/subscribe`,
      };
    case "subscription_cancelled":
      return {
        subject: `Subscription Cancelled - ${planName} Plan`,
        icon: "👋",
        title: "Subscription Cancelled",
        subtitle: `Your ${escapeHtml(planName)} plan has been cancelled`,
        gradientStart: "#6b7280",
        gradientEnd: "#4b5563",
        bodyText: data.cancelAtPeriodEnd
          ? "Your subscription has been set to cancel at the end of the current billing period. You'll continue to have access to all features until then."
          : "Your subscription has been cancelled. You may lose access to premium features.",
        statusColor: "#6b7280",
        statusBg: "#f9fafb",
        statusLabel: "Cancelled",
        ctaText: "Reactivate Subscription",
        ctaUrl: `${baseURL}/subscribe`,
      };
    case "subscription_updated":
      return {
        subject: `Subscription Updated - ${planName} Plan`,
        icon: "🔄",
        title: "Subscription Updated",
        subtitle: `Your ${escapeHtml(planName)} subscription has been updated`,
        gradientStart: "#3b82f6",
        gradientEnd: "#2563eb",
        bodyText: "Your subscription details have been updated. Please review the changes below.",
        statusColor: "#2563eb",
        statusBg: "#eff6ff",
        statusLabel: data.newStatus || "Updated",
        ctaText: "View Subscription",
        ctaUrl: `${baseURL}/subscribe`,
      };
  }
}

// ─── HTML Builder ────────────────────────────────────────────────────────────

function buildHtml(
  data: SubscriptionEventPayload,
  config: EventConfig,
  displayName: string,
  appName: string,
  baseURL: string,
  periodEnd: string | null,
): string {
  // Invoice amount section (for payment events)
  let invoiceSection = "";
  if ((data.eventType === "payment_succeeded" || data.eventType === "payment_failed") && data.invoiceAmount) {
    invoiceSection = `
      <div style="border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding: 20px; background-color: #f8fafc;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Amount</p>
                    <p style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b;">$${escapeHtml(data.invoiceAmount)}</p>
                  </td>
                  <td style="padding: 0; text-align: right; vertical-align: bottom;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Plan</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #475569;">${escapeHtml(data.planName)}</p>
                    ${data.billingCycle ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #94a3b8;">${data.billingCycle}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`;
  }

  // Status badge
  const statusBadge = `
    <div style="background-color: ${config.statusBg}; border: 1px solid ${config.statusColor}22; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">Account Status</p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: ${config.statusColor};">${escapeHtml(config.statusLabel)}</p>
          </td>
          ${periodEnd ? `<td style="text-align: right;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">${data.eventType === "subscription_cancelled" ? "Access Until" : "Next Billing"}</p>
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #475569;">${escapeHtml(periodEnd)}</p>
          </td>` : ""}
        </tr>
      </table>
    </div>`;

  // Invoice link (for payment succeeded)
  let invoiceLinkHtml = "";
  if (data.eventType === "payment_succeeded" && data.invoiceUrl) {
    invoiceLinkHtml = `
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${escapeHtml(data.invoiceUrl)}" style="font-size: 14px; color: #3b82f6; text-decoration: underline;">View Invoice &rarr;</a>
      </div>`;
  }

  // Warning callout for payment failed
  let warningHtml = "";
  if (data.eventType === "payment_failed") {
    warningHtml = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #991b1b;">⚠️ Action Required</p>
        <p style="margin: 0; font-size: 14px; color: #b91c1c; line-height: 1.5;">
          Please update your payment method as soon as possible to avoid service interruption. If the issue persists, your subscription may be suspended.
        </p>
      </div>`;
  }

  // Reactivation note for cancellation
  let reactivateHtml = "";
  if (data.eventType === "subscription_cancelled") {
    reactivateHtml = `
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #374151;">Changed your mind?</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
          You can reactivate your subscription at any time from your account settings. We'll be here when you're ready to come back!
        </p>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <!-- Header -->
              <div style="background: linear-gradient(135deg, ${config.gradientStart} 0%, ${config.gradientEnd} 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <span style="font-size: 36px; display: block; margin-bottom: 8px;">${config.icon}</span>
                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff;">${escapeHtml(config.title)}</h1>
                <p style="margin: 0; font-size: 15px; opacity: 0.9; color: #ffffff;">${config.subtitle}</p>
              </div>

              <!-- Body -->
              <div style="padding: 32px;">
                <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #1e293b;">Hi${escapeHtml(displayName)}!</h2>
                <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                  ${config.bodyText}
                </p>

                ${invoiceSection}
                ${statusBadge}
                ${warningHtml}
                ${invoiceLinkHtml}
                ${reactivateHtml}

                <!-- CTA -->
                <div style="text-align: center; margin-top: 28px;">
                  <a href="${escapeHtml(config.ctaUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${config.gradientStart} 0%, ${config.gradientEnd} 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    ${escapeHtml(config.ctaText)} &rarr;
                  </a>
                </div>

                <p style="margin: 24px 0 0 0; font-size: 13px; color: #94a3b8; text-align: center;">
                  Questions? Reply to this email or visit our support page.
                </p>

                <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                  <p style="margin: 0 0 4px 0; font-size: 14px; color: #475569;">Thank you for being a ${escapeHtml(appName)} customer!</p>
                  <p style="margin: 0; font-size: 14px; color: #475569; font-weight: 600;">The ${escapeHtml(appName)} Team</p>
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
  data: SubscriptionEventPayload,
  config: EventConfig,
  displayName: string,
  appName: string,
  baseURL: string,
  periodEnd: string | null,
): string {
  const lines: string[] = [
    `${config.icon} ${config.title.toUpperCase()}`,
    "",
    `Hi${displayName}!`,
    "",
    config.bodyText,
    "",
    `── DETAILS ──`,
    `Plan: ${data.planName}`,
    `Status: ${config.statusLabel}`,
  ];

  if (data.invoiceAmount) {
    lines.push(`Amount: $${data.invoiceAmount}`);
  }
  if (data.billingCycle) {
    lines.push(`Billing Cycle: ${data.billingCycle}`);
  }
  if (periodEnd) {
    lines.push(`${data.eventType === "subscription_cancelled" ? "Access Until" : "Next Billing"}: ${periodEnd}`);
  }
  if (data.invoiceUrl) {
    lines.push("", `View Invoice: ${data.invoiceUrl}`);
  }

  lines.push(
    "",
    `${config.ctaText}: ${config.ctaUrl}`,
    "",
    `Thank you for being a ${appName} customer!`,
    `The ${appName} Team`,
  );

  return lines.join("\n");
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
