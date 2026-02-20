import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";
import { createHmac } from "crypto";
import { wrapInEmailDesign } from "./emailWrapper";
import { DB_RETRY_CONFIG, dbConnectionCatchError } from "./retryStrategy";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

/**
 * Generate HMAC signature for internal service authentication
 */
function generateInternalSignature(payload: object, timestamp: number): string {
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    if (!secret) {
        throw new Error("INTERNAL_SERVICE_SECRET is not configured");
    }
    const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
    return createHmac("sha256", secret).update(signaturePayload).digest("hex");
}

/**
 * Log email activity to the server via internal API
 * Returns success status so callers can handle failures appropriately
 */
async function logEmailActivity(params: {
    tenantId: string;
    contactId: string;
    activityType: string;
    activityData: object;
    webhookId: string;
}): Promise<{ success: boolean; error?: string }> {
    const apiUrl = process.env.API_URL || "http://localhost:5000";
    const timestamp = Date.now();
    const body = {
        tenantId: params.tenantId,
        contactId: params.contactId,
        activityType: params.activityType,
        activityData: params.activityData,
        occurredAt: new Date().toISOString(),
        webhookId: params.webhookId,
    };

    try {
        const signature = generateInternalSignature(body, timestamp);
        
        const response = await fetch(`${apiUrl}/api/internal/email-activity`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-service": "trigger.dev",
                "x-internal-timestamp": timestamp.toString(),
                "x-internal-signature": signature,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `HTTP ${response.status}`;
            logger.error("Failed to log email activity", { 
                status: response.status, 
                error: errorMessage,
                contactId: params.contactId,
                activityType: params.activityType 
            });
            return { success: false, error: errorMessage };
        }

        logger.info("Email activity logged successfully", { 
            contactId: params.contactId,
            activityType: params.activityType 
        });
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("Error logging email activity", { 
            error: errorMessage,
            contactId: params.contactId,
            activityType: params.activityType 
        });
        return { success: false, error: errorMessage };
    }
}

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
    retry: DB_RETRY_CONFIG,
    catchError: dbConnectionCatchError,
    run: async (payload: RescheduleEmailPayload) => {
        const data = rescheduleEmailPayloadSchema.parse(payload);

        logger.info("Sending reschedule invitation email", {
            appointmentId: data.appointmentId,
            customerEmail: data.customerEmail,
            status: data.status,
        });

        const statusText = data.status === "cancelled" ? "cancelled" : "missed";
        const subject = `We'd Love to See You - Reschedule Your Appointment`;
        const html = await generateRescheduleEmailHtml(data, statusText);

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

            // Log email activity to customer's timeline with retry logic
            const webhookId = `trigger-${data.customerId}-sent-${Date.now()}`;
            let activityLogged = false;
            let activityError: string | undefined;
            
            for (let attempt = 1; attempt <= 3; attempt++) {
                const result = await logEmailActivity({
                    tenantId: data.tenantId,
                    contactId: data.customerId,
                    activityType: "sent",
                    webhookId,
                    activityData: {
                        type: "reschedule-invitation",
                        emailId: emailData?.id,
                        appointmentId: data.appointmentId,
                        appointmentTitle: data.appointmentTitle,
                        appointmentDate: data.appointmentDate,
                        appointmentTime: data.appointmentTime,
                        originalStatus: data.status,
                        subject,
                        recipient: data.customerEmail,
                        from: data.from || process.env.EMAIL_FROM || "admin@zendwise.com",
                    },
                });
                
                if (result.success) {
                    activityLogged = true;
                    break;
                }
                
                activityError = result.error;
                logger.warn(`Email activity logging attempt ${attempt} failed`, {
                    error: activityError,
                    contactId: data.customerId,
                    appointmentId: data.appointmentId
                });
                
                // Wait before retry (exponential backoff: 1s, 2s, 4s)
                if (attempt < 3) {
                    const delayMs = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            
            if (!activityLogged) {
                logger.error("Failed to log email activity after 3 attempts", {
                    error: activityError,
                    contactId: data.customerId,
                    appointmentId: data.appointmentId,
                    emailId: emailData?.id
                });
                // Don't fail the entire task for activity logging issues, but log the failure clearly
                // This could be extended to send alerts or create a retry queue in the future
            }

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
 * Generate HTML for reschedule invitation email wrapped in the master email design
 */
async function generateRescheduleEmailHtml(data: RescheduleEmailPayload, statusText: string): Promise<string> {
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

    const bodyContent = `
    <h2 style="margin: 0 0 20px 0; color: #92400e; font-size: 22px; text-align: center;">We'd Love to Reschedule</h2>
    
    <p style="margin: 0 0 20px 0;">Hi ${data.customerName},</p>
    
    <p style="margin: 0 0 20px 0;">${statusMessage}</p>
    
    <p style="margin: 0 0 20px 0;">We understand that life gets busy, and we'd love the opportunity to see you again. Here are the details of your ${statusText} appointment:</p>
    
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
      <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">${data.appointmentTitle}</h3>
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
  `;

    return wrapInEmailDesign(data.tenantId, bodyContent);
}
