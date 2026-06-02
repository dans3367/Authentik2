import { task, wait, logger, metadata, retry } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createHmac, randomUUID } from "crypto";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";
import { sendAhaEmail } from "./ahasend";
import { sendSESEmail } from "./ses";
import { buildReactionButtonsHtml } from "./newsletterReactionHtml";

// Convex client for newsletter tracking (lazy init)
let convexClient: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient | null {
  if (convexClient) return convexClient;
  const url = process.env.CONVEX_URL;
  if (!url) return null;
  convexClient = new ConvexHttpClient(url);
  return convexClient;
}

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

// Threshold: 5+ emails in a batch triggers bulk send via batch API
const BULK_THRESHOLD = 5;

interface BulkSendResult {
  recipientEmail: string;
  recipientId: string;
  success: boolean;
  providerMessageId?: string;
  error?: string;
  provider: 'resend' | 'ses' | 'ahasend';
}

/**
 * Helper to inject content before the footer marker (inside the document body)
 */
function injectBeforeFooter(htmlContent: string, injection: string): string {
  const footerMarker = '<!-- Footer -->';
  if (htmlContent.includes(footerMarker)) {
    return htmlContent.replace(footerMarker, `${injection}\n\n      ${footerMarker}`);
  }
  // Fallback: insert before closing </div></body>
  const closingMatch = htmlContent.lastIndexOf('</div>\n  </body>');
  if (closingMatch !== -1) {
    return htmlContent.slice(0, closingMatch) + injection + '\n' + htmlContent.slice(closingMatch);
  }
  // Last resort: insert before </body>
  return htmlContent.replace('</body>', `${injection}\n</body>`);
}

/**
 * Inject per-recipient reaction bar into the email HTML content.
 * Inserts the reaction bar just before the footer section.
 */
function injectReactionBar(content: string, baseUrl: string, newsletterId: string, recipientId: string): string {
  const reactionHtml = buildReactionButtonsHtml(baseUrl, newsletterId, recipientId);
  return injectBeforeFooter(content, reactionHtml);
}

/**
 * Inject unsubscribe link into the email HTML content.
 */
function injectUnsubscribeLink(content: string, unsubscribeUrl: string): string {
  const unsubscribeBlock = `<div style="padding: 20px 24px 24px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.6; color: #64748b;">
        You&rsquo;re receiving this newsletter because you signed up to hear from us.
      </p>
      <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">
        If you&rsquo;d rather not receive these emails, you can <a href="${unsubscribeUrl}" style="color: #475569; text-decoration: underline; font-weight: 500;">unsubscribe</a> at any time.
      </p>
    </div>`;
  return injectBeforeFooter(content, unsubscribeBlock);
}

/**
 * Send a batch of emails using Resend batch API (up to 100 per call).
 * Falls back to SES, then AhaSend if Resend fails.
 * Returns per-recipient results with provider message IDs for tracking.
 */
