import { task, wait, logger, metadata } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createHmac } from "crypto";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";

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
const resend = new Resend(process.env.RESEND_API_KEY);

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

  // Skip status update if API_URL is not configured or points to localhost (unreachable from cloud)
  if (!apiUrl || apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    logger.warn("API_URL not configured or points to localhost, skipping newsletter status update");
    return;
  }

  if (!secret) {
    logger.warn("INTERNAL_SERVICE_SECRET not configured, skipping status update");
    return;
  }

  const timestamp = Date.now();
  const body = { status, ...stats };
  const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
  const signature = createHmac("sha256", secret).update(signaturePayload).digest("hex");

  try {
    const response = await fetch(`${apiUrl}/api/newsletters/internal/${newsletterId}/status`, {
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
 * Check if an email is suppressed (bounced/unsubscribed)
 */
async function getSuppressionList(tenantId: string): Promise<Set<string>> {
  const apiUrl = process.env.API_URL;
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  // Skip suppression check if API_URL is not configured or points to localhost (unreachable from cloud)
  if (!apiUrl || apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    logger.warn("API_URL not configured or points to localhost, skipping suppression check (emails will still send)");
    return new Set();
  }

  if (!secret) {
    logger.warn("INTERNAL_SERVICE_SECRET not configured, skipping suppression check");
    return new Set();
  }

  const timestamp = Date.now();
  const signaturePayload = `${timestamp}.{}`;
  const signature = createHmac("sha256", secret).update(signaturePayload).digest("hex");

  try {
    const response = await fetch(`${apiUrl}/api/newsletters/internal/suppression-list?tenantId=${tenantId}`, {
      method: "GET",
      headers: {
        "x-internal-service": "trigger.dev",
        "x-internal-timestamp": timestamp.toString(),
        "x-internal-signature": signature,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return new Set((data.emails || []).map((e: string) => e.toLowerCase()));
    } else {
      logger.warn(`Suppression list API returned ${response.status}, proceeding without suppression check`);
    }
  } catch (err) {
    logger.warn(`Error fetching suppression list (non-fatal, emails will still send): ${err}`);
  }

  return new Set();
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
      const { data: emailData, error } = await resend.emails.send({
        from: payload.from || process.env.EMAIL_FROM || "admin@zendwise.com",
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
        ],
      });

      if (error) {
        logger.error("Failed to send newsletter email", { error });
        return {
          success: false,
          recipientId: recipient.id,
          email: recipient.email,
          error: error.message,
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

    const results: { success: boolean; email: string; error?: string }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      try {
        const { data: emailData, error } = await resend.emails.send({
          from: payload.from || process.env.EMAIL_FROM || "admin@zendwise.com",
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
          ],
        });

        if (error) {
          results.push({ success: false, email: recipient.email, error: error.message });
        } else {
          results.push({ success: true, email: recipient.email });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        results.push({ success: false, email: recipient.email, error: errorMessage });
      }

      // Small delay between emails to avoid rate limiting
      if (i < recipients.length - 1) {
        await wait.for({ milliseconds: 500 });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    logger.info(`Batch ${batchNumber} completed`, {
      newsletterId,
      success: successCount,
      failed: failedCount,
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

    metadata.set("status", "filtering");

    // Initialize Convex newsletter tracking (fire-and-forget)
    try {
      const convex = getConvex();
      if (convex) {
        await convex.mutation("newsletterTracking:initNewsletterSend" as any, {
          tenantId: data.tenantId,
          newsletterId: data.newsletterId,
          totalRecipients: data.recipients.length,
        });
        logger.info("Convex tracking initialized");
      }
    } catch (err) {
      logger.warn("Failed to init Convex tracking (non-fatal)", { error: String(err) });
    }

    // Filter out suppressed emails
    const suppressedEmails = await getSuppressionList(data.tenantId);
    const validRecipients = data.recipients.filter(
      (r) => !suppressedEmails.has(r.email.toLowerCase())
    );

    logger.info("Recipients filtered", {
      original: data.recipients.length,
      valid: validRecipients.length,
      suppressed: data.recipients.length - validRecipients.length,
    });

    metadata.set("validRecipients", validRecipients.length);
    metadata.set("suppressedCount", data.recipients.length - validRecipients.length);

    if (validRecipients.length === 0) {
      logger.warn("No valid recipients after filtering");
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

      logger.info(`Processing batch ${batchNumber}/${batches.length}`, {
        recipientCount: batch.length,
      });

      metadata.set("currentBatch", batchNumber);

      // Process each recipient in the batch
      for (let j = 0; j < batch.length; j++) {
        const recipient = batch[j];

        try {
          // Verify Resend API key is configured
          if (!process.env.RESEND_API_KEY) {
            logger.error("RESEND_API_KEY is not configured in Trigger.dev environment");
          }

          const fromEmail = data.from || process.env.EMAIL_FROM || "admin@zendwise.com";
          logger.info(`Sending email via Resend`, {
            to: recipient.email,
            from: fromEmail,
            subject: data.subject,
            hasApiKey: !!process.env.RESEND_API_KEY,
          });

          const { data: emailData, error } = await resend.emails.send({
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
            ],
          });

          logger.info("Resend API response", {
            emailId: emailData?.id,
            error: error ? JSON.stringify(error) : null,
            hasData: !!emailData,
          });

          if (error) {
            totalFailed++;
            errors.push({ email: recipient.email, error: error.message });

            // Track failed send in Convex
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
                  error: error.message,
                });
              }
            } catch (_) {}
          } else {
            totalSent++;

            // Track successful send in Convex
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
                  status: "sent",
                });
              }
            } catch (_) {}
          }
        } catch (err) {
          totalFailed++;
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          errors.push({ email: recipient.email, error: errorMessage });

          // Track error in Convex
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
          } catch (_) {}
        }

        // Update progress
        const processed = totalSent + totalFailed;
        const progress = Math.round((processed / validRecipients.length) * 100);
        metadata.set("sentCount", totalSent);
        metadata.set("failedCount", totalFailed);
        metadata.set("progress", progress);

        // Small delay between emails
        if (j < batch.length - 1) {
          await wait.for({ milliseconds: 500 });
        }
      }

      // Delay between batches
      if (i < batches.length - 1) {
        await wait.for({ milliseconds: 2000 });
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
