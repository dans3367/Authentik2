/**
 * Email service activities for Resend and Postmark integration
 */
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { Client as PostmarkClient } from 'postmark';
import { activityLogger } from '../workflow-logger';
import { getActivityConfig } from '../activity-config';

interface EmailProvider {
  name: 'resend' | 'postmark';
  client: Resend | PostmarkClient;
}

interface SendEmailRequest {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'resend' | 'postmark';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

class EmailServiceManager {
  private resend: Resend | null = null;
  private postmark: PostmarkClient | null = null;
  private primaryProvider: 'resend' | 'postmark' = 'resend';

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const config = getActivityConfig();
    
    // Initialize Resend
    const resendApiKey = config.resendApiKey;
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      const masked = resendApiKey.length > 6
        ? `${resendApiKey.slice(0, 4)}...${resendApiKey.slice(-2)}`
        : '***';
      activityLogger.info(`✅ Resend client initialized (key: ${masked})`);
    } else {
      activityLogger.warn('⚠️ RESEND_API_KEY not found in configuration');
    }

    // Initialize Postmark
    const postmarkApiKey = config.postmarkApiToken;
    if (postmarkApiKey) {
      this.postmark = new PostmarkClient(postmarkApiKey);
      activityLogger.info('✅ Postmark client initialized');
    } else {
      activityLogger.warn('⚠️ POSTMARK_API_TOKEN not found in configuration');
    }

    // Set primary provider based on configuration
    const configuredProvider = config.primaryEmailProvider as 'resend' | 'postmark';
    if (configuredProvider === 'postmark' && this.postmark) {
      this.primaryProvider = 'postmark';
    } else if (this.resend) {
      this.primaryProvider = 'resend';
    } else if (this.postmark) {
      this.primaryProvider = 'postmark';
    } else {
      throw new Error('No email providers configured. Set RESEND_API_KEY or POSTMARK_API_KEY.');
    }

    activityLogger.info(
      `📧 Primary email provider set to: ${this.primaryProvider} (configured=${configuredProvider || 'unset'})`
    );
  }

  async sendViaResend(request: SendEmailRequest): Promise<SendEmailResult> {
    if (!this.resend) {
      throw new Error('Resend client not initialized');
    }

    try {
      activityLogger.info(
        `➡️ [Resend] Sending email to=${request.to} from=${request.from} subject="${request.subject}" tags=${(request.tags || []).join(',')}`
      );
      
      // Prepare the payload for Resend
      const emailPayload = {
        from: request.from,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
        tags: request.tags?.map(tag => ({ name: tag, value: 'true' })),
        ...(request.metadata && { metadata: request.metadata }),
      };
      
      activityLogger.info(`📤 [Resend] Email payload prepared:`, {
        to: emailPayload.to,
        from: emailPayload.from,
        subject: emailPayload.subject,
        hasHtml: !!emailPayload.html,
        hasText: !!emailPayload.text,
        tagsCount: emailPayload.tags?.length || 0,
        hasMetadata: !!request.metadata
      });
      
      const result = await this.resend.emails.send(emailPayload);

      activityLogger.debug('📨 [Resend] Raw API result:', result);

      if (result.error) {
        activityLogger.error(`❌ [Resend] API returned error:`, result.error);
        return {
          success: false,
          error: `Resend API error: ${result.error.name || 'Unknown'} - ${result.error.message || 'No message'}`,
          provider: 'resend',
        };
      }

      activityLogger.info(`✅ [Resend] Email sent successfully - ID: ${result.data?.id}`);
      return {
        success: true,
        messageId: result.data?.id,
        provider: 'resend',
      };
    } catch (error: unknown) {
      activityLogger.error('❌ [Resend] Send failed with exception:', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Unknown error occurred with Resend',
        provider: 'resend',
      };
    }
  }

  async sendViaPostmark(request: SendEmailRequest): Promise<SendEmailResult> {
    if (!this.postmark) {
      throw new Error('Postmark client not initialized');
    }

    try {
      activityLogger.debug(
        `➡️ [Postmark] Sending email to=${request.to} from=${request.from} subject="${request.subject}" tag=${request.tags?.[0] || ''}`
      );
      const result = await this.postmark.sendEmail({
        From: request.from,
        To: request.to,
        Subject: request.subject,
        HtmlBody: request.html,
        TextBody: request.text,
        Tag: request.tags?.[0], // Postmark supports one tag per message
        Metadata: request.metadata,
      });

      activityLogger.info(`✅ [Postmark] API response MessageID=${result.MessageID} ErrorCode=${result.ErrorCode}`);
      return {
        success: true,
        messageId: result.MessageID,
        provider: 'postmark',
      };
    } catch (error: unknown) {
      activityLogger.error('❌ [Postmark] Send failed:', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Unknown error occurred with Postmark',
        provider: 'postmark',
      };
    }
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
    const provider = this.primaryProvider;
    
    try {
      activityLogger.info(`📤 [EmailService] Using provider=${provider} to=${request.to}`);
      if (provider === 'resend') {
        return await this.sendViaResend(request);
      } else {
        return await this.sendViaPostmark(request);
      }
    } catch (error: unknown) {
      activityLogger.error(`❌ Primary provider ${provider} failed:`, error);
      
      // Try fallback provider
      const fallbackProvider = provider === 'resend' ? 'postmark' : 'resend';
      activityLogger.info(`🔄 Attempting fallback to ${fallbackProvider}`);
      
      try {
        if (fallbackProvider === 'resend' && this.resend) {
          return await this.sendViaResend(request);
        } else if (fallbackProvider === 'postmark' && this.postmark) {
          return await this.sendViaPostmark(request);
        } else {
          throw new Error(`Fallback provider ${fallbackProvider} not available`);
        }
      } catch (fallbackError: unknown) {
        activityLogger.error(`❌ Fallback provider ${fallbackProvider} also failed:`, fallbackError);
        throw new Error(
          `Both email providers failed. Primary: ${getErrorMessage(error)}, Fallback: ${getErrorMessage(fallbackError)}`
        );
      }
    }
  }

  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.resend) providers.push('resend');
    if (this.postmark) providers.push('postmark');
    return providers;
  }
}

