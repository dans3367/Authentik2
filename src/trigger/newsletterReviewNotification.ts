import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";
import { sendAhaEmail } from "./ahasend";
import { wrapInEmailDesign } from "./emailWrapper";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

// Schema for the review notification payload
const reviewNotificationSchema = z.object({
  newsletterId: z.string(),
  newsletterTitle: z.string(),
  newsletterSubject: z.string(),
  newsletterContent: z.string(), // The HTML content of the newsletter
  tenantId: z.string(),
  // The person who submitted the newsletter
  submitterName: z.string(),
  submitterEmail: z.string(),
  // The designated reviewer
  reviewerEmail: z.string(),
  reviewerName: z.string(),
  // When it was submitted
  submittedAt: z.string(),
  // 5-digit approval code for verification
  approvalCode: z.string().length(5),
});

export type ReviewNotificationPayload = z.infer<typeof reviewNotificationSchema>;

/**
 * Send a notification email to the designated reviewer when a newsletter
 * is submitted for review. Includes a preview of the newsletter content
 * and a direct link to approve or reject.
 */
export const sendReviewNotificationTask = task({
  id: "send-newsletter-review-notification",
  maxDuration: 60,
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: ReviewNotificationPayload) => {
    const data = reviewNotificationSchema.parse(payload);

    logger.info("Sending newsletter review notification", {
      newsletterId: data.newsletterId,
      reviewerEmail: data.reviewerEmail,
      submitterEmail: data.submitterEmail,
    });

    // Build the review link — use production URL when running in Trigger.dev cloud
    const apiUrl = process.env.API_URL;
    const baseUrl = (!apiUrl || apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1"))
      ? "https://web.zendwise.work"
      : apiUrl;

    const reviewLink = `${baseUrl}/newsletters/${data.newsletterId}?reviewer=true&code=${data.approvalCode}`;
    const submittedDate = new Date(data.submittedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Build the notification email body (this will be wrapped in the tenant's email design)
    const notificationBody = `
      <div style="padding: 32px;">
        <!-- Review Request Header -->
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px; padding: 24px 28px; margin-bottom: 28px; color: #ffffff;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <span style="font-size: 24px;">📋</span>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Newsletter Review Requested</h2>
          </div>
          <p style="margin: 0; font-size: 14px; opacity: 0.9; color: #ffffff;">A newsletter is waiting for your approval before it can be sent.</p>
        </div>

        <!-- Newsletter Info Card -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">Newsletter Title</span>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #1e293b;">${escapeHtml(data.newsletterTitle)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">Subject Line</span>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">${escapeHtml(data.newsletterSubject)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">Submitted By</span>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">${escapeHtml(data.submitterName)} (${escapeHtml(data.submitterEmail)})</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">Submitted At</span>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">${escapeHtml(submittedDate)}</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${reviewLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);">
            Review &amp; Approve Newsletter →
           </a>
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #94a3b8;">Click the button above to review the newsletter content, then approve or reject it.</p>
        </div>

        <!-- Approval Code Box -->
        <div style="background-color: #fffbeb; border: 2px dashed #f59e0b; border-radius: 10px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #92400e;">Your Approval Code</p>
          <p style="margin: 0; font-size: 36px; font-weight: 800; letter-spacing: 0.15em; color: #d97706; font-family: 'Courier New', monospace;">${data.approvalCode}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #b45309;">Enter this code on the review page to approve and send the newsletter.</p>
        </div>

        <!-- Newsletter Content Preview -->
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">📧 Newsletter Preview</h3>
          <div style="border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #f1f5f9; padding: 8px 16px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 12px; color: #64748b; font-weight: 500;">Subject: ${escapeHtml(data.newsletterSubject)}</span>
            </div>
            <div style="padding: 20px; max-height: 600px; overflow: hidden;">
              ${data.newsletterContent}
            </div>
            <div style="background-color: #f1f5f9; padding: 10px 16px; border-top: 1px solid #e2e8f0; text-align: center;">
              <a href="${reviewLink}" style="font-size: 13px; color: #3b82f6; text-decoration: none; font-weight: 500;">View full newsletter in browser →</a>
            </div>
          </div>
        </div>

        <!-- Footer note -->
        <div style="text-align: center; padding: 16px 0; border-top: 1px solid #f1f5f9;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            You're receiving this because you've been designated as a newsletter reviewer for your organization.
          </p>
        </div>
      </div>
    `;

    // Wrap in the tenant's email design
    const fullHtml = await wrapInEmailDesign(data.tenantId, notificationBody);

    const fromEmail = process.env.EMAIL_FROM || "admin@zendwise.com";
    const subject = `📋 Review Requested: "${data.newsletterTitle}"`;

    try {
      let emailData: any = null;
      let sendError: any = null;

      const { data: resendData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: data.reviewerEmail,
        subject,
        html: fullHtml,
        text: buildPlainText(data, reviewLink, submittedDate),
        tags: [
          { name: "type", value: "review-notification" },
          { name: "newsletterId", value: data.newsletterId },
          { name: "tenantId", value: data.tenantId },
        ],
      });

      emailData = resendData;
      sendError = resendError;

      if (sendError) {
        logger.warn("Resend failed for review notification, falling back to AhaSend", {
          error: sendError.message,
          to: data.reviewerEmail,
        });

        try {
          const ahaResult = await sendAhaEmail({
            from: { email: fromEmail },
            recipients: [{ email: data.reviewerEmail }],
            subject,
            html_content: fullHtml,
            text_content: buildPlainText(data, reviewLink, submittedDate),
          });
          const ahaMessages: any[] = ahaResult?.data || [];
          emailData = { id: ahaMessages[0]?.id || ahaResult.id || 'ahasend-review-notification' };
          sendError = null;
        } catch (ahaError) {
          logger.error("AhaSend fallback also failed for review notification", {
            error: ahaError instanceof Error ? ahaError.message : String(ahaError),
          });
          sendError = ahaError;
        }
      }

      if (sendError) {
        logger.error("Failed to send review notification via both providers", { error: sendError });
        return {
          success: false,
          newsletterId: data.newsletterId,
          reviewerEmail: data.reviewerEmail,
          error: sendError.message || String(sendError),
        };
      }

      logger.info("Review notification sent successfully", {
        emailId: emailData?.id,
        reviewerEmail: data.reviewerEmail,
        newsletterId: data.newsletterId,
      });

      return {
        success: true,
        emailId: emailData?.id,
        newsletterId: data.newsletterId,
        reviewerEmail: data.reviewerEmail,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending review notification", { error: errorMessage });
      return {
        success: false,
        newsletterId: data.newsletterId,
        reviewerEmail: data.reviewerEmail,
        error: errorMessage,
      };
    }
  },
});

/**
 * Escape HTML entities to prevent injection
 */
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c: string) => {
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
 * Build a plain text fallback for the review notification email
 */
function buildPlainText(
  data: ReviewNotificationPayload,
  reviewLink: string,
  submittedDate: string,
): string {
  return [
    `NEWSLETTER REVIEW REQUESTED`,
    ``,
    `A newsletter is waiting for your approval.`,
    ``,
    `Newsletter: ${data.newsletterTitle}`,
    `Subject Line: ${data.newsletterSubject}`,
    `Submitted By: ${data.submitterName} (${data.submitterEmail})`,
    `Submitted At: ${submittedDate}`,
    ``,
    `YOUR APPROVAL CODE: ${data.approvalCode}`,
    `Enter this code on the review page to approve and send the newsletter.`,
    ``,
    `Review & Approve: ${reviewLink}`,
    ``,
    `Click the link above to review the newsletter content, then approve or reject it.`,
    ``,
    `---`,
    `You're receiving this because you've been designated as a newsletter reviewer.`,
  ].join('\n');
}
