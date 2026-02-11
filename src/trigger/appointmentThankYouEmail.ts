import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";
import { createHmac } from "crypto";
import { wrapInEmailDesign } from "./emailWrapper";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY);

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
 */
async function logEmailActivity(params: {
    tenantId: string;
    contactId: string;
    activityType: string;
    activityData: object;
    webhookId: string;
}): Promise<{ success: boolean; error?: string }> {
    const apiUrl = process.env.API_URL || "http://localhost:5002";
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
                activityType: params.activityType,
            });
            return { success: false, error: errorMessage };
        }

        logger.info("Email activity logged successfully", {
            contactId: params.contactId,
            activityType: params.activityType,
        });
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("Error logging email activity", {
            error: errorMessage,
            contactId: params.contactId,
            activityType: params.activityType,
        });
        return { success: false, error: errorMessage };
    }
}

// Schema for thank-you email payload
const thankYouEmailPayloadSchema = z.object({
    appointmentId: z.string(),
    customerId: z.string(),
    customerEmail: z.string(),
    customerName: z.string(),
    appointmentTitle: z.string(),
    appointmentDate: z.string(),
    appointmentTime: z.string(),
    location: z.string().optional(),
    companyName: z.string().optional(),
    tenantId: z.string(),
    from: z.string().optional(),
    replyTo: z.string().optional(),
});

export type ThankYouEmailPayload = z.infer<typeof thankYouEmailPayloadSchema>;

/**
 * Send a thank-you email when an appointment is marked as completed
 */
export const sendThankYouEmailTask = task({
    id: "send-thank-you-email",
    maxDuration: 60,
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 1000,
        maxTimeoutInMs: 10000,
        factor: 2,
    },
    run: async (payload: ThankYouEmailPayload) => {
        const data = thankYouEmailPayloadSchema.parse(payload);

        logger.info("Sending thank-you email", {
            appointmentId: data.appointmentId,
            customerEmail: data.customerEmail,
        });

        const subject = `Thank You for Your Visit${data.companyName ? ` – ${data.companyName}` : ""}`;
        const html = await generateThankYouEmailHtml(data);

        try {
            const { data: emailData, error } = await resend.emails.send({
                from: data.from || process.env.EMAIL_FROM || "admin@zendwise.com",
                to: data.customerEmail,
                subject,
                html,
                replyTo: data.replyTo,
                tags: [
                    { name: "type", value: "thank-you" },
                    { name: "appointmentId", value: data.appointmentId },
                    { name: "tenantId", value: data.tenantId },
                ],
            });

            if (error) {
                logger.error("Failed to send thank-you email", { error });
                throw new Error(`Failed to send thank-you email: ${error.message}`);
            }

            logger.info("Thank-you email sent successfully", {
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
                        type: "thank-you",
                        emailId: emailData?.id,
                        appointmentId: data.appointmentId,
                        appointmentTitle: data.appointmentTitle,
                        appointmentDate: data.appointmentDate,
                        appointmentTime: data.appointmentTime,
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
                    appointmentId: data.appointmentId,
                });

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
                    emailId: emailData?.id,
                });
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
            logger.error("Exception sending thank-you email", { error: errorMessage });
            throw new Error(`Failed to send thank-you email: ${errorMessage}`);
        }
    },
});


/**
 * Helper to escape HTML characters to prevent injection
 */
function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Generate HTML for thank-you email wrapped in the master email design
 */
async function generateThankYouEmailHtml(data: ThankYouEmailPayload): Promise<string> {
    const safeLocation = data.location ? escapeHtml(data.location) : "";
    const locationSection = safeLocation
        ? `<p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${safeLocation}</p>`
        : "";

    const safeCompanyName = escapeHtml(data.companyName || "Our Team");
    const safeCustomerName = escapeHtml(data.customerName);
    const safeAppointmentTitle = escapeHtml(data.appointmentTitle);
    const safeAppointmentDate = escapeHtml(data.appointmentDate);
    const safeAppointmentTime = escapeHtml(data.appointmentTime);

    const bodyContent = `
    <h2 style="margin: 0 0 20px 0; color: #065f46; font-size: 22px; text-align: center;">Thank You for Your Visit!</h2>
    
    <p style="margin: 0 0 20px 0;">Hi ${safeCustomerName},</p>
    
    <p style="margin: 0 0 20px 0;">Thank you for visiting us! We truly appreciate your time and hope everything went well during your appointment.</p>
    
    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
      <h3 style="margin: 0 0 15px 0; color: #065f46; font-size: 18px;">Appointment Summary</h3>
      <p style="margin: 0 0 10px 0;"><strong>Service:</strong> ${safeAppointmentTitle}</p>
      <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${safeAppointmentDate}</p>
      <p style="margin: 0 0 10px 0;"><strong>Time:</strong> ${safeAppointmentTime}</p>
      ${locationSection}
    </div>
    
    <p style="margin: 0 0 20px 0;">Your satisfaction is our top priority. If you have any feedback or questions about your visit, we'd love to hear from you.</p>
    
    <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
      We look forward to seeing you again soon!
    </p>
    
    <p style="margin: 20px 0 0 0; color: #374151;">
      Warm regards,<br>
      <strong>${safeCompanyName}</strong>
    </p>
  `;

    return wrapInEmailDesign(data.tenantId, bodyContent);
}
