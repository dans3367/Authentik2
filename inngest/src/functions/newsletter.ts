import { inngest } from "../client";
import { sendEmail } from "../email";
import { z } from "zod";

const newsletterRecipientSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactId: z.string().optional(),
});

const newsletterEventSchema = z.object({
  newsletterId: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  recipients: z.array(newsletterRecipientSchema),
  trackingEnabled: z.boolean().optional().default(true),
  tenantId: z.string().optional(),
});

export const sendNewsletterFunction = inngest.createFunction(
  {
    id: "send-newsletter",
    name: "Send Newsletter Campaign",
    retries: 2,
    concurrency: {
      limit: 5,
    },
  },
  { event: "newsletter/send" },
  async ({ event, step }) => {
    const data = newsletterEventSchema.parse(event.data);
    const { newsletterId, subject, html, text, from, replyTo, recipients, trackingEnabled } = data;

    const results: {
      email: string;
      success: boolean;
      emailId?: string;
      error?: string;
    }[] = [];

    // Process recipients in batches
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      const batchResults = await step.run(`send-batch-${batchIndex}`, async () => {
        const batchResultsInner: typeof results = [];

        for (const recipient of batch) {
          // Personalize HTML content
          let personalizedHtml = html
            .replace(/{{firstName}}/g, recipient.firstName || "")
            .replace(/{{lastName}}/g, recipient.lastName || "")
            .replace(/{{email}}/g, recipient.email);

          // Add tracking pixel if enabled
          if (trackingEnabled && recipient.contactId) {
            const trackingPixel = `<img src="${process.env.TRACKING_URL || ""}/track/open/${newsletterId}/${recipient.contactId}" width="1" height="1" style="display:none;" />`;
            personalizedHtml = personalizedHtml.replace("</body>", `${trackingPixel}</body>`);
          }

          const result = await sendEmail({
            to: recipient.email,
            from,
            subject,
            html: personalizedHtml,
            text,
            replyTo,
            tags: [
              { name: "newsletter_id", value: newsletterId },
              { name: "contact_id", value: recipient.contactId || "" },
            ],
          });

          batchResultsInner.push({
            email: recipient.email,
            success: result.success,
            emailId: result.id,
            error: result.error,
          });
        }

        return batchResultsInner;
      });

      results.push(...batchResults);

      // Rate limiting between batches
      if (batchIndex < batches.length - 1) {
        await step.sleep("batch-delay", "500ms");
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      newsletterId,
      total: recipients.length,
      success: successCount,
      failed: failureCount,
      results,
    };
  }
);

export const scheduleNewsletterFunction = inngest.createFunction(
  {
    id: "schedule-newsletter",
    name: "Schedule Newsletter for Future Delivery",
    retries: 1,
  },
  { event: "newsletter/schedule" },
  async ({ event, step }) => {
    const data = newsletterEventSchema.parse(event.data);
    const scheduledFor = z.string().parse(event.data.scheduledFor);

    // Wait until scheduled time
    await step.sleepUntil("wait-for-schedule", new Date(scheduledFor));

    // Trigger the actual send
    await step.sendEvent("trigger-newsletter-send", {
      name: "newsletter/send",
      data: {
        newsletterId: data.newsletterId,
        subject: data.subject,
        html: data.html,
        text: data.text,
        from: data.from,
        replyTo: data.replyTo,
        recipients: data.recipients,
        trackingEnabled: data.trackingEnabled,
        tenantId: data.tenantId,
      },
    });

    return {
      newsletterId: data.newsletterId,
      scheduledFor,
      triggeredAt: new Date().toISOString(),
      recipientCount: data.recipients.length,
    };
  }
);
