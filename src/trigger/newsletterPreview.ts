import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { z } from "zod";
import { wrapInEmailDesign } from "./emailWrapper";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";

const resend = new Resend(process.env.RESEND_API_KEY);

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
 * Send a newsletter preview email via Resend, wrapped in the tenant's email design template.
 */
export const sendNewsletterPreviewTask = task({
  id: "send-newsletter-preview",
  maxDuration: 30,
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: NewsletterPreviewPayload) => {
    const data = previewPayloadSchema.parse(payload);

    logger.info("Sending newsletter preview email", {
      to: data.to,
      subject: data.subject,
      tenantId: data.tenantId,
    });

    try {
      const wrappedHtml = data.wrappedHtml || await wrapInEmailDesign(data.tenantId, data.html);

      // Add a preview banner at the top so recipients know it's a test
      const previewBanner = `<!-- Preview Banner -->
      <div style="background-color: #fef3c7; border-bottom: 2px solid #f59e0b; padding: 12px 24px; text-align: center;">
        <span style="color: #92400e; font-size: 13px; font-weight: 600; font-family: Arial, sans-serif;">
          &#9888; This is a preview email — not sent to your subscribers
        </span>
      </div>
      <!-- Hero Header -->`;
      const heroMarker = "<!-- Hero Header -->";
      let finalHtml: string;

      if (wrappedHtml.includes(heroMarker)) {
        finalHtml = wrappedHtml.replace(heroMarker, previewBanner);
      } else {
        logger.warn("Preview banner marker not found in wrapped HTML; using fallback insertion", {
          tenantId: data.tenantId,
        });

        const bodyMatch = wrappedHtml.match(/<body[^>]*>/i);

        if (bodyMatch) {
          const bodyTag = bodyMatch[0];
          finalHtml = wrappedHtml.replace(bodyTag, `${bodyTag}${previewBanner}`);
        } else {
          finalHtml = `${previewBanner}${wrappedHtml}`;
        }
      }

      const emailTrackingId = randomUUID();
      const { data: emailData, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "admin@zendwise.com",
        to: data.to,
        subject: `[Preview] ${data.subject}`,
        html: finalHtml,
        text: data.html.replace(/<[^>]*>/g, ""),
        tags: [
          { name: "type", value: "newsletter-preview" },
          { name: "tenantId", value: data.tenantId },
          { name: "trackingId", value: emailTrackingId },
        ],
      });

      if (error) {
        logger.error("Failed to send preview email", { error });
        return {
          success: false,
          to: data.to,
          error: error.message,
        };
      }

      logger.info("Preview email sent successfully", {
        emailId: emailData?.id,
        to: data.to,
      });

      return {
        success: true,
        emailId: emailData?.id,
        to: data.to,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending preview email", { error: errorMessage });
      return {
        success: false,
        to: data.to,
        error: errorMessage,
      };
    }
  },
});
