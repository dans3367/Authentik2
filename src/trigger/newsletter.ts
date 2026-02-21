import { task, wait, logger, metadata } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createHmac, randomUUID } from "crypto";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";
import { sendAhaEmail } from "./ahasend";

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
  provider: 'resend' | 'ahasend';
}

/**
 * Send a batch of emails using Resend batch API (up to 100 per call).
 * Falls back to AhaSend for the entire batch if Resend fails.
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
}): Promise<BulkSendResult[]> {
  const { recipients, subject, content, from: fromEmail, replyTo, newsletterId, groupUUID, tenantId } = opts;
  const results: BulkSendResult[] = [];

  // Build Resend batch payload (max 100 per call)
  const resendBatchPayload = recipients.map((r) => {
    const emailTrackingId = randomUUID();
    return {
      from: fromEmail,
      to: r.email,
      subject,
      html: content,
      text: content.replace(/<[^>]*>/g, ""),
      replyTo,
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
    logger.warn(`Resend batch failed, falling back to AhaSend for ${recipients.length} emails`, {
      error: resendErrMsg,
      newsletterId,
    });

    // Fallback: send all via AhaSend (natively sends separate message per recipient)
    try {
      const ahaResult = await sendAhaEmail({
        from: { email: fromEmail },
        recipients: recipients.map((r) => ({ email: r.email })),
        subject,
        html_content: content,
        text_content: content.replace(/<[^>]*>/g, ""),
        reply_to: replyTo,
      });

      // AhaSend v2 returns { data: [{ id, recipient: { email }, status }] }
      const ahaMessages: any[] = ahaResult?.data || [];

      // Build a map of email -> message ID from AhaSend response
      const ahaIdMap = new Map<string, string>();
      for (const msg of ahaMessages) {
        const email = msg?.recipient?.email;
        const id = msg?.id;
        if (email && id) {
          ahaIdMap.set(email.toLowerCase(), id);
        }
      }

      for (const r of recipients) {
        const msgId = ahaIdMap.get(r.email.toLowerCase());
        results.push({
          recipientEmail: r.email,
          recipientId: r.id,
          success: true,
          providerMessageId: msgId || 'ahasend-bulk-success',
          provider: 'ahasend',
        });
      }

      logger.info(`AhaSend bulk fallback completed`, {
        newsletterId,
        sent: results.length,
        messageIds: ahaMessages.map((m: any) => m.id),
      });

      return results;
    } catch (ahaErr) {
      const ahaErrMsg = ahaErr instanceof Error ? ahaErr.message : String(ahaErr);
      logger.error(`Both Resend batch and AhaSend fallback failed`, {
        resendError: resendErrMsg,
        ahasendError: ahaErrMsg,
        newsletterId,
      });

      // Mark all recipients as failed
      for (const r of recipients) {
        results.push({
          recipientEmail: r.email,
          recipientId: r.id,
          success: false,
          error: `Resend: ${resendErrMsg}; AhaSend: ${ahaErrMsg}`,
          provider: 'resend',
        });
      }

      return results;
    }
  }
}

// Schema for newsletter recipient
const recipientSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Schema for newsletter job payload
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
});

export type NewsletterJobPayload = z.infer<typeof newsletterJobSchema>;
export type NewsletterRecipient = z.infer<typeof recipientSchema>;

/**
 * Update newsletter status via authenticated internal endpoint.
 */
