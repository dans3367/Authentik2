import { EmailProviderManager } from './providerManager';
import { EmailProviderConfig } from './config';
import { EmailMessage, EmailSendResult } from './types';

export class EnhancedEmailService {
  private manager: EmailProviderManager;
  private config: ReturnType<typeof EmailProviderConfig.getEnvironmentConfig>;

  constructor() {
    this.config = EmailProviderConfig.getEnvironmentConfig();
    this.manager = new EmailProviderManager();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const configs = EmailProviderConfig.loadConfigs();
    
    console.log(`[EnhancedEmailService] Initializing ${configs.length} email providers`);
    
    for (const config of configs) {
      try {
        this.manager.registerProvider(config);
        console.log(`[EnhancedEmailService] ✅ Registered provider: ${config.name} (${config.id})`);
      } catch (error) {
        console.error(`[EnhancedEmailService] ❌ Failed to register provider ${config.id}:`, error);
      }
    }

    const enabledProviders = this.manager.getProviders();
    console.log(`[EnhancedEmailService] ${enabledProviders.length} providers enabled and ready`);
  }

  async sendVerificationEmail(
    email: string, 
    verificationToken: string, 
    firstName?: string
  ): Promise<EmailSendResult> {
    const verificationUrl = `${this.config.baseUrl}/verify-email?token=${verificationToken}`;
    const displayName = firstName ? ` ${firstName}` : '';

    // Log verification URL for development
    console.log('\n🔗 EMAIL VERIFICATION URL:');
    console.log(`   ${verificationUrl}`);
    console.log(`   For user: ${email}${displayName}`);
    console.log('   Copy this URL to your browser to verify the email\n');

    const message: EmailMessage = {
      to: [email],
      from: this.config.fromEmail,
      subject: `Welcome to ${this.config.appName} - Please verify your email`,
      html: this.generateVerificationEmailHtml(displayName, verificationUrl),
      metadata: {
        type: 'verification',
        userId: email,
        verificationToken
      }
    };

    return await this.manager.sendEmail(message);
  }

  async sendWelcomeEmail(
    email: string, 
    firstName?: string
  ): Promise<EmailSendResult> {
    const displayName = firstName ? ` ${firstName}` : '';

    const message: EmailMessage = {
      to: [email],
      from: this.config.fromEmail,
      subject: `Welcome to ${this.config.appName}!`,
      html: this.generateWelcomeEmailHtml(displayName),
      metadata: {
        type: 'welcome',
        userId: email
      }
    };

    return await this.manager.sendEmail(message);
  }

  async sendReviewerApprovalEmail(
    email: string, 
    approveUrl: string, 
    subject?: string,
    emailData?: any
  ): Promise<EmailSendResult> {
    const finalSubject = subject || 'Review required: Email campaign';

    const message: EmailMessage = {
      to: [email],
      from: this.config.fromEmail,
      subject: finalSubject,
      html: this.generateApprovalEmailHtml(approveUrl, subject, emailData),
      metadata: {
        type: 'approval',
        approveUrl,
        originalSubject: subject
      }
    };

    return await this.manager.sendEmail(message);
  }

