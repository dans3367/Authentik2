import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import { workflowLogger } from '../workflow-logger';
import { renderBirthdayTemplate } from '../templates';

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

    // Render birthday templates if requested
    let htmlContent = input.content;
    if ((input.templateType === 'birthday' || input.templateType === 'birthday-ecard') && typeof input.metadata?.birthdayTemplate === 'string') {
      try {
        htmlContent = renderBirthdayTemplate(input.metadata.birthdayTemplate, {
          recipientName: input.metadata?.recipientName,
          message: input.metadata?.message,
          imageUrl: input.metadata?.imageUrl,
          customThemeData: input.metadata?.customThemeData,
          senderName: input.metadata?.senderName || 'Your Team',
        });
        workflowLogger.info(`🎂 Rendered birthday template: ${input.metadata.birthdayTemplate}`);
      } catch (e: any) {
        workflowLogger.error(`❌ Failed to render birthday template: ${e?.message || String(e)}`);
      }
    }

    const emailContent = {
      to: input.recipient,
      from: input.fromEmail || 'admin@zendwise.work', // Use provided from email or default
      subject: input.subject || 'No Subject',
      html: htmlContent,
      text: htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
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
        ...input.metadata
      }
    };

    // Send the email
    workflowLogger.info(`📤 Sending email ${input.emailId} to ${input.recipient} via available providers`);
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
      recipient: input.recipient
    };

    if (result.success) {
      workflowLogger.info(`✅ Email workflow completed successfully for ${input.emailId}: ${result.messageId}`);
    } else {
      workflowLogger.error(`❌ Email workflow failed for ${input.emailId}: ${result.error}`);
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
      recipient: input.recipient
    };
  }
}
