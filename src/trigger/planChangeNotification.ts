import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";
import { EMAIL_RETRY_CONFIG, emailSendCatchError } from "./retryStrategy";
import { sendAhaEmail } from "./ahasend";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

// ─── Schema ──────────────────────────────────────────────────────────────────

const planFeatureChangeSchema = z.object({
  name: z.string(),
  oldValue: z.union([z.string(), z.number(), z.null()]).optional(),
  newValue: z.union([z.string(), z.number(), z.null()]).optional(),
});

const planChangeNotificationSchema = z.object({
  /** "upgrade" | "downgrade" */
  changeType: z.enum(["upgrade", "downgrade"]),

  /** Account owner info */
  ownerEmail: z.string().email(),
  ownerName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),

  /** Plan details */
  previousPlanName: z.string(),
  newPlanName: z.string(),
  previousPrice: z.string(),
  newPrice: z.string(),
  billingCycle: z.enum(["monthly", "yearly"]),

  /** When changes take effect */
  effectiveDate: z.string(),
  /** End of the new billing period */
  periodEndDate: z.string().optional(),

  /** Feature-level changes (optional enrichment) */
  featureChanges: z.array(planFeatureChangeSchema).optional(),

  /** Resources suspended on downgrade */
  suspendedShops: z.number().optional(),
  suspendedUsers: z.number().optional(),

  /** Resources restored on upgrade */
  restoredShops: z.number().optional(),
  restoredUsers: z.number().optional(),
});

export type PlanChangeNotificationPayload = z.infer<typeof planChangeNotificationSchema>;

// ─── Task ────────────────────────────────────────────────────────────────────

/**
 * Send a notification email to the account owner when their subscription
 * plan is upgraded or downgraded. Includes a summary of the changes and
 * when they take effect.
 */