async function sendBulkEmails(opts: {
  recipients: NewsletterRecipient[];
  subject: string;
  content: string;
  from: string;
  replyTo?: string;
  newsletterId: string;
  groupUUID: string;
  tenantId: string;
  reactionsEnabled?: boolean;
  baseUrl?: string;
}): Promise<BulkSendResult[]> {
  const { recipients, subject, content, from: fromEmail, replyTo, newsletterId, groupUUID, tenantId, reactionsEnabled, baseUrl } = opts;
  const results: BulkSendResult[] = [];

  // Build Resend batch payload (max 100 per call)
  const resendBatchPayload = recipients.map((r) => {
    const emailTrackingId = randomUUID();
    // Substitute per-recipient template variables
    let recipientHtml = substituteVariables(content, r);
    // Inject per-recipient reaction bar if enabled
    if (reactionsEnabled && baseUrl) {
      recipientHtml = injectReactionBar(recipientHtml, baseUrl, newsletterId, r.id);
    }
    // Inject unsubscribe link if token is available
    if (r.unsubscribeToken && baseUrl) {
      const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(r.unsubscribeToken)}&type=newsletters`;
      recipientHtml = injectUnsubscribeLink(recipientHtml, unsubscribeUrl);
    }
    
    // Build List-Unsubscribe header
    const unsubscribeUrl = r.unsubscribeToken && baseUrl
      ? `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(r.unsubscribeToken)}&type=newsletters`
      : undefined;
    
    return {
      from: fromEmail,
      to: r.email,
      subject,
      html: recipientHtml,
      text: content.replace(/<[^>]*>/g, ""),
      replyTo,
      headers: unsubscribeUrl ? {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      } : undefined,
      tags: [
        { name: "type", value: "newsletter" },
        { name: "newsletterId", value: newsletterId },
        { name: "groupUUID", value: groupUUID },
        { name: "tenantId", value: tenantId },
        { name: "recipientId", value: r.id },
        { name: "trackingId", value: emailTrackingId },
      ],
    };
  });

  try {
    logger.info(`Sending ${recipients.length} emails via Resend batch API`, {
      newsletterId,
      recipientCount: recipients.length,
    });

    const { data: batchData, error: batchError } = await resend.batch.send(resendBatchPayload);

    if (batchError) {
      throw new Error(batchError.message || String(batchError));
    }

    // batchData.data is an array of { id } in the same order as the input
    const messageIds = batchData?.data || [];

    for (let i = 0; i < recipients.length; i++) {
      const msgId = messageIds[i]?.id;
      results.push({
        recipientEmail: recipients[i].email,
        recipientId: recipients[i].id,
        success: true,
        providerMessageId: msgId,
        provider: 'resend',
      });
    }

    logger.info(`Resend batch send completed`, {
      newsletterId,
      sent: results.length,
      messageIds: messageIds.map((m: any) => m.id),
    });

    return results;
  } catch (resendErr) {
    const resendErrMsg = resendErr instanceof Error ? resendErr.message : String(resendErr);
    logger.warn(`Resend batch failed, falling back to SES for ${recipients.length} emails`, {
      error: resendErrMsg,
      newsletterId,
    });

    // 2nd fallback: Amazon SES (sends one email per recipient)
    try {
      // SES sends per-recipient internally, so we can inject unique reaction bars
      for (const r of recipients) {
        let recipientHtml = substituteVariables(content, r);
        if (reactionsEnabled && baseUrl) {
          recipientHtml = injectReactionBar(recipientHtml, baseUrl, newsletterId, r.id);
        }
        if (r.unsubscribeToken && baseUrl) {
          const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(r.unsubscribeToken)}&type=newsletters`;
          recipientHtml = injectUnsubscribeLink(recipientHtml, unsubscribeUrl);
        }

        const sesResult = await sendSESEmail({
          from: { email: fromEmail },
          recipients: [{ email: r.email }],
          subject,
          html_content: recipientHtml,
          text_content: content.replace(/<[^>]*>/g, ""),
          reply_to: replyTo,
          tags: { type: "newsletter", newsletterId, groupUUID, tenantId },
        });

        const sesMsg = sesResult?.data?.[0];
        results.push({
          recipientEmail: r.email,
          recipientId: r.id,
          success: true,
          providerMessageId: sesMsg?.id || 'ses-bulk-success',
          provider: 'ses',
        });
      }

      logger.info(`SES bulk fallback completed`, {
        newsletterId,
        sent: results.length,
      });

      return results;
    } catch (sesErr) {
      const sesErrMsg = sesErr instanceof Error ? sesErr.message : String(sesErr);
      logger.warn(`SES batch also failed, falling back to AhaSend for ${recipients.length} emails`, {
        resendError: resendErrMsg,
        sesError: sesErrMsg,
        newsletterId,
      });

      // 3rd fallback: AhaSend (send per-recipient for unique reaction bars)
      try {
        for (const r of recipients) {
          let recipientHtml = substituteVariables(content, r);
          if (reactionsEnabled && baseUrl) {
            recipientHtml = injectReactionBar(recipientHtml, baseUrl, newsletterId, r.id);
          }
          if (r.unsubscribeToken && baseUrl) {
            const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(r.unsubscribeToken)}&type=newsletters`;
            recipientHtml = injectUnsubscribeLink(recipientHtml, unsubscribeUrl);
          }

          const ahaResult = await sendAhaEmail({
            from: { email: fromEmail },
            recipients: [{ email: r.email }],
            subject,
            html_content: recipientHtml,
            text_content: content.replace(/<[^>]*>/g, ""),
            reply_to: replyTo,
          });

          const ahaMsg = ahaResult?.data?.[0];
          results.push({
            recipientEmail: r.email,
            recipientId: r.id,
            success: true,
            providerMessageId: ahaMsg?.id || 'ahasend-bulk-success',
            provider: 'ahasend',
          });
        }

        logger.info(`AhaSend bulk fallback completed`, {
          newsletterId,
          sent: results.length,
        });

        return results;
      } catch (ahaErr) {
        const ahaErrMsg = ahaErr instanceof Error ? ahaErr.message : String(ahaErr);
        logger.error(`All providers failed (Resend, SES, AhaSend)`, {
          resendError: resendErrMsg,
          sesError: sesErrMsg,
          ahasendError: ahaErrMsg,
          newsletterId,
        });

        for (const r of recipients) {
          results.push({
            recipientEmail: r.email,
            recipientId: r.id,
            success: false,
            error: `Resend: ${resendErrMsg}; SES: ${sesErrMsg}; AhaSend: ${ahaErrMsg}`,
            provider: 'resend',
          });
        }

        return results;
      }
    }
  }
}

// Schema for newsletter recipient
const recipientSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  unsubscribeToken: z.string().optional(),
  preferredLanguage: z.string().optional(),
});

/**
 * Resolve the correct subject and content for a recipient based on their preferredLanguage.
 * Falls back to the source content if no translation is available.
 */
function resolveRecipientContent(
  recipient: NewsletterRecipient,
  defaultSubject: string,
  defaultContent: string,
  translatedContents?: Record<string, { subject: string; content: string }>,
  sourceLanguage?: string
): { subject: string; content: string } {
  const lang = recipient.preferredLanguage || sourceLanguage || 'en';
  const src = sourceLanguage || 'en';

  // If recipient speaks the source language or no translations provided, use defaults
  if (lang === src || !translatedContents) {
    return { subject: defaultSubject, content: defaultContent };
  }

  // Look up translation for the recipient's language
  const translation = translatedContents[lang];
  if (translation) {
    return { subject: translation.subject, content: translation.content };
  }

  // Fallback to source content
  return { subject: defaultSubject, content: defaultContent };
}

/**
 * Replace {{variable}} placeholders in newsletter HTML with per-recipient values.
 */
function substituteVariables(html: string, recipient: NewsletterRecipient): string {
  return html
    .replace(/\{\{first_name\}\}/g, recipient.firstName || '')
    .replace(/\{\{last_name\}\}/g, recipient.lastName || '')
    .replace(/\{\{email\}\}/g, recipient.email || '')
    .replace(/\{\{phone\}\}/g, recipient.phoneNumber || '')
    .replace(/\{\{address\}\}/g, recipient.address || '')
    .replace(/\{\{office_hours\}\}/g, '');
}

// Schema for newsletter job payload
// Schema for translated content per language
const translatedContentSchema = z.object({
  subject: z.string(),
  content: z.string(),
});

const newsletterJobSchema = z.object({
  jobId: z.string(),
  newsletterId: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  groupUUID: z.string(),
  subject: z.string(),
  content: z.string(),
  recipients: z.array(recipientSchema),
  batchSize: z.number().default(25),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  scheduledFor: z.string().optional(),
  reactionsEnabled: z.boolean().default(true),
  baseUrl: z.string().optional(),
  // Translation support: map of language code → { subject, content }
  // If provided, recipients with a preferredLanguage get translated content
  translatedContents: z.record(z.string(), translatedContentSchema).optional(),
  sourceLanguage: z.string().optional(),
});

export type NewsletterJobPayload = z.infer<typeof newsletterJobSchema>;
export type NewsletterRecipient = z.infer<typeof recipientSchema>;

/**
 * Update newsletter status via authenticated internal endpoint.
 */
async function updateNewsletterStatusInternal(
  newsletterId: string,
  tenantId: string,
  status: string,
  stats: { sentCount: number; failedCount: number; totalCount: number }
): Promise<void> {
  const apiUrl = process.env.API_URL;
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  if (!secret) {
    logger.warn("INTERNAL_SERVICE_SECRET not configured, skipping status update");
    return;
  }

  // Build ordered list of base URLs to try.
  // Primary: remote (web.zendwise.work) for production reliability.
  // Fallback: localhost for dev or when Cloudflare tunnel is down.
  const urls: string[] = [];
  const remoteUrl = "https://web.zendwise.work";
  const localUrl = apiUrl && (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1"))
    ? apiUrl
    : `http://localhost:${process.env.PORT || "5002"}`;

  if (apiUrl && !apiUrl.includes("localhost") && !apiUrl.includes("127.0.0.1")) {
    // API_URL is a real remote URL — use it as primary
    urls.push(apiUrl);
  } else {
    // API_URL is localhost or unset — try remote first, then local fallback
    urls.push(remoteUrl, localUrl);
  }

  const body = { tenantId, status, ...stats };

  for (const baseUrl of urls) {
    try {
      await retry.onThrow(
        async () => {
          // Generate fresh timestamp + signature on each attempt (prevents replay rejection)
          const timestamp = Date.now();
          const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
          const signature = createHmac("sha256", secret).update(signaturePayload).digest("hex");

          const url = `${baseUrl}/api/newsletters/internal/${newsletterId}/status`;
          logger.info(`Calling status update: ${url}`, { status, stats });

          const response = await fetch(url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-internal-service": "trigger.dev",
              "x-internal-timestamp": timestamp.toString(),
              "x-internal-signature": signature,
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const responseText = await response.text().catch(() => "");
            const msg = `Failed to update newsletter ${newsletterId} status via ${baseUrl}: HTTP ${response.status} - ${responseText.slice(0, 200)}`;
            logger.error(msg);
            throw new Error(msg);
          }

          logger.info(`Newsletter ${newsletterId} status updated to: ${status} via ${baseUrl}`);
        },
        { maxAttempts: 3, randomize: true, minTimeoutInMs: 2000, maxTimeoutInMs: 10000, factor: 2 }
      );
      // Success — stop trying other URLs
      return;
    } catch (err) {
      logger.warn(`Status update via ${baseUrl} failed, trying next URL if available`, {
        error: err instanceof Error ? err.message : String(err),
        newsletterId,
      });
    }
  }

  // All URLs exhausted — throw so the caller's try/catch can log it
  throw new Error(`All status update endpoints failed for newsletter ${newsletterId}`);
}

/**
 * Send a single newsletter email
 */
export const sendNewsletterEmailTask = task({
  id: "send-newsletter-email",
  maxDuration: 60,
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: {
    newsletterId: string;
    groupUUID: string;
    tenantId: string;
    userId: string;
    recipient: NewsletterRecipient;
    subject: string;
    content: string;
    from?: string;
    replyTo?: string;
  }) => {
    const { recipient, subject, content, newsletterId, groupUUID, tenantId, userId } = payload;

    logger.info("Sending newsletter email", {
      newsletterId,
      recipientEmail: recipient.email,
    });

    try {
      const emailTrackingId = randomUUID();
      const fromEmail = payload.from || process.env.EMAIL_FROM || "admin@zendwise.com";

      let emailData: any = null;
      let sendError: any = null;

      const { data: resendData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject,
        html: content,
        text: content.replace(/<[^>]*>/g, ""),
        replyTo: payload.replyTo,
        tags: [
          { name: "type", value: "newsletter" },
          { name: "newsletterId", value: newsletterId },
          { name: "groupUUID", value: groupUUID },
          { name: "tenantId", value: tenantId },
          { name: "recipientId", value: recipient.id },
          { name: "trackingId", value: emailTrackingId },
        ],
      });

      emailData = resendData;
      sendError = resendError;

      if (sendError) {
        logger.warn("Resend failed, falling back to SES", { error: sendError.message, to: recipient.email });
        try {
          const sesResult = await sendSESEmail({
            from: { email: fromEmail },
            recipients: [{ email: recipient.email }],
            subject,
            html_content: content,
            text_content: content.replace(/<[^>]*>/g, ""),
            reply_to: payload.replyTo,
            tags: { type: "newsletter", newsletterId, groupUUID, tenantId, recipientId: recipient.id },
          });
          const sesMessages: any[] = sesResult?.data || [];
          const sesMsg = sesMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
          emailData = { id: sesMsg?.id || 'ses-fallback-success' };
          sendError = null;
        } catch (sesError) {
          logger.warn("SES also failed, falling back to AhaSend", { error: sesError instanceof Error ? sesError.message : String(sesError), to: recipient.email });
          try {
            const ahaResult = await sendAhaEmail({
              from: { email: fromEmail },
              recipients: [{ email: recipient.email }],
              subject,
              html_content: content,
              text_content: content.replace(/<[^>]*>/g, ""),
              reply_to: payload.replyTo,
            });
            const ahaMessages: any[] = ahaResult?.data || [];
            const ahaMsg = ahaMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
            emailData = { id: ahaMsg?.id || ahaResult.id || ahaResult.message_id || 'ahasend-fallback-success' };
            sendError = null;
          } catch (ahaError) {
            sendError = ahaError;
          }
        }
      }

      if (sendError) {
        logger.error("Failed to send newsletter email via all providers (Resend, SES, AhaSend)", { error: sendError });
        return {
          success: false,
          recipientId: recipient.id,
          email: recipient.email,
          error: sendError.message || String(sendError),
        };
      }

      logger.info("Newsletter email sent successfully", {
        emailId: emailData?.id,
        recipientEmail: recipient.email,
      });

      return {
        success: true,
        recipientId: recipient.id,
        email: recipient.email,
        emailId: emailData?.id,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending newsletter email", { error: errorMessage });
      return {
        success: false,
        recipientId: recipient.id,
        email: recipient.email,
        error: errorMessage,
      };
    }
  },
});

/**
 * Process a batch of newsletter recipients
 */
export const processNewsletterBatchTask = task({
  id: "process-newsletter-batch",
  maxDuration: 300, // 5 minutes per batch
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: {
    newsletterId: string;
    groupUUID: string;
    tenantId: string;
    userId: string;
    recipients: NewsletterRecipient[];
    subject: string;
    content: string;
    batchNumber: number;
    totalBatches: number;
    from?: string;
    replyTo?: string;
    reactionsEnabled?: boolean;
    baseUrl?: string;
  }) => {
    const { recipients, batchNumber, totalBatches, newsletterId } = payload;

    logger.info(`Processing newsletter batch ${batchNumber}/${totalBatches}`, {
      newsletterId,
      recipientCount: recipients.length,
    });

    metadata.set("batchNumber", batchNumber);
    metadata.set("totalBatches", totalBatches);
    metadata.set("recipientCount", recipients.length);

    const results: { success: boolean; email: string; error?: string; providerMessageId?: string }[] = [];
    const fromEmail = payload.from || process.env.EMAIL_FROM || "admin@zendwise.com";

    if (recipients.length >= BULK_THRESHOLD) {
      // ── BULK SEND: use Resend batch API (or AhaSend fallback) ──
      const bulkChunks: NewsletterRecipient[][] = [];
      for (let c = 0; c < recipients.length; c += 100) {
        bulkChunks.push(recipients.slice(c, c + 100));
      }

      for (const chunk of bulkChunks) {
        const bulkResults = await sendBulkEmails({
          recipients: chunk,
          subject: payload.subject,
          content: payload.content,
          from: fromEmail,
          replyTo: payload.replyTo,
          newsletterId: payload.newsletterId,
          groupUUID: payload.groupUUID,
          tenantId: payload.tenantId,
          reactionsEnabled: payload.reactionsEnabled,
          baseUrl: payload.baseUrl,
        });

        for (const result of bulkResults) {
          results.push({
            success: result.success,
            email: result.recipientEmail,
            error: result.error,
            providerMessageId: result.providerMessageId,
          });
        }
      }
    } else {
      // ── INDIVIDUAL SEND: fewer than BULK_THRESHOLD recipients ──
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        try {
          const emailTrackingId = randomUUID();
          let emailData: any = null;
          let sendError: any = null;

          // Substitute variables and inject per-recipient reaction bar if enabled
          let recipientHtml = substituteVariables(payload.content, recipient);
          if (payload.reactionsEnabled && payload.baseUrl) {
            recipientHtml = injectReactionBar(recipientHtml, payload.baseUrl, payload.newsletterId, recipient.id);
          }

          const { data: resendData, error: resendError } = await resend.emails.send({
            from: fromEmail,
            to: recipient.email,
            subject: payload.subject,
            html: recipientHtml,
            text: payload.content.replace(/<[^>]*>/g, ""),
            replyTo: payload.replyTo,
            tags: [
              { name: "type", value: "newsletter" },
              { name: "newsletterId", value: payload.newsletterId },
              { name: "groupUUID", value: payload.groupUUID },
              { name: "tenantId", value: payload.tenantId },
              { name: "recipientId", value: recipient.id },
              { name: "trackingId", value: emailTrackingId },
            ],
          });

          emailData = resendData;
          sendError = resendError;

          if (sendError) {
            logger.warn("Resend failed, falling back to SES", { error: sendError.message, to: recipient.email });
            try {
              const sesResult = await sendSESEmail({
                from: { email: fromEmail },
                recipients: [{ email: recipient.email }],
                subject: payload.subject,
                html_content: recipientHtml,
                text_content: payload.content.replace(/<[^>]*>/g, ""),
                reply_to: payload.replyTo,
                tags: { type: "newsletter", newsletterId: payload.newsletterId, groupUUID: payload.groupUUID, tenantId: payload.tenantId, recipientId: recipient.id },
              });
              const sesMessages: any[] = sesResult?.data || [];
              const sesMsg = sesMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
              emailData = { id: sesMsg?.id || 'ses-fallback-success' };
              sendError = null;
            } catch (sesError) {
              logger.warn("SES also failed, falling back to AhaSend", { error: sesError instanceof Error ? sesError.message : String(sesError), to: recipient.email });
              try {
                const ahaResult = await sendAhaEmail({
                  from: { email: fromEmail },
                  recipients: [{ email: recipient.email }],
                  subject: payload.subject,
                  html_content: recipientHtml,
                  text_content: payload.content.replace(/<[^>]*>/g, ""),
                  reply_to: payload.replyTo,
                });
                const ahaMessages: any[] = ahaResult?.data || [];
                const ahaMsg = ahaMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
                emailData = { id: ahaMsg?.id || ahaResult.id || ahaResult.message_id || 'ahasend-fallback-success' };
                sendError = null;
              } catch (ahaError) {
                sendError = ahaError;
              }
            }
          }

          if (sendError) {
            results.push({ success: false, email: recipient.email, error: sendError.message || String(sendError) });
          } else {
            results.push({ success: true, email: recipient.email, providerMessageId: emailData?.id });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          results.push({ success: false, email: recipient.email, error: errorMessage });
        }

        // Small delay between individual emails to avoid rate limiting
        if (i < recipients.length - 1) {
          await wait.for({ seconds: 0.5 });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    logger.info(`Batch ${batchNumber} completed`, {
      newsletterId,
      success: successCount,
      failed: failedCount,
      mode: recipients.length >= BULK_THRESHOLD ? "bulk" : "individual",
    });

    return {
      batchNumber,
      totalBatches,
      success: successCount,
      failed: failedCount,
      results,
    };
  },
});

/**
 * Main newsletter sending task - orchestrates the entire newsletter send
 */
export const sendNewsletterTask = task({
  id: "send-newsletter",
  maxDuration: 3600, // 1 hour max for large newsletters
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: NewsletterJobPayload) => {
    const data = newsletterJobSchema.parse(payload);

    logger.info("Starting newsletter send", {
      jobId: data.jobId,
      newsletterId: data.newsletterId,
      totalRecipients: data.recipients.length,
    });

    // Initialize progress metadata
    metadata.set("status", "starting");
    metadata.set("totalRecipients", data.recipients.length);
    metadata.set("sentCount", 0);
    metadata.set("failedCount", 0);
    metadata.set("progress", 0);

    // Check if scheduled for later
    if (data.scheduledFor) {
      const scheduledDate = new Date(data.scheduledFor);
      if (scheduledDate > new Date()) {
        logger.info("Newsletter scheduled for later", { scheduledFor: data.scheduledFor });
        metadata.set("status", "waiting");
        await wait.until({ date: scheduledDate });
      }
    }

    // NOTE: Suppression filtering is done by the server (newsletterRoutes.ts) BEFORE
    // triggering this task. Recipients passed here are already filtered.
    // Convex tracking for suppressed contacts is also handled server-side.

    const validRecipients = data.recipients;

    logger.info("Processing recipients", {
      count: validRecipients.length,
    });

    metadata.set("validRecipients", validRecipients.length);

    if (validRecipients.length === 0) {
      logger.warn("No valid recipients after filtering");

      // Complete Convex tracking since no emails will be sent
      try {
        const convex = getConvex();
        if (convex) {
          await convex.mutation("emailTracking:completeEmailCampaign" as any, {
            campaignId: data.newsletterId,
            sentCount: 0,
            failedCount: 0,
          });
          logger.info("Convex tracking completed for zero recipients");
        }
      } catch (err) {
        logger.warn("Failed to complete Convex tracking for zero recipients (non-fatal)", { error: String(err) });
      }

      try {
        await updateNewsletterStatusInternal(data.newsletterId, data.tenantId, "sent", {
          sentCount: 0,
          failedCount: 0,
          totalCount: 0,
        });
      } catch (statusErr) {
        logger.error("Failed to update newsletter status to 'sent' (non-fatal, emails were not sent)", {
          error: statusErr instanceof Error ? statusErr.message : String(statusErr),
          newsletterId: data.newsletterId,
        });
      }
      return {
        success: true,
        jobId: data.jobId,
        newsletterId: data.newsletterId,
        sentCount: 0,
        failedCount: 0,
        totalCount: 0,
      };
    }

    metadata.set("status", "processing");

    // Create batches
    const batchSize = data.batchSize || 25;
    const batches: NewsletterRecipient[][] = [];
    for (let i = 0; i < validRecipients.length; i += batchSize) {
      batches.push(validRecipients.slice(i, i + batchSize));
    }

    metadata.set("totalBatches", batches.length);

    let totalSent = 0;
    let totalFailed = 0;
    const errors: { email: string; error: string }[] = [];

    // Process batches sequentially
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;
      const fromEmail = data.from || process.env.EMAIL_FROM || "admin@zendwise.com";

      logger.info(`Processing batch ${batchNumber}/${batches.length}`, {
        recipientCount: batch.length,
        mode: batch.length >= BULK_THRESHOLD ? "bulk" : "individual",
      });

      metadata.set("currentBatch", batchNumber);

      if (batch.length >= BULK_THRESHOLD) {
        // ── BULK SEND: use Resend batch API (or AhaSend fallback) ──
        // Group recipients by language so each group gets the correct translated content
        const langGroups = new Map<string, NewsletterRecipient[]>();
        for (const r of batch) {
          const lang = r.preferredLanguage || data.sourceLanguage || 'en';
          const group = langGroups.get(lang) || [];
          group.push(r);
          langGroups.set(lang, group);
        }

        for (const [lang, langRecipients] of Array.from(langGroups.entries())) {
          // Resolve content for this language group
          const resolved = resolveRecipientContent(
            { preferredLanguage: lang } as NewsletterRecipient,
            data.subject,
            data.content,
            data.translatedContents,
            data.sourceLanguage,
          );

          // Resend batch API supports up to 100 per call; split if needed
          const bulkChunks: NewsletterRecipient[][] = [];
          for (let c = 0; c < langRecipients.length; c += 100) {
            bulkChunks.push(langRecipients.slice(c, c + 100));
          }

          for (const chunk of bulkChunks) {
            const bulkResults = await sendBulkEmails({
              recipients: chunk,
              subject: resolved.subject,
              content: resolved.content,
              from: fromEmail,
              replyTo: data.replyTo,
              newsletterId: data.newsletterId,
              groupUUID: data.groupUUID,
              tenantId: data.tenantId,
              reactionsEnabled: data.reactionsEnabled,
              baseUrl: data.baseUrl,
            });

            // Track each result individually in Convex
            for (const result of bulkResults) {
              if (result.success) {
                totalSent++;
                try {
                  const convex = getConvex();
                  if (convex) {
                    await convex.mutation("emailTracking:trackEmailSend" as any, {
                      tenantId: data.tenantId,
                      sendType: "newsletter",
                      campaignId: data.newsletterId,
                      groupUUID: data.groupUUID,
                      recipientEmail: result.recipientEmail,
                      recipientId: result.recipientId,
                      providerMessageId: result.providerMessageId,
                      status: "sent",
                    });
                  }
                } catch (_) { }
              } else {
                totalFailed++;
                errors.push({ email: result.recipientEmail, error: result.error || "Unknown error" });
                try {
                  const convex = getConvex();
                  if (convex) {
                    await convex.mutation("emailTracking:trackEmailSend" as any, {
                      tenantId: data.tenantId,
                      sendType: "newsletter",
                      campaignId: data.newsletterId,
                      groupUUID: data.groupUUID,
                      recipientEmail: result.recipientEmail,
                      recipientId: result.recipientId,
                      status: "failed",
                      error: result.error || "Unknown error",
                    });
                  }
                } catch (_) { }
              }
            }

            // Update progress after each bulk chunk
            const processed = totalSent + totalFailed;
            const progress = Math.round((processed / validRecipients.length) * 100);
            metadata.set("sentCount", totalSent);
            metadata.set("failedCount", totalFailed);
            metadata.set("progress", progress);
          }
        }
      } else {
        // ── INDIVIDUAL SEND: fewer than BULK_THRESHOLD recipients ──
        for (let j = 0; j < batch.length; j++) {
          const recipient = batch[j];

          try {
            const emailTrackingId = randomUUID();
            let emailData: any = null;
            let sendError: any = null;

            // Resolve translated content for this recipient's preferred language
            const resolved = resolveRecipientContent(
              recipient,
              data.subject,
              data.content,
              data.translatedContents,
              data.sourceLanguage,
            );

            // Substitute variables and inject per-recipient reaction bar if enabled
            let recipientHtml = substituteVariables(resolved.content, recipient);
            if (data.reactionsEnabled && data.baseUrl) {
              recipientHtml = injectReactionBar(recipientHtml, data.baseUrl, data.newsletterId, recipient.id);
            }
            const unsubscribeUrl = recipient.unsubscribeToken && data.baseUrl
              ? `${data.baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(recipient.unsubscribeToken)}&type=newsletters`
              : undefined;
            if (unsubscribeUrl) {
              recipientHtml = injectUnsubscribeLink(recipientHtml, unsubscribeUrl);
            }

            const { data: resendData, error: resendError } = await resend.emails.send({
              from: fromEmail,
              to: recipient.email,
              subject: resolved.subject,
              html: recipientHtml,
              text: resolved.content.replace(/<[^>]*>/g, ""),
              replyTo: data.replyTo,
              headers: unsubscribeUrl ? {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              } : undefined,
              tags: [
                { name: "type", value: "newsletter" },
                { name: "newsletterId", value: data.newsletterId },
                { name: "groupUUID", value: data.groupUUID },
                { name: "tenantId", value: data.tenantId },
                { name: "recipientId", value: recipient.id },
                { name: "trackingId", value: emailTrackingId },
              ],
            });

            emailData = resendData;
            sendError = resendError;

            if (sendError) {
              logger.warn("Resend failed, falling back to SES", { error: sendError.message, to: recipient.email });
              try {
                const sesResult = await sendSESEmail({
                  from: { email: fromEmail },
                  recipients: [{ email: recipient.email }],
                  subject: resolved.subject,
                  html_content: recipientHtml,
                  text_content: resolved.content.replace(/<[^>]*>/g, ""),
                  reply_to: data.replyTo,
                  tags: { type: "newsletter", newsletterId: data.newsletterId, groupUUID: data.groupUUID, tenantId: data.tenantId, recipientId: recipient.id },
                });
                const sesMessages: any[] = sesResult?.data || [];
                const sesMsg = sesMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
                emailData = { id: sesMsg?.id || 'ses-fallback-success' };
                sendError = null;
              } catch (sesError) {
                logger.warn("SES also failed, falling back to AhaSend", { error: sesError instanceof Error ? sesError.message : String(sesError), to: recipient.email });
                try {
                  const ahaResult = await sendAhaEmail({
                    from: { email: fromEmail },
                    recipients: [{ email: recipient.email }],
                    subject: resolved.subject,
                    html_content: recipientHtml,
                    text_content: resolved.content.replace(/<[^>]*>/g, ""),
                    reply_to: data.replyTo,
                  });
                  const ahaMessages: any[] = ahaResult?.data || [];
                  const ahaMsg = ahaMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
                  emailData = { id: ahaMsg?.id || ahaResult.id || ahaResult.message_id || 'ahasend-fallback-success' };
                  sendError = null;
                } catch (ahaError) {
                  sendError = ahaError;
                }
              }
            }

            if (sendError) {
              totalFailed++;
              errors.push({ email: recipient.email, error: sendError.message || String(sendError) });
              try {
                const convex = getConvex();
                if (convex) {
                  await convex.mutation("emailTracking:trackEmailSend" as any, {
                    tenantId: data.tenantId,
                    sendType: "newsletter",
                    campaignId: data.newsletterId,
                    groupUUID: data.groupUUID,
                    recipientEmail: recipient.email,
                    recipientId: recipient.id,
                    status: "failed",
                    error: sendError.message || String(sendError),
                  });
                }
              } catch (_) { }
            } else {
              totalSent++;
              try {
                const convex = getConvex();
                if (convex) {
                  await convex.mutation("emailTracking:trackEmailSend" as any, {
                    tenantId: data.tenantId,
                    sendType: "newsletter",
                    campaignId: data.newsletterId,
                    groupUUID: data.groupUUID,
                    recipientEmail: recipient.email,
                    recipientId: recipient.id,
                    providerMessageId: emailData?.id,
                    status: "sent",
                  });
                }
              } catch (_) { }
            }
          } catch (err) {
            totalFailed++;
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            errors.push({ email: recipient.email, error: errorMessage });
            try {
              const convex = getConvex();
              if (convex) {
                await convex.mutation("emailTracking:trackEmailSend" as any, {
                  tenantId: data.tenantId,
                  sendType: "newsletter",
                  campaignId: data.newsletterId,
                  groupUUID: data.groupUUID,
                  recipientEmail: recipient.email,
                  recipientId: recipient.id,
                  status: "failed",
                  error: errorMessage,
                });
              }
            } catch (_) { }
          }

          // Update progress
          const processed = totalSent + totalFailed;
          const progress = Math.round((processed / validRecipients.length) * 100);
          metadata.set("sentCount", totalSent);
          metadata.set("failedCount", totalFailed);
          metadata.set("progress", progress);

          // Small delay between individual emails
          if (j < batch.length - 1) {
            await wait.for({ seconds: 0.5 });
          }
        }
      }

      // Delay between batches
      if (i < batches.length - 1) {
        await wait.for({ seconds: 2 });
      }
    }

    metadata.set("status", "completed");
    metadata.set("progress", 100);

    // Update newsletter status in database
    // CRITICAL: This must NOT throw — if it does, the entire task retries and
    // all emails are re-sent. The status update is best-effort; the emails
    // have already been delivered at this point.
    try {
      await updateNewsletterStatusInternal(data.newsletterId, data.tenantId, "sent", {
        sentCount: totalSent,
        failedCount: totalFailed,
        totalCount: validRecipients.length,
      });
    } catch (statusErr) {
      logger.error("Failed to update newsletter status to 'sent' (non-fatal, emails already sent)", {
        error: statusErr instanceof Error ? statusErr.message : String(statusErr),
        newsletterId: data.newsletterId,
        sentCount: totalSent,
        failedCount: totalFailed,
      });
    }

    // Complete Convex tracking
    try {
      const convex = getConvex();
      if (convex) {
        await convex.mutation("emailTracking:completeEmailCampaign" as any, {
          campaignId: data.newsletterId,
          sentCount: totalSent,
          failedCount: totalFailed,
        });
      }
    } catch (err) {
      logger.warn("Failed to complete Convex tracking (non-fatal)", { error: String(err) });
    }

    logger.info("Newsletter send completed", {
      jobId: data.jobId,
      newsletterId: data.newsletterId,
      sent: totalSent,
      failed: totalFailed,
      total: validRecipients.length,
    });

    // Schedule analytics collection completion in 24 hours
    try {
      const analyticsHandle = await completeAnalyticsCollectionTask.trigger({
        newsletterId: data.newsletterId,
        tenantId: data.tenantId,
      });
      logger.info("Analytics completion task scheduled (24h delay)", {
        runId: analyticsHandle.id,
        newsletterId: data.newsletterId,
      });
    } catch (analyticsErr) {
      // Non-fatal: analytics task failure shouldn't affect send result
      logger.warn("Failed to schedule analytics completion task (non-fatal)", {
        error: analyticsErr instanceof Error ? analyticsErr.message : String(analyticsErr),
      });
    }

    return {
      success: true,
      jobId: data.jobId,
      newsletterId: data.newsletterId,
      sentCount: totalSent,
      failedCount: totalFailed,
      totalCount: validRecipients.length,
      errors: errors.length > 0 ? errors.slice(0, 50) : undefined, // Limit errors in response
    };
  },
});

/**
 * Schedule a newsletter for future sending
 */
export const scheduleNewsletterTask = task({
  id: "schedule-newsletter",
  maxDuration: 86400, // 24 hours max
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: NewsletterJobPayload & { scheduledFor: string }) => {
    const data = newsletterJobSchema.parse(payload);

    if (!data.scheduledFor) {
      throw new Error("scheduledFor is required for scheduled newsletters");
    }

    const scheduledDate = new Date(data.scheduledFor);

    logger.info("Scheduling newsletter", {
      jobId: data.jobId,
      newsletterId: data.newsletterId,
      scheduledFor: data.scheduledFor,
      recipientCount: data.recipients.length,
    });

    metadata.set("status", "scheduled");
    metadata.set("scheduledFor", data.scheduledFor);

    // Wait until scheduled time
    await wait.until({ date: scheduledDate });

    logger.info("Scheduled time reached, starting newsletter send", {
      jobId: data.jobId,
      newsletterId: data.newsletterId,
    });

    // Trigger the main send task
    const result = await sendNewsletterTask.triggerAndWait({
      ...data,
      scheduledFor: undefined, // Clear scheduledFor since we're sending now
    });

    if (result.ok) {
      return result.output;
    }

    throw new Error(`Newsletter send failed: ${result.error}`);
  },
});

