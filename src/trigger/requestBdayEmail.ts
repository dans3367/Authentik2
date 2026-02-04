import { task, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { z } from "zod";

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

      const rawContactName = data.contactFirstName
        ? `${data.contactFirstName}${data.contactLastName ? ` ${data.contactLastName}` : ""}`
        : "Valued Customer";
      const contactName = escapeHtml(rawContactName);
      const tenantName = escapeHtml(data.tenantName || "The Team");
      const profileUpdateUrlHref = escapeHtml(encodeURI(data.profileUpdateUrl));
      const profileUpdateUrlText = escapeHtml(data.profileUpdateUrl);

      const subject = `🎂 Help us celebrate your special day!`;

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Birthday Information Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #e91e63; margin: 0;">🎂 Birthday Celebration!</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
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
          
          <div style="margin-top: 20px; padding: 15px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: bold;">If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="margin: 0; word-break: break-all;">
              <a href="${profileUpdateUrlHref}" style="color: #e91e63; text-decoration: none; font-size: 12px;">${profileUpdateUrlText}</a>
            </p>
          </div>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
          <p style="margin: 0;">Best regards,<br>${tenantName}</p>
          <p style="margin: 10px 0 0 0;">This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.</p>
        </div>
      </body>
      </html>
    `;

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
