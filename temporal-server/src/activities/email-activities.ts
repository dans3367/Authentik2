/**
 * Email service activities for Resend and Postmark integration
 */
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { Client as PostmarkClient } from 'postmark';

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

interface SendEmailResult {
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
    // Ensure environment is loaded even when worker is spawned without prior dotenv.config()
    const localEnv = dotenv.config();
    const rootEnvPath = path.resolve(__dirname, '../../../.env');
    const rootEnv = dotenv.config({ path: rootEnvPath });
    
    // In Replit, secrets are available directly in process.env
    // Log what we have for debugging
    console.log(
      `🧪 [EmailEnv] Loaded local .env: ${localEnv.error ? 'no' : 'yes'} | loaded root .env (${rootEnvPath}): ${rootEnv.error ? 'no' : 'yes'}`
    );
    console.log(
      `🧪 [EmailEnv] RESEND_API_KEY present: ${process.env.RESEND_API_KEY ? 'yes (from env)' : 'no'} | POSTMARK_API_KEY present: ${process.env.POSTMARK_API_KEY ? 'yes' : 'no'}`
    );
    
    // Debug: Check if we have the key
    if (process.env.RESEND_API_KEY) {
      const maskedKey = process.env.RESEND_API_KEY.substring(0, 10) + '...';
      console.log(`✅ [EmailEnv] Found RESEND_API_KEY in environment: ${maskedKey}`);
    }

    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      const masked = resendApiKey.length > 6
        ? `${resendApiKey.slice(0, 4)}...${resendApiKey.slice(-2)}`
        : '***';
      console.log(`✅ Resend client initialized (key: ${masked})`);
    } else {
      console.warn('⚠️ RESEND_API_KEY not found in environment');
    }

    // Initialize Postmark
    const postmarkApiKey = process.env.POSTMARK_API_KEY;
    if (postmarkApiKey) {
      this.postmark = new PostmarkClient(postmarkApiKey);
      console.log('✅ Postmark client initialized');
    } else {
      console.warn('⚠️ POSTMARK_API_KEY not found in environment');
    }

    // Set primary provider based on configuration
    const configuredProvider = process.env.PRIMARY_EMAIL_PROVIDER as 'resend' | 'postmark';
    if (configuredProvider === 'postmark' && this.postmark) {
      this.primaryProvider = 'postmark';
    } else if (this.resend) {
      this.primaryProvider = 'resend';
    } else if (this.postmark) {
      this.primaryProvider = 'postmark';
    } else {
      throw new Error('No email providers configured. Set RESEND_API_KEY or POSTMARK_API_KEY.');
    }

    console.log(
      `📧 Primary email provider set to: ${this.primaryProvider} (configured=${configuredProvider || 'unset'})`
    );
  }

  async sendViaResend(request: SendEmailRequest): Promise<SendEmailResult> {
    if (!this.resend) {
      throw new Error('Resend client not initialized');
    }

    try {
      console.log(
        `➡️ [Resend] Sending email to=${request.to} from=${request.from} subject="${request.subject}" tags=${(request.tags || []).join(',')}`
      );
      const result = await this.resend.emails.send({
        from: request.from,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
        tags: request.tags?.map(tag => ({ name: tag, value: 'true' })),
        ...(request.metadata && { metadata: request.metadata }),
      });

      console.log(`✅ [Resend] API response id=${result.data?.id} error=${result.error ? JSON.stringify(result.error) : 'none'}`);
      return {
        success: true,
        messageId: result.data?.id,
        provider: 'resend',
      };
    } catch (error: unknown) {
      console.error('❌ [Resend] Send failed:', error);
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
      console.log(
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

      console.log(`✅ [Postmark] API response MessageID=${result.MessageID} ErrorCode=${result.ErrorCode}`);
      return {
        success: true,
        messageId: result.MessageID,
        provider: 'postmark',
      };
    } catch (error: unknown) {
      console.error('❌ [Postmark] Send failed:', error);
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
      console.log(`📤 [EmailService] Using provider=${provider} to=${request.to}`);
      if (provider === 'resend') {
        return await this.sendViaResend(request);
      } else {
        return await this.sendViaPostmark(request);
      }
    } catch (error: unknown) {
      console.error(`❌ Primary provider ${provider} failed:`, error);
      
      // Try fallback provider
      const fallbackProvider = provider === 'resend' ? 'postmark' : 'resend';
      console.log(`🔄 Attempting fallback to ${fallbackProvider}`);
      
      try {
        if (fallbackProvider === 'resend' && this.resend) {
          return await this.sendViaResend(request);
        } else if (fallbackProvider === 'postmark' && this.postmark) {
          return await this.sendViaPostmark(request);
        } else {
          throw new Error(`Fallback provider ${fallbackProvider} not available`);
        }
      } catch (fallbackError: unknown) {
        console.error(`❌ Fallback provider ${fallbackProvider} also failed:`, fallbackError);
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

// Singleton instance
const emailManager = new EmailServiceManager();

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
  console.log(`📧 Sending email to ${to} via ${emailManager.getAvailableProviders().join(', ')}`);

  try {
    const result = await emailManager.sendEmail({
      to,
      from,
      subject,
      html,
      text,
      tags,
      metadata,
    });

    if (result.success) {
      console.log(`✅ Email sent successfully to ${to} via ${result.provider} (ID: ${result.messageId})`);
    } else {
      console.error(`❌ Failed to send email to ${to}:`, result.error);
    }

    return result;
  } catch (error: unknown) {
    console.error(`❌ Email sending failed for ${to}:`, error);
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
  console.log(`📧 Sending ${emails.length} bulk emails with rate limit ${rateLimitPerMinute}/min`);

  const results: SendEmailResult[] = [];
  const delayBetweenEmails = (60 * 1000) / rateLimitPerMinute; // ms delay between emails

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    try {
      const result = await emailManager.sendEmail(email);
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
  
  console.log(`✅ Bulk email sending completed: ${successful} successful, ${failed} failed`);
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
  console.log(`📧 [Activity] sendEmailViaResend to=${to}`);
  try {
    return await emailManager.sendViaResend({
      to,
      from,
      subject,
      html,
      text,
      tags,
      metadata,
    });
  } catch (error: unknown) {
    console.error('❌ [Activity] sendEmailViaResend failed:', error);
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
  console.log(`📧 [Activity] sendEmailViaPostmark to=${to}`);
  try {
    return await emailManager.sendViaPostmark({
      to,
      from,
      subject,
      html,
      text,
      tags,
      metadata,
    });
  } catch (error: unknown) {
    console.error('❌ [Activity] sendEmailViaPostmark failed:', error);
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
  const providers = emailManager.getAvailableProviders();
  console.log(`🔎 [Activity] Available email providers: ${providers.join(', ') || 'none'}`);
  return providers;
}


