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
    // Validate URL is HTTP/HTTPS only to prevent XSS via javascript: protocol
    const safeBookingUrl = data.bookingUrl && /^https?:\/\//i.test(data.bookingUrl)
        ? data.bookingUrl
        : null;

    const statusMessage = data.status === "cancelled"
        ? "We noticed that your appointment was cancelled."
        : "We're sorry we missed you at your recent appointment.";

    const locationRow = data.location
        ? `<tr>
            <td style="padding: 12px 16px;">
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

    const updatedBookingSection = safeBookingUrl
        ? `<div style="padding: 0 32px 8px 32px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="text-align: center;">
                  <a href="${safeBookingUrl}" style="display: block; padding: 16px 24px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; text-align: center; letter-spacing: 0.02em;">&#128197; Book a New Appointment</a>
                </td>
              </tr>
            </table>
          </div>`
        : `<div style="padding: 0 32px 8px 32px;">
            <p style="margin: 0; text-align: center; color: #64748b; font-size: 14px; padding: 16px 20px; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
              Please contact us to schedule a new appointment at your convenience.
            </p>
          </div>`;

    const bodyContent = `
    <div style="padding: 32px 32px 0 32px; text-align: center;">
      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; margin: 0 auto 20px auto; text-align: center; line-height: 64px; font-size: 28px;">&#128197;</div>
      <p style="margin: 0 0 6px 0; color: #f59e0b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Reschedule Invitation</p>
      <h2 style="margin: 0 0 8px 0; color: #0f172a; font-size: 24px; font-weight: 700; line-height: 1.3;">We'd Love to See You Again</h2>
      <p style="margin: 0 0 28px 0; color: #64748b; font-size: 15px; line-height: 1.5;">Hi ${data.customerName}, ${statusMessage.toLowerCase()}</p>
    </div>

    <div style="padding: 0 32px 24px 32px;">
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">We understand that life gets busy, and we'd love the opportunity to see you again. Here are the details of your ${statusText} appointment:</p>
    </div>

    <div style="padding: 0 32px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 16px 16px 8px 16px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px 12px 0 0;">
            <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 600; letter-spacing: 0.02em;">&#128203; Previous Appointment</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td width="36" valign="top" style="padding-right: 12px;">
                <div style="width: 36px; height: 36px; background-color: #fef3c7; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">&#128188;</div>
              </td>
              <td>
                <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Service</p>
                <p style="margin: 4px 0 0 0; font-size: 15px; color: #1e293b; font-weight: 500;">${data.appointmentTitle}</p>
              </td>
            </tr></table>
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
        ${locationRow}
      </table>
    </div>

    <div style="padding: 28px 32px 0 32px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #0f172a; text-align: center;">Would you like to reschedule?</p>
    </div>

    ${updatedBookingSection}

    <div style="padding: 24px 32px 32px 32px;">
      <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center;">
        We value your time and look forward to serving you.<br/>If you have any questions, please don't hesitate to reach out.
      </p>
    </div>
  `;

    return wrapInEmailDesign(data.tenantId, bodyContent);
}
