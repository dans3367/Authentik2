import { inngest } from "../client";
import { sendEmail } from "../email";
import { z } from "zod";

const reminderEventSchema = z.object({
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
  from: z.string().optional(),
  replyTo: z.string().optional(),
});

const scheduledReminderEventSchema = reminderEventSchema.extend({
  scheduledFor: z.string(),
  reminderId: z.string(),
});

export const sendReminderFunction = inngest.createFunction(
  {
    id: "send-reminder",
    name: "Send Appointment Reminder",
    retries: 3,
  },
  { event: "reminder/send" },
  async ({ event, step }) => {
    const data = reminderEventSchema.parse(event.data);

    if (data.reminderType !== "email") {
      return {
        success: false,
        error: `Reminder type ${data.reminderType} is not yet supported`,
      };
    }

    const subject = `Reminder: ${data.appointmentTitle}`;
    const html = generateReminderEmailHtml(data);

    const result = await step.run("send-reminder-email", async () => {
      return sendEmail({
        to: data.customerEmail,
        from: data.from || "admin@zendwise.com",
        subject,
        html,
        replyTo: data.replyTo,
        tags: [
          { name: "type", value: "appointment-reminder" },
          { name: "appointmentId", value: data.appointmentId },
          { name: "tenantId", value: data.tenantId },
        ],
      });
    });

    if (!result.success) {
      throw new Error(`Failed to send reminder: ${result.error}`);
    }

    return {
      emailId: result.id,
      appointmentId: data.appointmentId,
      customerId: data.customerId,
      customerEmail: data.customerEmail,
      sentAt: new Date().toISOString(),
    };
  }
);

export const sendScheduledReminderFunction = inngest.createFunction(
  {
    id: "send-scheduled-reminder",
    name: "Send Scheduled Appointment Reminder",
    retries: 3,
  },
  { event: "reminder/schedule" },
  async ({ event, step }) => {
    const data = scheduledReminderEventSchema.parse(event.data);

    // Wait until the scheduled time
    await step.sleepUntil("wait-for-reminder-time", new Date(data.scheduledFor));

    if (data.reminderType !== "email") {
      return {
        success: false,
        error: `Reminder type ${data.reminderType} is not yet supported`,
      };
    }

    const subject = `Reminder: ${data.appointmentTitle}`;
    const html = generateReminderEmailHtml(data);

    const result = await step.run("send-scheduled-reminder-email", async () => {
      return sendEmail({
        to: data.customerEmail,
        from: data.from || "admin@zendwise.com",
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
    });

    if (!result.success) {
      throw new Error(`Failed to send scheduled reminder: ${result.error}`);
    }

    return {
      emailId: result.id,
      reminderId: data.reminderId,
      appointmentId: data.appointmentId,
      customerId: data.customerId,
      customerEmail: data.customerEmail,
      scheduledFor: data.scheduledFor,
      sentAt: new Date().toISOString(),
    };
  }
);

export const sendBulkRemindersFunction = inngest.createFunction(
  {
    id: "send-bulk-reminders",
    name: "Send Bulk Appointment Reminders",
    retries: 2,
  },
  { event: "reminder/send.bulk" },
  async ({ event, step }) => {
    const reminders = z.array(reminderEventSchema).parse(event.data.reminders);
    const results: { appointmentId: string; success: boolean; id?: string; error?: string }[] = [];

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
      const html = generateReminderEmailHtml(reminder);

      const result = await step.run(`send-reminder-${i}`, async () => {
        return sendEmail({
          to: reminder.customerEmail,
          from: reminder.from || "admin@zendwise.com",
          subject,
          html,
          replyTo: reminder.replyTo,
          tags: [
            { name: "type", value: "appointment-reminder" },
            { name: "appointmentId", value: reminder.appointmentId },
            { name: "tenantId", value: reminder.tenantId },
          ],
        });
      });

      results.push({
        appointmentId: reminder.appointmentId,
        success: result.success,
        id: result.id,
        error: result.error,
      });

      // Add a small delay between emails to avoid rate limiting
      if (i < reminders.length - 1) {
        await step.sleep("rate-limit-delay", "100ms");
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      total: reminders.length,
      success: successCount,
      failed: failureCount,
      results,
    };
  }
);

function generateReminderEmailHtml(data: z.infer<typeof reminderEventSchema>): string {
  const locationSection = data.location
    ? `<p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${data.location}</p>`
    : "";

  const customMessageSection = data.content
    ? `<div style="margin-top: 20px; padding: 15px; background-color: #f0f9ff; border-radius: 8px;">
        <p style="margin: 0; color: #1e40af;">${data.content}</p>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Appointment Reminder</h1>
  </div>
  
  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 20px 0;">Hi ${data.customerName},</p>
    
    <p style="margin: 0 0 20px 0;">This is a friendly reminder about your upcoming appointment:</p>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">${data.appointmentTitle}</h2>
      <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${data.appointmentDate}</p>
      <p style="margin: 0 0 10px 0;"><strong>Time:</strong> ${data.appointmentTime}</p>
      ${locationSection}
    </div>
    
    ${customMessageSection}
    
    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
      If you need to reschedule or cancel, please contact us as soon as possible.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated reminder. Please do not reply to this email.</p>
  </div>
</body>
</html>
  `.trim();
}
