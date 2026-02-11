import { task, wait, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createHmac } from "crypto";
import { z } from "zod";
import { wrapInEmailDesign } from "./emailWrapper";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Update reminder status via authenticated internal endpoint.
 * Called from within Trigger.dev tasks after sending reminders.
 */
async function updateReminderStatusInternal(
  reminderId: string,
  status: 'pending' | 'sent' | 'failed' | 'cancelled',
  errorMessage?: string
): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:5002';
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  if (!secret) {
    logger.warn('INTERNAL_SERVICE_SECRET not configured, skipping status update');
    return;
  }

  const timestamp = Date.now();
  const body = { status, errorMessage };
  const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
  const signature = createHmac('sha256', secret).update(signaturePayload).digest('hex');

  try {
    const response = await fetch(`${apiUrl}/api/appointment-reminders/internal/${reminderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'trigger.dev',
        'x-internal-timestamp': timestamp.toString(),
        'x-internal-signature': signature,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.warn(`Failed to update reminder status: ${response.status}`);
    } else {
      logger.info(`Reminder ${reminderId} status updated to: ${status}`);
    }
  } catch (err) {
    logger.warn(`Error updating reminder status: ${err}`);
  }
}

// Schema for reminder payload
const reminderPayloadSchema = z.object({
  reminderId: z.string(),
  appointmentId: z.string(),
  customerId: z.string(),
  customerEmail: z.string(),
  customerName: z.string(),
  appointmentTitle: z.string(),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  location: z.string().optional(),
  reminderType: z.enum(["email", "sms", "push"]),
  content: z.string().optional(),
  tenantId: z.string(),
  timezone: z.string().optional(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  scheduledFor: z.string().optional(),
});

export type ReminderPayload = z.infer<typeof reminderPayloadSchema>;

/**
 * Send an appointment reminder immediately
 */
export const sendReminderTask = task({
  id: "send-appointment-reminder",
  maxDuration: 60,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: ReminderPayload) => {
    const data = reminderPayloadSchema.parse(payload);

    logger.info("Sending appointment reminder", {
      reminderId: data.reminderId,
      appointmentId: data.appointmentId,
      customerEmail: data.customerEmail,
    });

    if (data.reminderType !== "email") {
      logger.warn(`Reminder type ${data.reminderType} is not yet supported`);
      return {
        success: false,
        error: `Reminder type ${data.reminderType} is not yet supported`,
      };
    }

    const subject = `Reminder: ${data.appointmentTitle}`;
    const html = await generateReminderEmailHtml(data);

    try {
      const { data: emailData, error } = await resend.emails.send({
        from: data.from || process.env.EMAIL_FROM || "admin@zendwise.com",
        to: data.customerEmail,
        subject,
        html,
        replyTo: data.replyTo,
        tags: [
          { name: "type", value: "appointment-reminder" },
          { name: "appointmentId", value: data.appointmentId },
          { name: "reminderId", value: data.reminderId },
          { name: "tenantId", value: data.tenantId },
        ],
      });

      if (error) {
        logger.error("Failed to send reminder email", { error });
        throw new Error(`Failed to send reminder: ${error.message}`);
      }

      logger.info("Reminder email sent successfully", {
        emailId: emailData?.id,
        reminderId: data.reminderId,
      });

      // Update reminder status to 'sent' via internal endpoint
      await updateReminderStatusInternal(data.reminderId, 'sent');

      return {
        success: true,
        emailId: emailData?.id,
        reminderId: data.reminderId,
        appointmentId: data.appointmentId,
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending reminder", { error: errorMessage });
      
      // Update reminder status to 'failed' via internal endpoint
      await updateReminderStatusInternal(data.reminderId, 'failed', errorMessage);
      
      throw new Error(`Failed to send reminder: ${errorMessage}`);
    }
  },
});

/**
 * Schedule an appointment reminder for a future time
 * Uses wait.until to pause execution until the scheduled time
 */
export const scheduleReminderTask = task({
  id: "schedule-appointment-reminder",
  maxDuration: 86400, // 24 hours max (reminders can be scheduled up to a day in advance)
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: ReminderPayload) => {
    const data = reminderPayloadSchema.parse(payload);

    if (!data.scheduledFor) {
      throw new Error("scheduledFor is required for scheduled reminders");
    }

    const scheduledDate = new Date(data.scheduledFor);
    
    logger.info("Scheduling appointment reminder", {
      reminderId: data.reminderId,
      appointmentId: data.appointmentId,
      scheduledFor: data.scheduledFor,
      customerEmail: data.customerEmail,
    });

    // Wait until the scheduled time
    await wait.until({ date: scheduledDate });

    logger.info("Wait completed, sending scheduled reminder", {
      reminderId: data.reminderId,
    });

    if (data.reminderType !== "email") {
      logger.warn(`Reminder type ${data.reminderType} is not yet supported`);
      return {
        success: false,
        error: `Reminder type ${data.reminderType} is not yet supported`,
      };
    }

    const subject = `Reminder: ${data.appointmentTitle}`;
    const html = await generateReminderEmailHtml(data);

    try {
      const { data: emailData, error } = await resend.emails.send({
        from: data.from || process.env.EMAIL_FROM || "admin@zendwise.com",
        to: data.customerEmail,
        subject,
        html,
        replyTo: data.replyTo,
        tags: [
          { name: "type", value: "appointment-reminder" },
          { name: "appointmentId", value: data.appointmentId },
          { name: "reminderId", value: data.reminderId },
          { name: "tenantId", value: data.tenantId },
        ],
      });

      if (error) {
        logger.error("Failed to send scheduled reminder email", { error });
        throw new Error(`Failed to send scheduled reminder: ${error.message}`);
      }

      logger.info("Scheduled reminder email sent successfully", {
        emailId: emailData?.id,
        reminderId: data.reminderId,
        scheduledFor: data.scheduledFor,
      });

      // Update reminder status to 'sent' via internal endpoint
      await updateReminderStatusInternal(data.reminderId, 'sent');

      return {
        success: true,
        emailId: emailData?.id,
        reminderId: data.reminderId,
        appointmentId: data.appointmentId,
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        scheduledFor: data.scheduledFor,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending scheduled reminder", { error: errorMessage });
      
      // Update reminder status to 'failed' via internal endpoint
      await updateReminderStatusInternal(data.reminderId, 'failed', errorMessage);
      
      throw new Error(`Failed to send scheduled reminder: ${errorMessage}`);
    }
  },
});

/**
 * Send bulk appointment reminders
 */
export const sendBulkRemindersTask = task({
  id: "send-bulk-reminders",
  maxDuration: 300, // 5 minutes for bulk operations
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: { reminders: ReminderPayload[] }) => {
    const reminders = z.array(reminderPayloadSchema).parse(payload.reminders);
    const results: { appointmentId: string; success: boolean; id?: string; error?: string }[] = [];

    logger.info("Starting bulk reminder send", { count: reminders.length });

    for (let i = 0; i < reminders.length; i++) {
      const reminder = reminders[i];

      if (reminder.reminderType !== "email") {
        results.push({
          appointmentId: reminder.appointmentId,
          success: false,
          error: `Reminder type ${reminder.reminderType} is not yet supported`,
        });
        continue;
      }

      const subject = `Reminder: ${reminder.appointmentTitle}`;
      const html = await generateReminderEmailHtml(reminder);

      try {
        const { data: emailData, error } = await resend.emails.send({
          from: reminder.from || process.env.EMAIL_FROM || "admin@zendwise.com",
          to: reminder.customerEmail,
          subject,
          html,
          replyTo: reminder.replyTo,
          tags: [
            { name: "type", value: "appointment-reminder" },
            { name: "appointmentId", value: reminder.appointmentId },
            { name: "tenantId", value: reminder.tenantId },
          ],
        });

        if (error) {
          results.push({
            appointmentId: reminder.appointmentId,
            success: false,
            error: error.message,
          });
        } else {
          results.push({
            appointmentId: reminder.appointmentId,
            success: true,
            id: emailData?.id,
          });
        }
      } catch (err) {
        results.push({
          appointmentId: reminder.appointmentId,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      // Small delay between emails to avoid rate limiting
      if (i < reminders.length - 1) {
        await wait.for({ milliseconds: 500 });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info("Bulk reminder send completed", {
      total: reminders.length,
      success: successCount,
      failed: failureCount,
    });

    return {
      total: reminders.length,
      success: successCount,
      failed: failureCount,
      results,
    };
  },
});

/**
 * Generate HTML for reminder email wrapped in the master email design
 */
async function generateReminderEmailHtml(data: ReminderPayload): Promise<string> {
  const locationSection = data.location
    ? `<p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${data.location}</p>`
    : "";

  const customMessageSection = data.content
    ? `<div style="margin-top: 20px; padding: 15px; background-color: #f0f9ff; border-radius: 8px;">
        <p style="margin: 0; color: #1e40af;">${data.content}</p>
      </div>`
    : "";

  const baseUrl = process.env.API_URL || 'http://localhost:5002';
  const confirmUrl = `${baseUrl}/api/appointments/${data.appointmentId}/confirm`;
  const declineUrl = `${baseUrl}/api/appointments/${data.appointmentId}/decline`;

  const bodyContent = `
    <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 22px; text-align: center;">Appointment Reminder</h2>
    
    <p style="margin: 0 0 20px 0;">Hi ${data.customerName},</p>
    
    <p style="margin: 0 0 20px 0;">This is a friendly reminder about your upcoming appointment:</p>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">${data.appointmentTitle}</h3>
      <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${data.appointmentDate}</p>
      <p style="margin: 0 0 10px 0;"><strong>Time:</strong> ${data.appointmentTime}</p>
      ${locationSection}
    </div>
    
    ${customMessageSection}
    
    <div style="margin: 30px 0; text-align: center;">
      <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Will you be attending?</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="padding: 0 8px;">
            <a href="${confirmUrl}" style="display: inline-block; padding: 12px 32px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Confirm</a>
          </td>
          <td style="padding: 0 8px;">
            <a href="${declineUrl}" style="display: inline-block; padding: 12px 32px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Not attending</a>
          </td>
        </tr>
      </table>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
      If you need to reschedule or cancel, please contact us as soon as possible.
    </p>
  `;

  return wrapInEmailDesign(data.tenantId, bodyContent);
}
