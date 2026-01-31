import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY);

// Schema for reschedule email payload
const rescheduleEmailPayloadSchema = z.object({
    appointmentId: z.string(),
    customerId: z.string(),
    customerEmail: z.string(),
    customerName: z.string(),
    appointmentTitle: z.string(),
    appointmentDate: z.string(),
    appointmentTime: z.string(),
    location: z.string().optional(),
    status: z.enum(["cancelled", "no_show"]),
    tenantId: z.string(),
    from: z.string().optional(),
    replyTo: z.string().optional(),
    bookingUrl: z.string().optional(),
});

export type RescheduleEmailPayload = z.infer<typeof rescheduleEmailPayloadSchema>;

/**
 * Send a reschedule invitation email when an appointment is cancelled or marked as no-show
 */
export const sendRescheduleEmailTask = task({
    id: "send-reschedule-email",
    maxDuration: 60,
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 1000,
        maxTimeoutInMs: 10000,
        factor: 2,
    },
    run: async (payload: RescheduleEmailPayload) => {
        const data = rescheduleEmailPayloadSchema.parse(payload);

        logger.info("Sending reschedule invitation email", {
            appointmentId: data.appointmentId,
            customerEmail: data.customerEmail,
            status: data.status,
        });

        const statusText = data.status === "cancelled" ? "cancelled" : "missed";
        const subject = `We'd Love to See You - Reschedule Your Appointment`;
        const html = generateRescheduleEmailHtml(data, statusText);

        try {
            const { data: emailData, error } = await resend.emails.send({
                from: data.from || process.env.EMAIL_FROM || "admin@zendwise.com",
                to: data.customerEmail,
                subject,
                html,
                replyTo: data.replyTo,
                tags: [
                    { name: "type", value: "reschedule-invitation" },
                    { name: "appointmentId", value: data.appointmentId },
                    { name: "tenantId", value: data.tenantId },
                    { name: "originalStatus", value: data.status },
                ],
            });

            if (error) {
                logger.error("Failed to send reschedule email", { error });
                throw new Error(`Failed to send reschedule email: ${error.message}`);
            }

            logger.info("Reschedule email sent successfully", {
                emailId: emailData?.id,
                appointmentId: data.appointmentId,
            });

            return {
                success: true,
                emailId: emailData?.id,
                appointmentId: data.appointmentId,
                customerId: data.customerId,
                customerEmail: data.customerEmail,
                sentAt: new Date().toISOString(),
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            logger.error("Exception sending reschedule email", { error: errorMessage });
            throw new Error(`Failed to send reschedule email: ${errorMessage}`);
        }
    },
});

/**
 * Generate HTML for reschedule invitation email
 */
function generateRescheduleEmailHtml(data: RescheduleEmailPayload, statusText: string): string {
    const locationSection = data.location
        ? `<p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${data.location}</p>`
        : "";

    // Validate URL is HTTP/HTTPS only to prevent XSS via javascript: protocol
    const safeBookingUrl = data.bookingUrl && /^https?:\/\//i.test(data.bookingUrl)
        ? data.bookingUrl
        : null;

    const bookingSection = safeBookingUrl
        ? `<div style="margin: 30px 0; text-align: center;">
        <a href="${safeBookingUrl}" style="display: inline-block; padding: 14px 36px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Book a New Appointment</a>
      </div>`
        : `<p style="margin: 20px 0; text-align: center; color: #6b7280;">
        Please contact us to schedule a new appointment at your convenience.
      </p>`;

    const statusMessage = data.status === "cancelled"
        ? "We noticed that your appointment was cancelled."
        : "We're sorry we missed you at your recent appointment.";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">We'd Love to Reschedule</h1>
  </div>
  
  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 20px 0;">Hi ${data.customerName},</p>
    
    <p style="margin: 0 0 20px 0;">${statusMessage}</p>
    
    <p style="margin: 0 0 20px 0;">We understand that life gets busy, and we'd love the opportunity to see you again. Here are the details of your ${statusText} appointment:</p>
    
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
      <h2 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">${data.appointmentTitle}</h2>
      <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${data.appointmentDate}</p>
      <p style="margin: 0 0 10px 0;"><strong>Time:</strong> ${data.appointmentTime}</p>
      ${locationSection}
    </div>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 500; color: #1f2937;">
      Would you like to reschedule?
    </p>
    
    ${bookingSection}
    
    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
      We value your time and look forward to serving you. If you have any questions or need assistance, please don't hesitate to reach out.
    </p>
    
    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
      Thank you for your understanding,<br>
      <strong>Your Appointment Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
  </div>
</body>
</html>
  `.trim();
}