/**
 * Complete analytics collection 24 hours after newsletter send.
 * This task waits 24 hours, then updates the newsletter_task_status row
 * for the 'analytics' task type to 'completed'.
 */
export const completeAnalyticsCollectionTask = task({
  id: "complete-analytics-collection",
  maxDuration: 90000, // 25 hours max (24h wait + buffer)
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
  run: async (payload: {
    newsletterId: string;
    tenantId: string;
  }) => {
    const { newsletterId, tenantId } = payload;

    logger.info("Analytics collection task started — waiting 24 hours", {
      newsletterId,
      tenantId,
    });

    metadata.set("status", "waiting");
    metadata.set("newsletterId", newsletterId);

    // Wait 24 hours for analytics data (opens, clicks, bounces) to accumulate
    await wait.for({ hours: 24 });

    logger.info("24-hour wait complete — marking analytics collection as completed", {
      newsletterId,
      tenantId,
    });

    metadata.set("status", "completing");

    // Update the newsletter_task_status via authenticated internal endpoint
    const apiUrl = process.env.API_URL;
    const secret = process.env.INTERNAL_SERVICE_SECRET;

    // Use web.zendwise.work when API_URL points to localhost
    const baseUrl = (!apiUrl || apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1"))
      ? "https://web.zendwise.work"
      : apiUrl;

    if (!secret) {
      logger.warn("INTERNAL_SERVICE_SECRET not configured, skipping analytics status update");
      return { success: false, error: "INTERNAL_SERVICE_SECRET not configured" };
    }

    const timestamp = Date.now();
    const body = {
      newsletterId,
      tenantId,
      taskType: "analytics",
      status: "completed",
      progress: 100,
      completedAt: new Date().toISOString(),
    };
    const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
    const signature = createHmac("sha256", secret).update(signaturePayload).digest("hex");

    try {
      const response = await fetch(`${baseUrl}/api/newsletters/internal/${newsletterId}/complete-analytics`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-internal-service": "trigger.dev",
          "x-internal-timestamp": timestamp.toString(),
          "x-internal-signature": signature,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn(`Failed to update analytics status: ${response.status}`, { body: errText });
        return { success: false, error: `HTTP ${response.status}: ${errText}` };
      }

      logger.info("Analytics collection marked as completed", { newsletterId });
      metadata.set("status", "completed");
      return { success: true, newsletterId, completedAt: new Date().toISOString() };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error("Error updating analytics collection status", { error: errMsg });
      return { success: false, error: errMsg };
    }
  },
});