export const sendPlanChangeNotificationTask = task({
  id: "send-plan-change-notification",
  maxDuration: 60,
  retry: EMAIL_RETRY_CONFIG,
  catchError: emailSendCatchError,
  run: async (payload: PlanChangeNotificationPayload) => {
    const data = planChangeNotificationSchema.parse(payload);

    logger.info("Sending plan change notification", {
      changeType: data.changeType,
      ownerEmail: data.ownerEmail,
      previousPlan: data.previousPlanName,
      newPlan: data.newPlanName,
    });

    const isUpgrade = data.changeType === "upgrade";
    const displayName = data.ownerName ? ` ${data.ownerName}` : "";
    const companyLabel = data.companyName ? ` for ${escapeHtml(data.companyName)}` : "";
    const appName = process.env.APP_NAME || "Zendwise";
    const baseURL = process.env.BASE_URL || process.env.FRONTEND_URL || "https://web.zendwise.work";

    const effectiveDate = new Date(data.effectiveDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const periodEnd = data.periodEndDate
      ? new Date(data.periodEndDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      : null;

    // Choose theme based on upgrade vs downgrade
    const gradientStart = isUpgrade ? "#667eea" : "#f97316";
    const gradientEnd = isUpgrade ? "#764ba2" : "#ea580c";
    const headerIcon = isUpgrade ? "🚀" : "📦";
    const headerTitle = isUpgrade ? "Plan Upgraded!" : "Plan Changed";
    const headerSubtitle = isUpgrade
      ? `Your subscription${companyLabel} has been upgraded`
      : `Your subscription${companyLabel} has been adjusted`;

    const subject = isUpgrade
      ? `${headerIcon} Your plan has been upgraded to ${data.newPlanName}`
      : `${headerIcon} Your plan has been changed to ${data.newPlanName}`;

    // Build feature changes rows
    let featureChangesHtml = "";
    if (data.featureChanges && data.featureChanges.length > 0) {
      const rows = data.featureChanges
        .map(
          (fc) => `
          <tr>
            <td style="padding: 10px 12px; font-size: 14px; color: #475569; border-bottom: 1px solid #f1f5f9;">
              ${escapeHtml(fc.name)}
            </td>
            <td style="padding: 10px 12px; font-size: 14px; color: #94a3b8; text-align: center; border-bottom: 1px solid #f1f5f9;">
              ${fc.oldValue !== null && fc.oldValue !== undefined ? escapeHtml(String(fc.oldValue)) : "—"}
            </td>
            <td style="padding: 10px 12px; font-size: 14px; color: #1e293b; font-weight: 600; text-align: center; border-bottom: 1px solid #f1f5f9;">
              ${fc.newValue !== null && fc.newValue !== undefined ? escapeHtml(String(fc.newValue)) : "—"}
            </td>
          </tr>`
        )
        .join("");

      featureChangesHtml = `
        <div style="margin-top: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #1e293b;">📋 What's Changing</h3>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; text-align: left;">Feature</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; text-align: center;">Before</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; text-align: center;">After</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    // Resource changes (suspended or restored)
    let resourceChangesHtml = "";
    if (isUpgrade && (data.restoredShops || data.restoredUsers)) {
      const items: string[] = [];
      if (data.restoredShops) items.push(`${data.restoredShops} shop(s) restored`);
      if (data.restoredUsers) items.push(`${data.restoredUsers} user(s) reactivated`);
      resourceChangesHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px; margin-top: 20px;">
          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #166534;">✅ Resources Restored</p>
          <p style="margin: 0; font-size: 14px; color: #15803d;">${items.join(" · ")}</p>
        </div>`;
    } else if (!isUpgrade && (data.suspendedShops || data.suspendedUsers)) {
      const items: string[] = [];
      if (data.suspendedShops) items.push(`${data.suspendedShops} shop(s) suspended`);
      if (data.suspendedUsers) items.push(`${data.suspendedUsers} user(s) deactivated`);
      resourceChangesHtml = `
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px 20px; margin-top: 20px;">
          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #92400e;">⚠️ Resources Adjusted</p>
          <p style="margin: 0; font-size: 14px; color: #b45309;">${items.join(" · ")}</p>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #b45309;">These resources exceeded your new plan's limits and have been temporarily suspended. You can reactivate them by upgrading your plan.</p>
        </div>`;
    }

    // Effective date section
    const effectiveDateHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-top: 20px;">
        <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">📅 Effective Date</p>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">${escapeHtml(effectiveDate)}</p>
        ${periodEnd ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">Your ${escapeHtml(data.billingCycle)} billing period renews on <strong>${escapeHtml(periodEnd)}</strong>.</p>` : ""}
      </div>`;

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headerTitle)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <!-- Header -->
              <div style="background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <span style="font-size: 36px; display: block; margin-bottom: 8px;">${headerIcon}</span>
                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff;">${escapeHtml(headerTitle)}</h1>
                <p style="margin: 0; font-size: 15px; opacity: 0.9; color: #ffffff;">${headerSubtitle}</p>
              </div>

              <!-- Body -->
              <div style="padding: 32px;">
                <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #1e293b;">Hi${escapeHtml(displayName)}!</h2>
                <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                  ${isUpgrade
        ? `Great news! Your subscription has been successfully upgraded. Here's a summary of the changes:`
        : `Your subscription plan has been changed. Here's a summary of what's been updated:`}
                </p>

                <!-- Plan Change Summary Card -->
                <div style="border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 4px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="50%" style="padding: 20px; background-color: #fef2f2; text-align: center; vertical-align: top;">
                        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Previous Plan</p>
                        <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #64748b;">${escapeHtml(data.previousPlanName)}</p>
                        <p style="margin: 0; font-size: 14px; color: #94a3b8;">$${escapeHtml(data.previousPrice)}/${data.billingCycle === "yearly" ? "yr" : "mo"}</p>
                      </td>
                      <td width="50%" style="padding: 20px; background-color: ${isUpgrade ? "#f0fdf4" : "#fff7ed"}; text-align: center; vertical-align: top;">
                        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${isUpgrade ? "#16a34a" : "#ea580c"};">New Plan</p>
                        <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #1e293b;">${escapeHtml(data.newPlanName)}</p>
                        <p style="margin: 0; font-size: 14px; color: ${isUpgrade ? "#16a34a" : "#ea580c"}; font-weight: 600;">$${escapeHtml(data.newPrice)}/${data.billingCycle === "yearly" ? "yr" : "mo"}</p>
                      </td>
                    </tr>
                  </table>
                </div>

                ${featureChangesHtml}
                ${resourceChangesHtml}
                ${effectiveDateHtml}

                <!-- CTA -->
                <div style="text-align: center; margin-top: 28px;">
                  <a href="${escapeHtml(baseURL)}/subscribe" style="display: inline-block; background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    View My Subscription →
                  </a>
                </div>

                <!-- Help Text -->
                <p style="margin: 24px 0 0 0; font-size: 13px; color: #94a3b8; text-align: center;">
                  Questions about your plan? Reply to this email or visit our support page.
                </p>

                <!-- Sign-off -->
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

    const plainText = buildPlainText(data, displayName, effectiveDate, periodEnd, appName, baseURL);
    const fromEmail = process.env.EMAIL_FROM || "admin@zendwise.com";

    try {
      let emailData: any = null;
      let sendError: any = null;

      const { data: resendData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: data.ownerEmail,
        subject,
        html: fullHtml,
        text: plainText,
        tags: [
          { name: "type", value: "plan-change-notification" },
          { name: "changeType", value: data.changeType },
          { name: "newPlan", value: sanitizeTag(data.newPlanName) },
        ],
      });

      emailData = resendData;
      sendError = resendError;

      if (sendError) {
        logger.warn("Resend failed for plan change notification, falling back to AhaSend", {
          error: sendError.message,
          to: data.ownerEmail,
        });

        try {
          const ahaResult = await sendAhaEmail({
            from: { email: fromEmail },
            recipients: [{ email: data.ownerEmail }],
            subject,
            html_content: fullHtml,
            text_content: plainText,
          });
          const ahaMessages: any[] = ahaResult?.data || [];
          emailData = { id: ahaMessages[0]?.id || ahaResult.id || "ahasend-plan-change-notification" };
          sendError = null;
        } catch (ahaError) {
          logger.error("AhaSend fallback also failed for plan change notification", {
            error: ahaError instanceof Error ? ahaError.message : String(ahaError),
          });
          sendError = ahaError;
        }
      }

      if (sendError) {
        logger.error("Failed to send plan change notification via both providers", { error: sendError });
        return {
          success: false,
          ownerEmail: data.ownerEmail,
          changeType: data.changeType,
          error: sendError.message || String(sendError),
        };
      }

      logger.info("Plan change notification sent successfully", {
        emailId: emailData?.id,
        ownerEmail: data.ownerEmail,
        changeType: data.changeType,
        previousPlan: data.previousPlanName,
        newPlan: data.newPlanName,
      });

      return {
        success: true,
        emailId: emailData?.id,
        ownerEmail: data.ownerEmail,
        changeType: data.changeType,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending plan change notification", { error: errorMessage });
      return {
        success: false,
        ownerEmail: data.ownerEmail,
        changeType: data.changeType,
        error: errorMessage,
      };
    }
  },
});

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Strip any characters not allowed in Resend tag values (ASCII letters, numbers, underscores, dashes). */
function sanitizeTag(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

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

function buildPlainText(
  data: PlanChangeNotificationPayload,
  displayName: string,
  effectiveDate: string,
  periodEnd: string | null,
  appName: string,
  baseURL: string,
): string {
  const isUpgrade = data.changeType === "upgrade";
  const lines: string[] = [
    isUpgrade ? "🚀 PLAN UPGRADED" : "📦 PLAN CHANGED",
    "",
    `Hi${displayName}!`,
    "",
    isUpgrade
      ? "Great news! Your subscription has been successfully upgraded."
      : "Your subscription plan has been changed.",
    "",
    "── PLAN SUMMARY ──",
    `Previous Plan: ${data.previousPlanName} ($${data.previousPrice}/${data.billingCycle === "yearly" ? "yr" : "mo"})`,
    `New Plan:      ${data.newPlanName} ($${data.newPrice}/${data.billingCycle === "yearly" ? "yr" : "mo"})`,
    "",
    `Effective Date: ${effectiveDate}`,
  ];

  if (periodEnd) {
    lines.push(`Next Billing Date: ${periodEnd}`);
  }

  if (data.featureChanges && data.featureChanges.length > 0) {
    lines.push("", "── WHAT'S CHANGING ──");
    for (const fc of data.featureChanges) {
      lines.push(`• ${fc.name}: ${fc.oldValue ?? "—"} → ${fc.newValue ?? "—"}`);
    }
  }

  if (isUpgrade && (data.restoredShops || data.restoredUsers)) {
    lines.push("", "── RESOURCES RESTORED ──");
    if (data.restoredShops) lines.push(`• ${data.restoredShops} shop(s) restored`);
    if (data.restoredUsers) lines.push(`• ${data.restoredUsers} user(s) reactivated`);
  }

  if (!isUpgrade && (data.suspendedShops || data.suspendedUsers)) {
    lines.push("", "── RESOURCES ADJUSTED ──");
    if (data.suspendedShops) lines.push(`• ${data.suspendedShops} shop(s) suspended`);
    if (data.suspendedUsers) lines.push(`• ${data.suspendedUsers} user(s) deactivated`);
    lines.push("These resources exceeded your new plan's limits. Upgrade to reactivate them.");
  }

  lines.push(
    "",
    `View your subscription: ${baseURL}/subscribe`,
    "",
    `Thank you for being a ${appName} customer!`,
    `The ${appName} Team`,
  );

  return lines.join("\n");
}