// Lazy-loaded singleton instance
let emailManager: EmailServiceManager | null = null;

function getEmailManager(): EmailServiceManager {
  if (!emailManager) {
    emailManager = new EmailServiceManager();
  }
  return emailManager;
}

/**
 * Send a single email using the configured email provider
 */
export async function sendEmail(
  to: string,
  from: string,
  subject: string,
  html: string,
  text?: string,
  tags?: string[],
  metadata?: Record<string, any>
): Promise<SendEmailResult> {
  // Validate email format before sending
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    activityLogger.error(`❌ Invalid email format: ${to}`);
    return {
      success: false,
      error: `Invalid email format: ${to}`,
      provider: 'validation' as any,
    };
  }

  activityLogger.info(`📧 Sending email to ${to} via ${getEmailManager().getAvailableProviders().join(', ')}`);

  try {
    const result = await getEmailManager().sendEmail({
      to,
      from,
      subject,
      html,
      text,
      tags,
      metadata,
    });

    if (result.success) {
      activityLogger.info(`✅ Email sent successfully to ${to} via ${result.provider} (ID: ${result.messageId})`);
    } else {
      activityLogger.error(`❌ Failed to send email to ${to}:`, result.error);
    }

    return result;
  } catch (error: unknown) {
    activityLogger.error(`❌ Email sending failed for ${to}:`, error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Unknown error occurred',
      provider: 'unknown' as any,
    };
  }
}

/**
 * Send bulk emails with rate limiting
 */
export async function sendBulkEmails(
  emails: SendEmailRequest[],
  rateLimitPerMinute: number = 100
): Promise<SendEmailResult[]> {
  activityLogger.info(`📧 Sending ${emails.length} bulk emails with rate limit ${rateLimitPerMinute}/min`);

  const results: SendEmailResult[] = [];
  const delayBetweenEmails = (60 * 1000) / rateLimitPerMinute; // ms delay between emails

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    try {
      const result = await getEmailManager().sendEmail(email);
      results.push(result);
      
      // Rate limiting delay
      if (i < emails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
      }
    } catch (error: unknown) {
      results.push({
        success: false,
        error: getErrorMessage(error) || 'Unknown error occurred',
        provider: 'unknown' as any,
      });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  activityLogger.info(`✅ Bulk email sending completed: ${successful} successful, ${failed} failed`);
  return results;
}


/**
 * Activity: Explicitly send email using Resend provider
 */
export async function sendEmailViaResend(
  to: string,
  from: string,
  subject: string,
  html: string,
  text?: string,
  tags?: string[],
  metadata?: Record<string, any>
): Promise<SendEmailResult> {
  activityLogger.debug(`📧 [Activity] sendEmailViaResend to=${to}`);
  try {
    return await getEmailManager().sendViaResend({
      to,
      from,
      subject,
      html,
      text,
      tags,
      metadata,
    });
  } catch (error: unknown) {
    activityLogger.error('❌ [Activity] sendEmailViaResend failed:', error);
    return {
      success: false,
      error: getErrorMessage(error),
      provider: 'resend',
    };
  }
}

/**
 * Activity: Explicitly send email using Postmark provider
 */
export async function sendEmailViaPostmark(
  to: string,
  from: string,
  subject: string,
  html: string,
  text?: string,
  tags?: string[],
  metadata?: Record<string, any>
): Promise<SendEmailResult> {
  activityLogger.debug(`📧 [Activity] sendEmailViaPostmark to=${to}`);
  try {
    return await getEmailManager().sendViaPostmark({
      to,
      from,
      subject,
      html,
      text,
      tags,
      metadata,
    });
  } catch (error: unknown) {
    activityLogger.error('❌ [Activity] sendEmailViaPostmark failed:', error);
    return {
      success: false,
      error: getErrorMessage(error),
      provider: 'postmark',
    };
  }
}

/**
 * Activity: List available email providers in this worker
 */
export function getAvailableEmailProviders(): string[] {
  const providers = getEmailManager().getAvailableProviders();
  activityLogger.debug(`🔎 [Activity] Available email providers: ${providers.join(', ') || 'none'}`);
  return providers;
}


