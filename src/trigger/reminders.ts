import { task, wait, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createHmac } from "crypto";
import { z } from "zod";
import { wrapInEmailDesign } from "./emailWrapper";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

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
  duration: z.number().optional(),
  location: z.string().optional(),
  reminderType: z.enum(["email", "sms", "push"]),
  content: z.string().optional(),
  tenantId: z.string(),
  timezone: z.string().optional(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  scheduledFor: z.string().optional(),
  confirmationToken: z.string().optional(),
});

export type ReminderPayload = z.infer<typeof reminderPayloadSchema>;

/**
 * Send an appointment reminder immediately
 */
export const sendReminderTask = task({
  id: "send-appointment-reminder",
  maxDuration: 60,
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
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
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
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
  retry: DB_RETRY_CONFIG,
  catchError: dbConnectionCatchError,
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
        await wait.for({ seconds: 0.5 });
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
  const locationRow = data.location
    ? `<tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="36" valign="top" style="padding-right: 12px;">
              <div style="width: 36px; height: 36px; background-color: #fef3c7; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">&#128205;</div>
            </td>
            <td>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Location</p>
              <p style="margin: 4px 0 0 0; font-size: 15px; color: #1e293b; font-weight: 500;">${data.location}</p>
            </td>
          </tr></table>
        </td>
      </tr>`
    : "";

  const durationRow = data.duration
    ? `<tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="36" valign="top" style="padding-right: 12px;">
              <div style="width: 36px; height: 36px; background-color: #fce7f3; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">&#9202;</div>
            </td>
            <td>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Duration</p>
              <p style="margin: 4px 0 0 0; font-size: 15px; color: #1e293b; font-weight: 500;">${data.duration} minutes</p>
            </td>
          </tr></table>
        </td>
      </tr>`
    : "";

  const customMessageSection = data.content
    ? `<div style="margin: 24px 0 0 0; padding: 16px 20px; background: linear-gradient(135deg, #eff6ff, #f0f9ff); border-radius: 10px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">${data.content.replace(/\n/g, '<br/>')}</p>
      </div>`
    : "";

  const baseUrl = process.env.BASE_URL || process.env.API_URL || 'http://localhost:5002';
  const tokenParam = data.confirmationToken ? `?token=${encodeURIComponent(data.confirmationToken)}` : '';
  const confirmUrl = `${baseUrl}/api/appointments/${data.appointmentId}/confirm${tokenParam}`;
  const declineUrl = `${baseUrl}/api/appointments/${data.appointmentId}/decline${tokenParam}`;

  const bodyContent = `
    <div style="padding: 32px 32px 0 32px;">
      <p style="margin: 0 0 6px 0; color: #6366f1; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Appointment Reminder</p>
      <h2 style="margin: 0 0 8px 0; color: #0f172a; font-size: 24px; font-weight: 700; line-height: 1.3;">${data.appointmentTitle}</h2>
      <p style="margin: 0 0 28px 0; color: #64748b; font-size: 15px; line-height: 1.5;">Hi ${data.customerName}, this is a friendly reminder about your upcoming appointment.</p>
    </div>

    <div style="padding: 0 32px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 16px 16px 8px 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px 12px 0 0;">
            <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 600; letter-spacing: 0.02em;">&#128197; Appointment Details</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td width="36" valign="top" style="padding-right: 12px;">
                <div style="width: 36px; height: 36px; background-color: #ede9fe; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">&#128197;</div>
              </td>
              <td>
                <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Date</p>
                <p style="margin: 4px 0 0 0; font-size: 15px; color: #1e293b; font-weight: 500;">${data.appointmentDate}</p>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td width="36" valign="top" style="padding-right: 12px;">
                <div style="width: 36px; height: 36px; background-color: #dbeafe; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">&#128336;</div>
              </td>
              <td>
                <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Time</p>
                <p style="margin: 4px 0 0 0; font-size: 15px; color: #1e293b; font-weight: 500;">${data.appointmentTime}</p>
              </td>
            </tr></table>
          </td>
        </tr>
        ${durationRow}
        ${locationRow}
      </table>
    </div>

    <div style="padding: 28px 32px 0 32px;">
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
        If you need to reschedule or have any questions, please don't hesitate to contact us. We're happy to help!
      </p>
      ${customMessageSection}
    </div>

    <div style="padding: 28px 32px 8px 32px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; font-weight: 500;">Please confirm your attendance:</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding-right: 10px;" width="50%">
            <a href="${confirmUrl}" style="display: block; padding: 14px 20px; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; text-align: center; letter-spacing: 0.02em;">&#10003; Confirm</a>
          </td>
          <td width="50%">
            <a href="${declineUrl}" style="display: block; padding: 14px 20px; background-color: #ffffff; color: #ef4444; border: 2px solid #fecaca; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; text-align: center; letter-spacing: 0.02em;">&#10005; Not attending</a>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding: 24px 32px 12px 32px;">
      <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
        Best regards,<br/><span style="font-weight: 600; color: #64748b;">Your Team</span>
      </p>
    </div>

    <div style="padding: 0 32px 32px 32px;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px; font-style: italic; line-height: 1.5;">
        Please disregard this message if you have already called us to confirm your appointment.
      </p>
    </div>
  `;

  return wrapInEmailDesign(data.tenantId, bodyContent);
}
