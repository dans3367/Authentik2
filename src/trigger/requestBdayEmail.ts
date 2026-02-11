import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";
import { createHmac } from "crypto";
import { wrapInEmailDesign } from "./emailWrapper";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

// Schema for birthday request email payload
const requestBdayEmailPayloadSchema = z.object({
  tenantId: z.string(),
  contactId: z.string(),
  emailTrackingId: z.string(),
  contactEmail: z.string().email(),
  contactFirstName: z.string().nullable().optional(),
  contactLastName: z.string().nullable().optional(),
  tenantName: z.string().nullable().optional(),
  profileUpdateUrl: z
    .string()
    .url()
    .refine(
      (val) => {
        try {
          const protocol = new URL(val).protocol;
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      },
      {
        message: "profileUpdateUrl must be a valid http(s) URL",
      }
    ),
  fromEmail: z.string().optional(),
});

export type RequestBdayEmailPayload = z.infer<typeof requestBdayEmailPayloadSchema>;

/**
 * Send a birthday request email to a contact
 * Asks the customer to provide their birthday for special offers
 */
export const requestBdayEmailTask = task({
  id: "request-bday-email",
  maxDuration: 60,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: RequestBdayEmailPayload) => {
    try {
      const data = requestBdayEmailPayloadSchema.parse(payload);

      const apiUrl = process.env.API_URL || 'http://localhost:5002';
      const secret = process.env.INTERNAL_SERVICE_SECRET;

      const signInternal = (body: object): { timestamp: number; signature: string } => {
        if (!secret) {
          throw new Error('INTERNAL_SERVICE_SECRET is not configured');
        }
        const timestamp = Date.now();
        const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
        const signature = createHmac('sha256', secret).update(signaturePayload).digest('hex');
        return { timestamp, signature };
      };

      const updateEmailSendStatus = async (update: { providerMessageId: string; status: 'sent' | 'failed' }) => {
        if (!secret) {
          logger.warn('INTERNAL_SERVICE_SECRET not configured, skipping email_sends reconciliation');
          return;
        }

        const body = {
          emailTrackingId: data.emailTrackingId,
          providerMessageId: update.providerMessageId,
          status: update.status,
        };

        const { timestamp, signature } = signInternal(body);
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
          logger.warn('Failed to update email send status', {
            status: response.status,
            emailTrackingId: data.emailTrackingId,
          });
        }
      };

      const logEmailFailureActivity = async (errorMessage: string) => {
        if (!secret) {
          logger.warn('INTERNAL_SERVICE_SECRET not configured, skipping failure activity logging');
          return;
        }

        const webhookId = `trigger-bday-invite-failed-${data.emailTrackingId}`;
        const body = {
          tenantId: data.tenantId,
          contactId: data.contactId,
          activityType: 'failed',
          activityData: {
            type: 'birthday_invitation',
            emailTrackingId: data.emailTrackingId,
            error: errorMessage,
          },
          occurredAt: new Date().toISOString(),
          webhookId,
        };

        const { timestamp, signature } = signInternal(body);
        const response = await fetch(`${apiUrl}/api/internal/email-activity`, {
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
          logger.warn('Failed to log email failure activity', {
            status: response.status,
            emailTrackingId: data.emailTrackingId,
          });
        }
      };

      const rawContactName = data.contactFirstName
        ? `${data.contactFirstName}${data.contactLastName ? ` ${data.contactLastName}` : ""}`
        : "Valued Customer";
      const contactName = escapeHtml(rawContactName);
      const tenantName = escapeHtml(data.tenantName || "The Team");
      const profileUpdateUrlHref = escapeHtml(data.profileUpdateUrl);
      const profileUpdateUrlText = escapeHtml(data.profileUpdateUrl);

      const subject = `🎂 Help us celebrate your special day!`;

      const bodyContent = `
        <h2 style="margin: 0 0 20px 0; color: #e91e63; font-size: 22px; text-align: center;">🎂 Birthday Celebration!</h2>
        
        <p style="margin: 0 0 15px 0; font-size: 16px;">Hi ${contactName},</p>
        
        <p style="margin: 0 0 15px 0;">We'd love to make your birthday extra special! To ensure you don't miss out on exclusive birthday promotions, special offers, and personalized birthday surprises, we'd like to add your birthday to our records.</p>
        
        <p style="margin: 0 0 20px 0;">By sharing your birthday with us, you'll receive:</p>
        
        <ul style="margin: 0 0 20px 20px; padding: 0;">
          <li>🎁 Exclusive birthday discounts and offers</li>
          <li>🎉 Special birthday promotions</li>
          <li>📧 Personalized birthday messages</li>
          <li>🌟 Early access to birthday-themed content</li>
        </ul>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${profileUpdateUrlHref}" 
             style="background: linear-gradient(135deg, #e91e63, #f06292); 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 25px; 
                    font-weight: bold; 
                    display: inline-block; 
                    box-shadow: 0 4px 8px rgba(233, 30, 99, 0.3);">
            🎂 Add My Birthday
          </a>
        </div>
        
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">This link will expire in 30 days. Your privacy is important to us - we'll only use your birthday to send you special offers and birthday wishes.</p>
        
        <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border: 1px solid #e0e0e0; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: bold;">If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="margin: 0; word-break: break-all;">
            <a href="${profileUpdateUrlHref}" style="color: #e91e63; text-decoration: none; font-size: 12px;">${profileUpdateUrlText}</a>
          </p>
        </div>
        
        <p style="margin: 20px 0 0 0; font-size: 14px; color: #666; text-align: center;">Best regards,<br>${tenantName}</p>
      `;

      const htmlContent = await wrapInEmailDesign(data.tenantId, bodyContent);

      logger.info("Sending birthday request email", {
        contactId: data.contactId,
        contactEmail: data.contactEmail,
        tenantId: data.tenantId,
      });

      const { data: emailData, error } = await resend.emails.send({
        from: data.fromEmail || process.env.EMAIL_FROM || "noreply@zendwise.com",
        to: data.contactEmail,
        subject,
        html: htmlContent,
        tags: [
          { name: "type", value: "birthday_request" },
          { name: "contactId", value: data.contactId },
          { name: "tenantId", value: data.tenantId },
        ],
      });

      if (error) {
        logger.error("Failed to send birthday request email", { error });

        await updateEmailSendStatus({
          providerMessageId: `resend_error:${data.emailTrackingId}`,
          status: 'failed',
        });
        await logEmailFailureActivity(error.message);

        return {
          success: false,
          contactId: data.contactId,
          contactEmail: data.contactEmail,
          tenantId: data.tenantId,
          error: error.message,
        };
      }

      logger.info("Birthday request email sent successfully", {
        emailId: emailData?.id,
        contactId: data.contactId,
        contactEmail: data.contactEmail,
      });

      if (emailData?.id) {
        await updateEmailSendStatus({
          providerMessageId: emailData.id,
          status: 'sent',
        });
      }

      return {
        success: true,
        emailId: emailData?.id,
        contactId: data.contactId,
        contactEmail: data.contactEmail,
        tenantId: data.tenantId,
        sentAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Exception sending birthday request email", { error: errorMessage });

      try {
        const parsed = requestBdayEmailPayloadSchema.safeParse(payload);
        if (parsed.success) {
          const apiUrl = process.env.API_URL || 'http://localhost:5002';
          const secret = process.env.INTERNAL_SERVICE_SECRET;
          if (secret) {
            const body = {
              emailTrackingId: parsed.data.emailTrackingId,
              status: 'failed',
            };
            const timestamp = Date.now();
            const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;
            const signature = createHmac('sha256', secret).update(signaturePayload).digest('hex');
            await fetch(`${apiUrl}/api/internal/update-email-send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-service': 'trigger.dev',
                'x-internal-timestamp': timestamp.toString(),
                'x-internal-signature': signature,
              },
              body: JSON.stringify(body),
            }).catch(() => undefined);

            const webhookId = `trigger-bday-invite-failed-${parsed.data.emailTrackingId}`;
            const activityBody = {
              tenantId: parsed.data.tenantId,
              contactId: parsed.data.contactId,
              activityType: 'failed',
              activityData: {
                type: 'birthday_invitation',
                emailTrackingId: parsed.data.emailTrackingId,
                error: errorMessage,
              },
              occurredAt: new Date().toISOString(),
              webhookId,
            };
            const activityTimestamp = Date.now();
            const activitySigPayload = `${activityTimestamp}.${JSON.stringify(activityBody)}`;
            const activitySignature = createHmac('sha256', secret).update(activitySigPayload).digest('hex');
            await fetch(`${apiUrl}/api/internal/email-activity`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-service': 'trigger.dev',
                'x-internal-timestamp': activityTimestamp.toString(),
                'x-internal-signature': activitySignature,
              },
              body: JSON.stringify(activityBody),
            }).catch(() => undefined);
          }
        }
      } catch {
        // ignore reconciliation errors
      }

      return {
        success: false,
        contactId: payload?.contactId,
        contactEmail: payload?.contactEmail,
        tenantId: payload?.tenantId,
        error: errorMessage,
      };
    }
  },
});
