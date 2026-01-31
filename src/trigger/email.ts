import { task, wait, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY);

// Schema for single email payload
const emailPayloadSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  headers: z.record(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  scheduledFor: z.string().optional(),
});

export type EmailPayload = z.infer<typeof emailPayloadSchema>;

// Schema for batch email payload
const batchEmailPayloadSchema = z.object({
  emails: z.array(z.object({
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
    text: z.string().optional(),
    headers: z.record(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  })),
  from: z.string().optional(),
  batchSize: z.number().default(10),
  delayBetweenBatches: z.number().default(1000),
});

export type BatchEmailPayload = z.infer<typeof batchEmailPayloadSchema>;

/**
 * Send a single email immediately or at a scheduled time
 */
export const sendEmailTask = task({
  id: "send-email",
  maxDuration: 60,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: EmailPayload) => {
    const data = emailPayloadSchema.parse(payload);

    // If scheduled for later, wait until that time
    if (data.scheduledFor) {
      const scheduledDate = new Date(data.scheduledFor);
      if (scheduledDate > new Date()) {
        logger.info("Email scheduled for later", { scheduledFor: data.scheduledFor });
        await wait.until({ date: scheduledDate });
      }
    }

    const recipients = Array.isArray(data.to) ? data.to : [data.to];

    logger.info("Sending email", {
      to: recipients,
      subject: data.subject,
    });

    try {
      const { data: emailData, error } = await resend.emails.send({
        from: data.from || process.env.EMAIL_FROM || "admin@zendwise.com",
        to: recipients,
        subject: data.subject,
        html: data.html,
        text: data.text,
        replyTo: data.replyTo,
        headers: data.headers,
        tags: data.metadata ? Object.entries(data.metadata).slice(0, 5).map(([name, value]) => ({
          name,
          value: String(value),
        })) : undefined,
      });

      if (error) {
        logger.error("Failed to send email", { error });
        return {
          success: false,
          to: recipients,
          subject: data.subject,
          error: error.message,
        };
      }

      logger.info("Email sent successfully", {
        emailId: emailData?.id,
        to: recipients,
      });

      return {
        success: true,
        emailId: emailData?.id,
        to: recipients,
        subject: data.subject,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending email", { error: errorMessage });
      return {
        success: false,
        to: recipients,
        subject: data.subject,
        error: errorMessage,
      };
    }
  },
});

/**
 * Send batch emails with rate limiting
 */
export const sendBatchEmailsTask = task({
  id: "send-batch-emails",
  maxDuration: 600, // 10 minutes for large batches
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: BatchEmailPayload) => {
    const data = batchEmailPayloadSchema.parse(payload);
    const { emails, from, batchSize, delayBetweenBatches } = data;

    logger.info("Starting batch email send", { totalEmails: emails.length, batchSize });

    const results: { email: string; success: boolean; emailId?: string; error?: string }[] = [];
    const fromAddress = from || process.env.EMAIL_FROM || "admin@zendwise.com";

    // Process in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(emails.length / batchSize);

      logger.info(`Processing batch ${batchNumber}/${totalBatches}`, { batchSize: batch.length });

      for (const emailItem of batch) {
        try {
          const { data: emailData, error } = await resend.emails.send({
            from: fromAddress,
            to: emailItem.to,
            subject: emailItem.subject,
            html: emailItem.html,
            text: emailItem.text,
            headers: emailItem.headers,
            tags: emailItem.metadata ? Object.entries(emailItem.metadata).slice(0, 5).map(([name, value]) => ({
              name,
              value: String(value),
            })) : undefined,
          });

          if (error) {
            results.push({ email: emailItem.to, success: false, error: error.message });
          } else {
            results.push({ email: emailItem.to, success: true, emailId: emailData?.id });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          results.push({ email: emailItem.to, success: false, error: errorMessage });
        }

        // Small delay between individual emails
        await wait.for({ seconds: 0.1 });
      }

      // Delay between batches
      if (i + batchSize < emails.length) {
        await wait.for({ seconds: delayBetweenBatches / 1000 });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    logger.info("Batch email send completed", {
      total: emails.length,
      success: successCount,
      failed: failedCount,
    });

    return {
      total: emails.length,
      success: successCount,
      failed: failedCount,
      results,
    };
  },
});

/**
 * Schedule an email for future delivery
 */
export const scheduleEmailTask = task({
  id: "schedule-email",
  maxDuration: 86400, // 24 hours max
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: EmailPayload & { scheduledFor: string }) => {
    const data = emailPayloadSchema.parse(payload);

    if (!data.scheduledFor) {
      throw new Error("scheduledFor is required for scheduled emails");
    }

    const scheduledDate = new Date(data.scheduledFor);

    logger.info("Scheduling email", {
      to: data.to,
      subject: data.subject,
      scheduledFor: data.scheduledFor,
    });

    // Wait until scheduled time
    await wait.until({ date: scheduledDate });

    logger.info("Scheduled time reached, sending email");

    // Send the email
    const result = await sendEmailTask.triggerAndWait({
      ...data,
      scheduledFor: undefined,
    });

    if (result.ok) {
      return result.output;
    }

    throw new Error(`Email send failed: ${result.error}`);
  },
});
