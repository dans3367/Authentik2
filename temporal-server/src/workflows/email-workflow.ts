import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import { workflowLogger } from '../workflow-logger';
import { renderBirthdayTemplate } from '../templates';

// Proxy activities to be used in workflows
const {
  sendEmail,
  sendEmailViaResend,
  sendEmailViaPostmark,
  getAvailableEmailProviders,
  insertOutgoingEmail,
  getCompanyName
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

export interface EmailWorkflowInput {
  emailId: string;
  recipient: string;
  subject?: string;
  content?: string; // Make content optional to handle undefined cases
  templateType?: string;
  priority?: 'low' | 'normal' | 'high';
  isScheduled?: boolean;
  scheduledAt?: string;
  tenantId?: string;
  userId?: string;
  fromEmail?: string; // Optional from email to override default
  metadata?: Record<string, any>;
}

export interface EmailWorkflowResult {
  emailId: string;
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  sentAt: string;
  recipient: string;
  outgoingEmailId?: string; // ID of the record in outgoing_emails table
}

/**
 * Email workflow that handles sending individual emails
 * with proper error handling and logging
 */
export async function emailWorkflow(
  input: EmailWorkflowInput
): Promise<EmailWorkflowResult> {
  workflowLogger.info(`🚀 Starting email workflow for ${input.emailId} to ${input.recipient}`);

  const startTime = new Date().toISOString();
  let outgoingEmailId: string | undefined;

  try {
    // Check if email should be scheduled
    if (input.isScheduled && input.scheduledAt) {
      const scheduledTime = new Date(input.scheduledAt);
      const now = new Date();

      if (scheduledTime > now) {
        const waitTime = scheduledTime.getTime() - now.getTime();
        workflowLogger.info(`⏰ Email ${input.emailId} scheduled for ${input.scheduledAt}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Validate required fields
    if (!input.recipient || typeof input.recipient !== 'string') {
      workflowLogger.error(`❌ Invalid or missing recipient for email ${input.emailId}`);
      throw new Error(`Email recipient is required and must be a string. Received: ${typeof input.recipient}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.recipient)) {
      workflowLogger.error(`❌ Invalid email format for email ${input.emailId}: ${input.recipient}`);
      throw new Error(`Invalid email format: ${input.recipient}`);
    }

    if (!input.content || typeof input.content !== 'string') {
      workflowLogger.error(`❌ Invalid or missing content for email ${input.emailId}`);
      throw new Error(`Email content is required and must be a string. Received: ${typeof input.content}`);
    }

    // Render birthday templates if requested and not pre-rendered
    let htmlContent = input.content;
    if ((input.templateType === 'birthday' || input.templateType === 'birthday-ecard') && typeof input.metadata?.birthdayTemplate === 'string') {
      // Fetch company name if senderName is missing
      let resolvedSenderName = input.metadata?.senderName;
      if (!resolvedSenderName && input.tenantId) {
        try {
          const companyResult = await getCompanyName({ tenantId: input.tenantId });
          if (companyResult.success) {
            resolvedSenderName = companyResult.companyName;
            workflowLogger.info(`🏢 Fetched company name for sender: ${resolvedSenderName}`);
          } else {
            workflowLogger.warn(`⚠️ Failed to fetch company name: ${companyResult.error}`);
          }
        } catch (error) {
          workflowLogger.warn(`⚠️ Error fetching company name: ${error}`);
        }
      }

      // Skip template rendering if content was pre-rendered (marked in metadata)
      if (input.metadata?.preRendered) {
        workflowLogger.info(`🎂 Using pre-rendered birthday template: ${input.metadata.birthdayTemplate}`);
        htmlContent = input.content;
      } else {
        try {
          htmlContent = renderBirthdayTemplate(input.metadata.birthdayTemplate, {
            recipientName: input.metadata?.recipientName,
            message: input.metadata?.message,
            imageUrl: input.metadata?.imageUrl,
            customThemeData: input.metadata?.customThemeData,
            senderName: resolvedSenderName,
            promotionContent: input.metadata?.promotionContent,
            promotionTitle: input.metadata?.promotionTitle,
            promotionDescription: input.metadata?.promotionDescription,
          });
          workflowLogger.info(`🎂 Rendered birthday template: ${input.metadata.birthdayTemplate}`);
        } catch (e: any) {
          workflowLogger.error(`❌ Failed to render birthday template: ${e?.message || String(e)}`);
          // Fallback: try to render template even if there's an error
          try {
            htmlContent = renderBirthdayTemplate(input.metadata.birthdayTemplate, {
              recipientName: input.metadata?.recipientName || 'Friend',
              message: input.metadata?.message || 'Happy Birthday!',
              brandName: input.metadata?.brandName || 'Your Company',
              customThemeData: input.metadata?.customThemeData,
              senderName: resolvedSenderName || 'Your Team',
              promotionContent: input.metadata?.promotionContent,
              promotionTitle: input.metadata?.promotionTitle,
              promotionDescription: input.metadata?.promotionDescription,
            });
            workflowLogger.info(`🎂 Fallback rendered birthday template: ${input.metadata.birthdayTemplate}`);
          } catch (fallbackError: any) {
            workflowLogger.error(`❌ Fallback template rendering also failed: ${fallbackError?.message || String(fallbackError)}`);
            throw new Error(`Failed to render birthday template: ${e?.message || String(e)}`);
          }
        }
      }
    }

    const textContent = htmlContent.replace(/<[^>]*>/g, ''); // Strip HTML for text version

    // ** NEW STEP 1: Insert outgoing email record into database (BEFORE sending) **
    if (input.tenantId) {
      workflowLogger.info(`📝 Step 1: Inserting outgoing email record (status=pending, no resendID yet)`);
      
      try {
        const insertResult = await insertOutgoingEmail({
          tenantId: input.tenantId,
          recipientEmail: input.recipient,
          recipientName: input.metadata?.recipientName,
          senderEmail: input.fromEmail || 'admin@zendwise.work',
          senderName: input.metadata?.senderName,
          subject: input.subject || 'No Subject',
          emailType: input.templateType || 'general',
          provider: 'resend', // Default provider - may be overridden by actual send
          htmlContent: htmlContent,
          textContent: textContent,
          contactId: input.metadata?.contactId,
          newsletterId: input.metadata?.newsletterId,
          campaignId: input.metadata?.campaignId,
          promotionId: input.metadata?.promotionId,
          metadata: {
            emailId: input.emailId,
            userId: input.userId,
            priority: input.priority || 'normal',
            isScheduled: input.isScheduled || false,
            ...input.metadata
          }
        });

        if (insertResult.success) {
          outgoingEmailId = insertResult.outgoingEmailId;
          workflowLogger.info(`✅ Step 1 complete: Outgoing email record created with ID: ${outgoingEmailId}`);
        } else {
          workflowLogger.warn(`⚠️  Step 1 failed: Could not insert outgoing email record: ${insertResult.error}`);
          // Continue anyway - don't fail the workflow if tracking fails
        }
      } catch (insertError: any) {
        workflowLogger.warn(`⚠️  Step 1 failed: Error inserting outgoing email record: ${insertError?.message || String(insertError)}`);
        // Continue anyway - don't fail the workflow if tracking fails
      }
    } else {
      workflowLogger.info(`ℹ️  Skipping Step 1: No tenantId provided, cannot track in database`);
    }

    // ** STEP 2: Send the email **
    workflowLogger.info(`📤 Step 2: Sending email ${input.emailId} to ${input.recipient} via available providers`);
    
    const emailContent = {
      to: input.recipient,
      from: input.fromEmail || 'admin@zendwise.work',
      subject: input.subject || 'No Subject',
      html: htmlContent,
      text: textContent,
      tags: [
        'authentik',
        input.tenantId ? `tenant-${input.tenantId}` : 'no-tenant',
        input.userId ? `user-${input.userId}` : 'no-user',
        input.templateType || 'general'
      ],
      metadata: {
        emailId: input.emailId,
        tenantId: input.tenantId || 'unknown',
        userId: input.userId || 'unknown',
        templateType: input.templateType,
        priority: input.priority || 'normal',
        isScheduled: input.isScheduled || false,
        outgoingEmailId: outgoingEmailId, // Link to the tracking record
        ...input.metadata
      }
    };

    const result = await sendEmail(
      emailContent.to,
      emailContent.from,
      emailContent.subject,
      emailContent.html,
      emailContent.text,
      emailContent.tags,
      emailContent.metadata
    );

    const workflowResult: EmailWorkflowResult = {
      emailId: input.emailId,
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      provider: result.provider,
      sentAt: new Date().toISOString(),
      recipient: input.recipient,
      outgoingEmailId: outgoingEmailId
    };

    if (result.success) {
      workflowLogger.info(`✅ Step 2 complete: Email workflow completed successfully for ${input.emailId}: ${result.messageId}`);
      workflowLogger.info(`📊 Summary: outgoingEmailId=${outgoingEmailId}, resendID=${result.messageId}`);
    } else {
      workflowLogger.error(`❌ Step 2 failed: Email workflow failed for ${input.emailId}: ${result.error}`);
    }

    return workflowResult;

  } catch (error) {
    workflowLogger.error(`❌ Email workflow failed for ${input.emailId}:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      emailId: input.emailId,
      success: false,
      error: errorMessage,
      sentAt: new Date().toISOString(),
      recipient: input.recipient,
      outgoingEmailId: outgoingEmailId
    };
  }
}
