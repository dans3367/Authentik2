import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import { workflowLogger } from '../workflow-logger';

// Proxy activities to be used in workflows
const {
  sendEmail,
  sendEmailViaResend,
  sendEmailViaPostmark,
  getAvailableEmailProviders
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  heartbeatTimeout: '1 minute',
  retry: {
    initialInterval: '1 second',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface BirthdayInvitationWorkflowInput {
  contactId: string;
  contactEmail: string;
  contactFirstName?: string;
  contactLastName?: string;
  tenantId: string;
  tenantName?: string;
  baseUrl?: string;
  fromEmail?: string;
  metadata?: Record<string, any>;
}

export interface BirthdayInvitationWorkflowResult {
  contactId: string;
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  sentAt: string;
  profileUpdateToken?: string;
}

/**
 * Birthday invitation workflow that handles sending invitation emails
 * to customers without birthdays, with proper error handling and logging
 */
export async function birthdayInvitationWorkflow(
  input: BirthdayInvitationWorkflowInput
): Promise<BirthdayInvitationWorkflowResult> {
  workflowLogger.info(`🎂 Starting birthday invitation workflow for contact ${input.contactId} (${input.contactEmail})`);

  const startTime = new Date().toISOString();

  try {
    // Validate required fields
    if (!input.contactEmail || typeof input.contactEmail !== 'string') {
      workflowLogger.error(`❌ Invalid or missing contact email for ${input.contactId}`);
      throw new Error(`Contact email is required and must be a string. Received: ${typeof input.contactEmail}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.contactEmail)) {
      workflowLogger.error(`❌ Invalid email format for contact ${input.contactId}: ${input.contactEmail}`);
      throw new Error(`Invalid email format: ${input.contactEmail}`);
    }

    if (!input.contactId || typeof input.contactId !== 'string') {
      workflowLogger.error(`❌ Invalid or missing contact ID`);
      throw new Error(`Contact ID is required and must be a string. Received: ${typeof input.contactId}`);
    }

    if (!input.tenantId || typeof input.tenantId !== 'string') {
      workflowLogger.error(`❌ Invalid or missing tenant ID for contact ${input.contactId}`);
      throw new Error(`Tenant ID is required and must be a string. Received: ${typeof input.tenantId}`);
    }

    // Generate secure token for profile update (simulated - actual JWT generation should be in activity)
    const profileUpdateToken = `${input.contactId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Construct profile update URL
    const baseUrl = input.baseUrl || process.env.BASE_URL || 'http://localhost:3500';
    const profileUpdateUrl = `${baseUrl}/update-profile?token=${profileUpdateToken}`;
    
    // Create contact name
    const contactName = input.contactFirstName 
      ? `${input.contactFirstName}${input.contactLastName ? ` ${input.contactLastName}` : ''}` 
      : 'Valued Customer';
    
    // Create email subject and content
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
            <a href="${profileUpdateUrl}" 
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
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
          <p style="margin: 0;">Best regards,<br>${input.tenantName || 'The Team'}</p>
          <p style="margin: 10px 0 0 0;">This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    // Create text version
    const textContent = `
Hi ${contactName},

We'd love to make your birthday extra special! To ensure you don't miss out on exclusive birthday promotions, special offers, and personalized birthday surprises, we'd like to add your birthday to our records.

By sharing your birthday with us, you'll receive:
• Exclusive birthday discounts and offers
• Special birthday promotions  
• Personalized birthday messages
• Early access to birthday-themed content

Add your birthday here: ${profileUpdateUrl}

This link will expire in 30 days. Your privacy is important to us - we'll only use your birthday to send you special offers and birthday wishes.

Best regards,
${input.tenantName || 'The Team'}

This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.
    `;

    // Send the email
    workflowLogger.info(`📤 Sending birthday invitation email to ${input.contactEmail}`);
    const result = await sendEmail(
      input.contactEmail,
      input.fromEmail || 'noreply@zendwise.work',
      subject,
      htmlContent,
      textContent,
      ['birthday-invitation', 'authentik', `tenant-${input.tenantId}`, `contact-${input.contactId}`],
      {
        contactId: input.contactId,
        tenantId: input.tenantId,
        emailType: 'birthday_invitation',
        profileUpdateToken,
        profileUpdateUrl,
        ...input.metadata
      }
    );

    const workflowResult: BirthdayInvitationWorkflowResult = {
      contactId: input.contactId,
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      provider: result.provider,
      sentAt: new Date().toISOString(),
      profileUpdateToken: result.success ? profileUpdateToken : undefined
    };

    if (result.success) {
      workflowLogger.info(`✅ Birthday invitation workflow completed successfully for contact ${input.contactId}: ${result.messageId}`);
    } else {
      workflowLogger.error(`❌ Birthday invitation workflow failed for contact ${input.contactId}: ${result.error}`);
    }

    return workflowResult;

  } catch (error) {
    workflowLogger.error(`❌ Birthday invitation workflow failed for contact ${input.contactId}:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      contactId: input.contactId,
      success: false,
      error: errorMessage,
      sentAt: new Date().toISOString()
    };
  }
}

