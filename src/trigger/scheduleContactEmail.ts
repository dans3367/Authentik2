import { task, wait, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);

const scheduleContactEmailPayloadSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  // The UTC ISO string at which the email shoul997d be sent
  scheduledForUTC: z.string(),
  // Original timezone the user selected (for logging/display)
  timezone: z.string().optional(),
  // Metadata for tracking
  contactId: z.string(),
  tenantId: z.string(),
  scheduledBy: z.string().optional(),
  emailTrackingId: z.string().optional(),
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
      });

      if (error) {
        logger.error("Resend API returned error", { error });
        await notifyBackend(data, 'failed', error.message);
        return {
          success: false,
          to: data.to,
          subject: data.subject,
          error: error.message,
          contactId: data.contactId,
        };
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
 * Notify the backend server about the status of a scheduled email send.
 * Uses the internal service authentication to call back to the main API.
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

  // If we have an emailTrackingId, update the email_sends record
  if (data.emailTrackingId) {
    try {
      const { createHmac } = await import('crypto');
      const timestamp = Date.now();
      const body: Record<string, any> = {
        emailTrackingId: data.emailTrackingId,
        status: status === 'sending' ? 'sent' : status,
      };
      if (providerMessageId) {
        body.providerMessageId = providerMessageId;
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
        logger.warn("Failed to update email send status via internal API", {
          status: response.status,
          emailTrackingId: data.emailTrackingId,
        });
      }
    } catch (notifyError) {
      logger.warn("Error notifying backend of email status", {
        error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
      });
    }
  }
}
