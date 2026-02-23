import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { z } from "zod";
import { wrapInEmailDesign } from "./emailWrapper";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";
import { sendSESEmail } from "./ses";
import { sendAhaEmail } from "./ahasend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

const previewPayloadSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  wrappedHtml: z.string().optional(),
  tenantId: z.string(),
  requestedBy: z.string().optional(),
});

export type NewsletterPreviewPayload = z.infer<typeof previewPayloadSchema>;

/**
 * Inject the yellow preview banner at the top of the wrapped email HTML.
 */
function injectPreviewBanner(wrappedHtml: string): string {
  const previewBanner = `<!-- Preview Banner -->
      <div style="background-color: #fef3c7; border-bottom: 2px solid #f59e0b; padding: 12px 24px; text-align: center;">
        <span style="color: #92400e; font-size: 13px; font-weight: 600; font-family: Arial, sans-serif;">
          &#9888; This is a preview email — not sent to your subscribers
        </span>
      </div>
      <!-- Hero Header -->`;

  const heroMarker = "<!-- Hero Header -->";

  if (wrappedHtml.includes(heroMarker)) {
    return wrappedHtml.replace(heroMarker, previewBanner);
  }

  // Fallback: inject right after <body> tag
  const bodyMatch = wrappedHtml.match(/<body[^>]*>/i);
  if (bodyMatch) {
    return wrappedHtml.replace(bodyMatch[0], `${bodyMatch[0]}${previewBanner}`);
  }

  return `${previewBanner}${wrappedHtml}`;
}

/**
 * Send a newsletter preview email.
 * Uses the same provider fallback chain as the main newsletter send:
 *   1. Resend (primary)
 *   2. Amazon SES (first fallback)
 *   3. AhaSend (second fallback)
 */
export const sendNewsletterPreviewTask = task({
  id: "send-newsletter-preview",
  maxDuration: 60,
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: NewsletterPreviewPayload) => {
    const data = previewPayloadSchema.parse(payload);

    logger.info("Sending newsletter preview email", {
      to: data.to,
      subject: data.subject,
      tenantId: data.tenantId,
    });

    const wrappedHtml = data.wrappedHtml || await wrapInEmailDesign(data.tenantId, data.html);
    const finalHtml = injectPreviewBanner(wrappedHtml);
    const previewSubject = `[Preview] ${data.subject}`;
    const textContent = data.html.replace(/<[^>]*>/g, "");
    const fromEmail = process.env.EMAIL_FROM || "admin@zendwise.com";
    const emailTrackingId = randomUUID();
    const tags = [
      { name: "type", value: "newsletter-preview" },
      { name: "tenantId", value: data.tenantId },
      { name: "trackingId", value: emailTrackingId },
    ];

    // ── 1. Try Resend ──────────────────────────────────────────────────
    try {
      const { data: emailData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: data.to,
        subject: previewSubject,
        html: finalHtml,
        text: textContent,
        tags,
      });

      if (!resendError) {
        logger.info("Preview email sent via Resend", {
          emailId: emailData?.id,
          to: data.to,
        });
        return {
          success: true,
          provider: "resend",
          emailId: emailData?.id,
          to: data.to,
          sentAt: new Date().toISOString(),
        };
      }

      logger.warn("Resend failed for preview email, falling back to SES", {
        error: resendError.message,
        to: data.to,
      });
    } catch (resendErr) {
      logger.warn("Resend threw an exception for preview email, falling back to SES", {
        error: resendErr instanceof Error ? resendErr.message : String(resendErr),
        to: data.to,
      });
    }

    // ── 2. Try Amazon SES ──────────────────────────────────────────────
    try {
      const sesResult = await sendSESEmail({
        from: { email: fromEmail },
        recipients: [{ email: data.to }],
        subject: previewSubject,
        html_content: finalHtml,
        text_content: textContent,
        tags: {
          type: "newsletter-preview",
          tenantId: data.tenantId,
          trackingId: emailTrackingId,
        },
      });

      const sesMessages: any[] = sesResult?.data || [];
      const sesMsg = sesMessages.find(
        (m: any) => m?.recipient?.email?.toLowerCase() === data.to.toLowerCase()
      );
      const sesId = sesMsg?.id || "ses-preview-success";

      logger.info("Preview email sent via SES", {
        emailId: sesId,
        to: data.to,
      });

      return {
        success: true,
        provider: "ses",
        emailId: sesId,
        to: data.to,
        sentAt: new Date().toISOString(),
      };
    } catch (sesErr) {
      logger.warn("SES failed for preview email, falling back to AhaSend", {
        error: sesErr instanceof Error ? sesErr.message : String(sesErr),
        to: data.to,
      });
    }

    // ── 3. Try AhaSend ─────────────────────────────────────────────────
    try {
      const ahaResult = await sendAhaEmail({
        from: { email: fromEmail },
        recipients: [{ email: data.to }],
        subject: previewSubject,
        html_content: finalHtml,
        text_content: textContent,
      });

      const ahaMessages: any[] = ahaResult?.data || [];
      const ahaMsg = ahaMessages.find(
        (m: any) => m?.recipient?.email?.toLowerCase() === data.to.toLowerCase()
      );
      const ahaId = ahaMsg?.id || ahaResult?.id || ahaResult?.message_id || "ahasend-preview-success";

      logger.info("Preview email sent via AhaSend", {
        emailId: ahaId,
        to: data.to,
      });

      return {
        success: true,
        provider: "ahasend",
        emailId: ahaId,
        to: data.to,
        sentAt: new Date().toISOString(),
      };
    } catch (ahaErr) {
      const errorMessage = ahaErr instanceof Error ? ahaErr.message : String(ahaErr);
      logger.error("All providers failed for preview email (Resend, SES, AhaSend)", {
        error: errorMessage,
        to: data.to,
      });

      return {
        success: false,
        to: data.to,
        error: `All email providers failed. Last error: ${errorMessage}`,
      };
    }
  },
});
