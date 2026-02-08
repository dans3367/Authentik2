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

    const apiUrl = process.env.API_URL || 'http://localhost:5002';
    const secret = process.env.INTERNAL_SERVICE_SECRET;

    async function updateEmailSendStatus(update: { emailTrackingId: string; providerMessageId?: string; status: 'sent' | 'failed' }) {
      if (!secret) {
        return;
      }

      const { createHmac } = await import('crypto');
      const timestamp = Date.now();
      const body: {
        emailTrackingId: string;
        providerMessageId?: string;
        status: 'sent' | 'failed';
      } = {
        emailTrackingId: update.emailTrackingId,
        status: update.status,
      };

      if (update.providerMessageId) {
        body.providerMessageId = update.providerMessageId;
      }
      const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
      const signature = createHmac('sha256', secret).update(signaturePayload).digest('hex');

      const response = await fetch(`${apiUrl}/api/internal/update-email-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': 'trigger.dev',
          'x-internal-timestamp': timestamp.toString(),
          'x-internal-signature': signature,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        logger.warn("Failed to update email send status", {
          status: response.status,
          emailTrackingId: update.emailTrackingId,
        });
      }
    }

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

        // If available, mark email_sends as failed
        if (data.metadata?.emailTrackingId) {
          try {
            await updateEmailSendStatus({
              emailTrackingId: String(data.metadata.emailTrackingId),
              status: 'failed',
            });
          } catch (updateError) {
            logger.warn("Error updating failed email status", {
              error: updateError instanceof Error ? updateError.message : 'Unknown error',
            });
          }
        }

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

      // If metadata contains emailTrackingId, update the email_sends record with actual Resend email ID
      if (data.metadata?.emailTrackingId && emailData?.id) {
        try {
          if (secret) {
            await updateEmailSendStatus({
              emailTrackingId: String(data.metadata.emailTrackingId),
              providerMessageId: String(emailData.id),
              status: 'sent',
            });
            logger.info("Updated email_sends record with Resend email ID", {
              emailTrackingId: data.metadata.emailTrackingId,
              resendEmailId: emailData.id,
            });
          }
        } catch (updateError) {
          logger.warn("Error updating email_sends record", {
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
          });
        }
      }

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

      // If available, mark email_sends as failed
      if (data.metadata?.emailTrackingId) {
        try {
          await updateEmailSendStatus({
            emailTrackingId: String(data.metadata.emailTrackingId),
            providerMessageId: String(data.metadata.emailTrackingId),
            status: 'failed',
          });
        } catch (updateError) {
          logger.warn("Error updating failed email status", {
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
          });
        }
      }

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

// Schema for promotional email payload
const promotionalEmailPayloadSchema = z.object({
  tenantId: z.string(),
  contactId: z.string(),
  recipientEmail: z.string().email(),
  recipientName: z.string(),
  senderName: z.string(),
  promoSubject: z.string(),
  htmlPromo: z.string(),
  unsubscribeToken: z.string().optional(),
  promotionId: z.string().nullable().optional(),
  manual: z.boolean().optional(),
  delayMs: z.number().optional(),
});

export type PromotionalEmailPayload = z.infer<typeof promotionalEmailPayloadSchema>;

/**
 * Schedule a promotional email with a delay
 * Uses wait.for to pause execution, then calls back to the server's internal API
 * to execute the email send with proper database logging
 */
export const schedulePromotionalEmailTask = task({
  id: "schedule-promotional-email",
  maxDuration: 300, // 5 minutes max
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: PromotionalEmailPayload) => {
    const data = promotionalEmailPayloadSchema.parse(payload);

    logger.info("Scheduling promotional email", {
      contactId: data.contactId,
      recipientEmail: data.recipientEmail,
      delayMs: data.delayMs || 0,
    });

    // Wait for the specified delay
    if (data.delayMs && data.delayMs > 0) {
      await wait.for({ seconds: data.delayMs / 1000 });
      logger.info("Delay completed, sending promotional email via internal API");
    }

    // Call the internal API endpoint to execute the email send with database logging
    const apiUrl = process.env.API_URL || 'http://localhost:5002';
    const secret = process.env.INTERNAL_SERVICE_SECRET;

    if (!secret) {
      logger.error('INTERNAL_SERVICE_SECRET not configured');
      throw new Error('INTERNAL_SERVICE_SECRET not configured');
    }

    const timestamp = Date.now();
    const body = {
      tenantId: data.tenantId,
      contactId: data.contactId,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      senderName: data.senderName,
      promoSubject: data.promoSubject,
      htmlPromo: data.htmlPromo,
      unsubscribeToken: data.unsubscribeToken,
      promotionId: data.promotionId,
      manual: data.manual,
    };

    const { createHmac } = await import('crypto');
    const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
    const signature = createHmac('sha256', secret).update(signaturePayload).digest('hex');

    try {
      const response = await fetch(`${apiUrl}/api/internal/send-promotional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': 'trigger.dev',
          'x-internal-timestamp': timestamp.toString(),
          'x-internal-signature': signature,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Failed to send promotional email via internal API: ${response.status}`, {
          error: errorText,
        });
        throw new Error(`Internal API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      logger.info("Promotional email sent successfully via internal API", {
        contactId: data.contactId,
        recipientEmail: data.recipientEmail,
      });

      return {
        success: true,
        contactId: data.contactId,
        recipientEmail: data.recipientEmail,
        tenantId: data.tenantId,
        promotionId: data.promotionId,
        sentAt: new Date().toISOString(),
        ...result,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending promotional email", { error: errorMessage });
      throw new Error(`Failed to send promotional email: ${errorMessage}`);
    }
  },
});
