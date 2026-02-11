import { task, wait, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);

const emailAttachmentSchema = z.object({
  filename: z.string(),
  content: z.string(), // base64 encoded
  contentType: z.string(),
});

const scheduleContactEmailPayloadSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  // The UTC ISO string at which the email should be sent
  scheduledForUTC: z.string(),
  // Original timezone the user selected (for logging/display)
  timezone: z.string().optional(),
  // Metadata for tracking
  contactId: z.string(),
  tenantId: z.string(),
  scheduledBy: z.string().optional(),
  emailTrackingId: z.string().optional(),
  // Attachments (base64 encoded)
  attachments: z.array(emailAttachmentSchema).optional(),
});

export type ScheduleContactEmailPayload = z.infer<typeof scheduleContactEmailPayloadSchema>;

/**
 * Schedule a B2C contact email for future delivery at a specific time.
 * The scheduledForUTC field must already be converted to UTC by the backend.
 * Uses wait.until to pause until the scheduled time, then sends via Resend.
 */
export const scheduleContactEmailTask = task({
  id: "schedule-contact-email",
  // Allow scheduling up to 30 days out
  maxDuration: 2592000,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: ScheduleContactEmailPayload) => {
    const data = scheduleContactEmailPayloadSchema.parse(payload);

    const scheduledDate = new Date(data.scheduledForUTC);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error("Invalid scheduledForUTC date");
    }

    const now = new Date();
    const delayMs = scheduledDate.getTime() - now.getTime();

    logger.info("Schedule contact email task started", {
      to: data.to,
      subject: data.subject,
      scheduledForUTC: data.scheduledForUTC,
      timezone: data.timezone,
      delayMs,
      contactId: data.contactId,
      tenantId: data.tenantId,
    });

    // Wait until the scheduled time
    if (delayMs > 0) {
      logger.info(`Waiting until ${scheduledDate.toISOString()} (${data.timezone || 'UTC'})`, {
        delaySeconds: Math.round(delayMs / 1000),
      });
      await wait.until({ date: scheduledDate });
    } else {
      logger.warn("Scheduled time is in the past or now, sending immediately", {
        scheduledForUTC: data.scheduledForUTC,
        now: now.toISOString(),
      });
    }

    logger.info("Scheduled time reached, sending email via Resend", {
      to: data.to,
      subject: data.subject,
    });

    // Notify the backend that we're about to send (update status to 'running')
    await notifyBackend(data, 'sending');

    try {
      // Build Resend attachments from base64 data
      const resendAttachments = data.attachments?.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        content_type: att.contentType,
      }));

      const { data: emailData, error } = await resend.emails.send({
        from: data.from || process.env.EMAIL_FROM || "admin@zendwise.com",
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
        replyTo: data.replyTo,
        tags: [
          { name: "type", value: "scheduled-b2c" },
          { name: "contactId", value: data.contactId },
          { name: "tenantId", value: data.tenantId },
        ],
        ...(resendAttachments && resendAttachments.length > 0 && { attachments: resendAttachments }),
      });

      if (error) {
        logger.error("Resend API returned error", { error });
        await notifyBackend(data, 'failed', error.message);
        throw new Error(error.message);
      }

      logger.info("Scheduled email sent successfully", {
        emailId: emailData?.id,
        to: data.to,
        subject: data.subject,
        contactId: data.contactId,
      });

      // Notify backend of successful send
      await notifyBackend(data, 'sent', undefined, emailData?.id);

      return {
        success: true,
        emailId: emailData?.id,
        to: data.to,
        subject: data.subject,
        contactId: data.contactId,
        tenantId: data.tenantId,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending scheduled email", { error: errorMessage });
      await notifyBackend(data, 'failed', errorMessage);
      throw new Error(`Failed to send scheduled email: ${errorMessage}`);
    }
  },
});

/**
 * Helper to generate HMAC signature for internal service calls
 */
async function signInternal(body: Record<string, any>, secret: string) {
  const { createHmac } = await import('crypto');
  const timestamp = Date.now();
  const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
  const signature = createHmac('sha256', secret).update(signaturePayload).digest('hex');
  return { timestamp, signature };
}

/**
 * Notify the backend server about the status of a scheduled email send.
 * - Updates email_sends record via internal API (when emailTrackingId exists)
 * - Logs email_activity for sent/failed status
 * Both use internal service authentication.
 */
async function notifyBackend(
  data: ScheduleContactEmailPayload,
  status: 'sending' | 'sent' | 'failed',
  errorMessage?: string,
  providerMessageId?: string,
) {
  const apiUrl = process.env.API_URL || 'http://localhost:5002';
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  if (!secret) {
    logger.warn("INTERNAL_SERVICE_SECRET not configured, skipping backend notification");
    return;
  }

  // 1. Update email_sends record via internal API (only for sent/failed, not 'sending')
  if (data.emailTrackingId && status !== 'sending') {
    try {
      const body: Record<string, any> = {
        emailTrackingId: data.emailTrackingId,
        status,
      };
      if (providerMessageId) {
        body.providerMessageId = providerMessageId;
      }

      const { timestamp, signature } = await signInternal(body, secret);

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
        logger.warn("Failed to update email_sends via internal API", {
          httpStatus: response.status,
          emailTrackingId: data.emailTrackingId,
        });
      } else {
        logger.info("Updated email_sends record", {
          emailTrackingId: data.emailTrackingId,
          status,
          providerMessageId,
        });
      }
    } catch (notifyError) {
      logger.warn("Error updating email_sends", {
        error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
      });
    }
  }

  // 2. Log email_activity for sent/failed (so it shows in the contact timeline)
  if (status === 'sent' || status === 'failed') {
    try {
      const activityBody: Record<string, any> = {
        tenantId: data.tenantId,
        contactId: data.contactId,
        activityType: status,
        activityData: JSON.stringify({
          type: 'scheduled-email',
          subject: data.subject,
          to: data.to,
          scheduledFor: data.scheduledForUTC,
          timezone: data.timezone,
          providerMessageId: providerMessageId || null,
          emailTrackingId: data.emailTrackingId || null,
          error: errorMessage || null,
        }),
      };

      const { timestamp, signature } = await signInternal(activityBody, secret);

      const response = await fetch(`${apiUrl}/api/internal/log-email-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': 'trigger.dev',
          'x-internal-timestamp': timestamp.toString(),
          'x-internal-signature': signature,
        },
        body: JSON.stringify(activityBody),
      });

      if (!response.ok) {
        logger.warn("Failed to log email_activity via internal API", {
          httpStatus: response.status,
          contactId: data.contactId,
        });
      } else {
        logger.info("Logged email_activity", { contactId: data.contactId, status });
      }
    } catch (activityError) {
      logger.warn("Error logging email_activity", {
        error: activityError instanceof Error ? activityError.message : 'Unknown error',
      });
    }
  }
}