  async sendCustomEmail(
    to: string | string[],
    subject: string,
    html: string,
    options: {
      text?: string;
      from?: string;
      preferredProvider?: string;
      useQueue?: boolean;
      headers?: Record<string, string>;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<EmailSendResult | string> {
    const recipients = Array.isArray(to) ? to : [to];
    
    const message: EmailMessage = {
      to: recipients,
      from: options.from || this.config.fromEmail,
      subject,
      html,
      text: options.text,
      headers: options.headers,
      metadata: {
        type: 'custom',
        ...options.metadata
      }
    };

    if (options.useQueue || this.config.enableQueue) {
      return await this.manager.queueEmail(message, options.preferredProvider);
    } else {
      return await this.manager.sendEmail(message, options.preferredProvider);
    }
  }

  // Batch email sending with automatic queueing
  async sendBatchEmails(
    emails: Array<{
      to: string;
      subject: string;
      html: string;
      text?: string;
      headers?: Record<string, string>;
      metadata?: Record<string, any>;
    }>,
    options: {
      preferredProvider?: string;
      batchSize?: number;
      delayBetweenBatches?: number;
    } = {}
  ): Promise<{ queued: string[]; errors: Array<{ email: string; error: string }> }> {
    const batchSize = options.batchSize || 10;
    const delay = options.delayBetweenBatches || 1000;
    const queued: string[] = [];
    const errors: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      console.log(`[EnhancedEmailService] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)}`);

      for (const emailData of batch) {
        try {
          const message: EmailMessage = {
            to: [emailData.to],
            from: this.config.fromEmail,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            headers: emailData.headers,
            metadata: {
              type: 'batch',
              ...emailData.metadata
            }
          };

          const queueId = await this.manager.queueEmail(message, options.preferredProvider);
          queued.push(queueId);
        } catch (error) {
          console.error(`[EnhancedEmailService] Failed to queue email for ${emailData.to}:`, error);
          errors.push({
            email: emailData.to,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Add delay between batches to avoid overwhelming the system
      if (i + batchSize < emails.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`[EnhancedEmailService] Batch processing complete: ${queued.length} queued, ${errors.length} errors`);
    return { queued, errors };
  }

  // Health check and status methods
  async healthCheck(): Promise<{ healthy: boolean; providers: Record<string, boolean> }> {
    const providerHealth = await this.manager.healthCheck();
    const healthy = Object.values(providerHealth).some(status => status);
    
    return { healthy, providers: providerHealth };
  }

  getStatus() {
    return {
      service: 'enhanced',
      config: this.config,
      ...this.manager.getStatus()
    };
  }

  getQueueStatus() {
    return this.manager.getQueueStatus();
  }

  getEmailStatus(emailId: string) {
    return this.manager.getEmailStatus(emailId);
  }

  // Cleanup methods
  cleanupOldEmails(olderThanHours: number = 24): void {
    this.manager.cleanupOldEmails(olderThanHours);
  }

  // Graceful shutdown
  shutdown(): void {
    console.log('[EnhancedEmailService] Shutting down...');
    this.manager.stop();
  }

  // HTML template generators
  private generateVerificationEmailHtml(displayName: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .button:hover { background: #5a32a3; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .url-box { background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${this.config.appName}</h1>
            <p>Welcome to our platform!</p>
          </div>
          <div class="content">
            <h2>Hi${displayName}!</h2>
            <p>Thank you for signing up for ${this.config.appName}. To complete your registration and start using your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <div class="url-box">${verificationUrl}</div>
            
            <p><strong>This verification link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with us, you can safely ignore this email.</p>
            
            <p>Welcome aboard!</p>
            <p>The ${this.config.appName} Team</p>
          </div>
          <div class="footer">
            <p>This email was sent with our enhanced email delivery system.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateWelcomeEmailHtml(displayName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome!</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to ${this.config.appName}!</h1>
            <p>Your account is now verified and ready to use</p>
          </div>
          <div class="content">
            <h2>Hi${displayName}!</h2>
            <p>Congratulations! Your email has been successfully verified and your account is now active.</p>
            
            <p>You can now enjoy all the features of ${this.config.appName}:</p>
            <ul>
              <li>Create and manage your profile</li>
              <li>Access all platform features</li>
              <li>Connect with other users</li>
              <li>And much more!</li>
            </ul>
            
            <p>If you have any questions or need help getting started, please don't hesitate to reach out to our support team.</p>
            
            <p>Thank you for joining us!</p>
            <p>The ${this.config.appName} Team</p>
          </div>
          <div class="footer">
            <p>This email was sent with our enhanced email delivery system.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateApprovalEmailHtml(approveUrl: string, subject?: string, emailData?: any): string {
    const finalSubject = subject || 'Email Campaign Review';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Campaign Approval Required</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
          .button:hover { background: #3730a3; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .detail-row { margin: 8px 0; }
          .label { font-weight: 600; color: #495057; }
          .url-box { background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Campaign Review</h1>
            <p>Approval Required</p>
          </div>
          <div class="content">
            <h2>Campaign Details</h2>
            <div class="detail-row">
              <span class="label">Subject:</span> ${finalSubject}
            </div>
            
            ${emailData ? `
            <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <h4>Campaign Preview:</h4>
              <div style="max-height: 200px; overflow-y: auto; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                ${emailData.content || 'No preview available'}
              </div>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="${approveUrl}" class="button">Approve Email</a>
            </div>
            
            <p>If the button doesn't work, click or copy this link:</p>
            <div class="url-box">${approveUrl}</div>
            
            <p><em>This approval link will expire in 7 days.</em></p>
          </div>
          <div class="footer">
            <p>This email was sent with our enhanced email delivery system.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}