async function updateNewsletterStatusInternal(
  newsletterId: string,
  status: string,
  stats: { sentCount: number; failedCount: number; totalCount: number }
): Promise<void> {
  const apiUrl = process.env.API_URL;
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  // Use web.zendwise.work as base host for status updates when API_URL points to localhost
  const baseUrl = (!apiUrl || apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1"))
    ? "https://web.zendwise.work"
    : apiUrl;

  if (!secret) {
    logger.warn("INTERNAL_SERVICE_SECRET not configured, skipping status update");
    return;
  }

  const timestamp = Date.now();
  const body = { status, ...stats };
  const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
  const signature = createHmac("sha256", secret).update(signaturePayload).digest("hex");

  try {
    const response = await fetch(`${baseUrl}/api/newsletters/internal/${newsletterId}/status`, {
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
      logger.warn(`Failed to update newsletter status: ${response.status}`);
    } else {
      logger.info(`Newsletter ${newsletterId} status updated to: ${status}`);
    }
  } catch (err) {
    logger.warn(`Error updating newsletter status: ${err}`);
  }
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
        logger.warn("Resend failed, falling back to AhaSend", { error: sendError.message, to: recipient.email });
        try {
          const ahaResult = await sendAhaEmail({
            from: { email: fromEmail },
            recipients: [{ email: recipient.email }],
            subject,
            html_content: content,
            text_content: content.replace(/<[^>]*>/g, ""),
            reply_to: payload.replyTo,
          });
          // Extract per-recipient message ID from AhaSend v2 response
          const ahaMessages: any[] = ahaResult?.data || [];
          const ahaMsg = ahaMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
          emailData = { id: ahaMsg?.id || ahaResult.id || ahaResult.message_id || 'ahasend-fallback-success' };
          sendError = null;
        } catch (ahaError) {
          sendError = ahaError;
        }
      }

      if (sendError) {
        logger.error("Failed to send newsletter email via both providers", { error: sendError });
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

          const { data: resendData, error: resendError } = await resend.emails.send({
            from: fromEmail,
            to: recipient.email,
            subject: payload.subject,
            html: payload.content,
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
            logger.warn("Resend failed, falling back to AhaSend", { error: sendError.message, to: recipient.email });
            try {
              const ahaResult = await sendAhaEmail({
                from: { email: fromEmail },
                recipients: [{ email: recipient.email }],
                subject: payload.subject,
                html_content: payload.content,
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
          await convex.mutation("newsletterTracking:completeNewsletterSend" as any, {
            newsletterId: data.newsletterId,
            sentCount: 0,
            failedCount: 0,
          });
          logger.info("Convex tracking completed for zero recipients");
        }
      } catch (err) {
        logger.warn("Failed to complete Convex tracking for zero recipients (non-fatal)", { error: String(err) });
      }

      await updateNewsletterStatusInternal(data.newsletterId, "sent", {
        sentCount: 0,
        failedCount: 0,
        totalCount: 0,
      });
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
        // Resend batch API supports up to 100 per call; split if needed
        const bulkChunks: NewsletterRecipient[][] = [];
        for (let c = 0; c < batch.length; c += 100) {
          bulkChunks.push(batch.slice(c, c + 100));
        }

        for (const chunk of bulkChunks) {
          const bulkResults = await sendBulkEmails({
            recipients: chunk,
            subject: data.subject,
            content: data.content,
            from: fromEmail,
            replyTo: data.replyTo,
            newsletterId: data.newsletterId,
            groupUUID: data.groupUUID,
            tenantId: data.tenantId,
          });

          // Track each result individually in Convex
          for (const result of bulkResults) {
            if (result.success) {
              totalSent++;
              try {
                const convex = getConvex();
                if (convex) {
                  await convex.mutation("newsletterTracking:trackEmailSend" as any, {
                    tenantId: data.tenantId,
                    newsletterId: data.newsletterId,
                    groupUUID: data.groupUUID,
                    recipientEmail: result.recipientEmail,
                    recipientId: result.recipientId,
                    providerMessageId: result.providerMessageId,
                    status: "queued",
                  });
                }
              } catch (_) { }
            } else {
              totalFailed++;
              errors.push({ email: result.recipientEmail, error: result.error || "Unknown error" });
              try {
                const convex = getConvex();
                if (convex) {
                  await convex.mutation("newsletterTracking:trackEmailSend" as any, {
                    tenantId: data.tenantId,
                    newsletterId: data.newsletterId,
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
      } else {
        // ── INDIVIDUAL SEND: fewer than BULK_THRESHOLD recipients ──
        for (let j = 0; j < batch.length; j++) {
          const recipient = batch[j];

          try {
            const emailTrackingId = randomUUID();
            let emailData: any = null;
            let sendError: any = null;

            const { data: resendData, error: resendError } = await resend.emails.send({
              from: fromEmail,
              to: recipient.email,
              subject: data.subject,
              html: data.content,
              text: data.content.replace(/<[^>]*>/g, ""),
              replyTo: data.replyTo,
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
              logger.warn("Resend failed, falling back to AhaSend", { error: sendError.message, to: recipient.email });
              try {
                const ahaResult = await sendAhaEmail({
                  from: { email: fromEmail },
                  recipients: [{ email: recipient.email }],
                  subject: data.subject,
                  html_content: data.content,
                  text_content: data.content.replace(/<[^>]*>/g, ""),
                  reply_to: data.replyTo,
                });
                // Extract per-recipient message ID from AhaSend v2 response
                const ahaMessages: any[] = ahaResult?.data || [];
                const ahaMsg = ahaMessages.find((m: any) => m?.recipient?.email?.toLowerCase() === recipient.email.toLowerCase());
                emailData = { id: ahaMsg?.id || ahaResult.id || ahaResult.message_id || 'ahasend-fallback-success' };
                sendError = null;
              } catch (ahaError) {
                sendError = ahaError;
              }
            }

            if (sendError) {
              totalFailed++;
              errors.push({ email: recipient.email, error: sendError.message || String(sendError) });
              try {
                const convex = getConvex();
                if (convex) {
                  await convex.mutation("newsletterTracking:trackEmailSend" as any, {
                    tenantId: data.tenantId,
                    newsletterId: data.newsletterId,
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
                  await convex.mutation("newsletterTracking:trackEmailSend" as any, {
                    tenantId: data.tenantId,
                    newsletterId: data.newsletterId,
                    groupUUID: data.groupUUID,
                    recipientEmail: recipient.email,
                    recipientId: recipient.id,
                    providerMessageId: emailData?.id,
                    status: "queued",
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
                await convex.mutation("newsletterTracking:trackEmailSend" as any, {
                  tenantId: data.tenantId,
                  newsletterId: data.newsletterId,
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
    await updateNewsletterStatusInternal(data.newsletterId, "sent", {
      sentCount: totalSent,
      failedCount: totalFailed,
      totalCount: validRecipients.length,
    });

    // Complete Convex tracking
    try {
      const convex = getConvex();
      if (convex) {
        await convex.mutation("newsletterTracking:completeNewsletterSend" as any, {
          newsletterId: data.newsletterId,
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
