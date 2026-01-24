import { inngest } from "../client";
import { sendEmail } from "../email";
import { z } from "zod";

const emailEventSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  from: z.string().optional(),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
  replyTo: z.string().optional(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  metadata: z.record(z.string()).optional(),
});

export const sendEmailFunction = inngest.createFunction(
  {
    id: "send-email",
    name: "Send Email via Resend",
    retries: 3,
  },
  { event: "email/send" },
  async ({ event, step }) => {
    const data = emailEventSchema.parse(event.data);

    const result = await step.run("send-email-via-resend", async () => {
      return sendEmail({
        to: data.to,
        from: data.from,
        subject: data.subject,
        html: data.html,
        text: data.text,
        replyTo: data.replyTo,
        cc: data.cc,
        bcc: data.bcc,
        tags: data.tags,
      });
    });

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    return {
      emailId: result.id,
      to: data.to,
      subject: data.subject,
      metadata: data.metadata,
    };
  }
);

export const sendBulkEmailFunction = inngest.createFunction(
  {
    id: "send-bulk-email",
    name: "Send Bulk Emails via Resend",
    retries: 2,
  },
  { event: "email/send.bulk" },
  async ({ event, step }) => {
    const emails = z.array(emailEventSchema).parse(event.data.emails);
    const results: { to: string | string[]; success: boolean; id?: string; error?: string }[] = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      const result = await step.run(`send-email-${i}`, async () => {
        return sendEmail({
          to: email.to,
          from: email.from,
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: email.replyTo,
          cc: email.cc,
          bcc: email.bcc,
          tags: email.tags,
        });
      });

      results.push({
        to: email.to,
        success: result.success,
        id: result.id,
        error: result.error,
      });

      // Add a small delay between emails to avoid rate limiting
      if (i < emails.length - 1) {
        await step.sleep("rate-limit-delay", "100ms");
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      total: emails.length,
      success: successCount,
      failed: failureCount,
      results,
    };
  }
);

export const sendScheduledEmailFunction = inngest.createFunction(
  {
    id: "send-scheduled-email",
    name: "Send Scheduled Email",
    retries: 3,
  },
  { event: "email/schedule" },
  async ({ event, step }) => {
    const data = emailEventSchema.parse(event.data);
    const scheduledFor = z.string().parse(event.data.scheduledFor);

    // Wait until the scheduled time
    await step.sleepUntil("wait-for-schedule", new Date(scheduledFor));

    const result = await step.run("send-scheduled-email", async () => {
      return sendEmail({
        to: data.to,
        from: data.from,
        subject: data.subject,
        html: data.html,
        text: data.text,
        replyTo: data.replyTo,
        cc: data.cc,
        bcc: data.bcc,
        tags: data.tags,
      });
    });

    if (!result.success) {
      throw new Error(`Failed to send scheduled email: ${result.error}`);
    }

    return {
      emailId: result.id,
      to: data.to,
      subject: data.subject,
      scheduledFor,
      sentAt: new Date().toISOString(),
    };
  }
);
