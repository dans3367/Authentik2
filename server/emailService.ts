import { Resend } from 'resend';
import { EnhancedEmailService } from './providers/enhancedEmailService';
import {
  buildFooterHtml,
  buildFooterText,
  getTenantBrandingForEmail,
} from './utils/emailBranding';

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development');

// Initialize enhanced email service
const enhancedEmailService = new EnhancedEmailService();

// Export enhanced service for use in other modules
export { enhancedEmailService };

export class EmailService {
  private fromEmail = process.env.FROM_EMAIL || 'dan@zendwise.com';
  private appName = process.env.APP_NAME || 'SaaS Auth App';
  private baseUrl = process.env.BASE_URL || 'http://localhost:5002';
  private useEnhanced = process.env.USE_ENHANCED_EMAIL !== 'false'; // Default to true

  async sendVerificationEmail(email: string, verificationToken: string, firstName?: string) {
    // Use enhanced email service if enabled, otherwise fallback to legacy
    if (this.useEnhanced) {
      try {
        console.log('[EmailService] Using enhanced email service for verification email');
        const result = await enhancedEmailService.sendVerificationEmail(email, verificationToken, firstName);

        if (result.success) {
          return { id: result.messageId, ...result };
        } else {
          console.warn('[EmailService] Enhanced service failed, falling back to legacy service');
          // Fall through to legacy service
        }
      } catch (error) {
        console.error('[EmailService] Enhanced service error, falling back to legacy service:', error);
        // Fall through to legacy service
      }
    }

    // Legacy service implementation
    const verificationUrl = `${this.baseUrl}/verify-email?token=${verificationToken}`;
    const displayName = firstName ? ` ${firstName}` : '';
    const branding = await getTenantBrandingForEmail(email);

    // In development or when email fails, log the verification URL to console
    console.log('\n🔗 EMAIL VERIFICATION URL:');
    console.log(`   ${verificationUrl}`);
    console.log(`   For user: ${email}${displayName}`);
    console.log('   Copy this URL to your browser to verify the email\n');

    try {
      console.log('[EmailService] Using legacy Resend service for verification email');
      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: `Welcome to ${this.appName} - Please verify your email`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${this.appName}</h1>
                <p>Welcome to our platform!</p>
              </div>
              <div class="content">
                <h2>Hi${displayName}!</h2>
                <p>Thank you for signing up for ${branding.displayName}. To complete your registration and start using your account, please verify your email address by clicking the button below:</p>
                
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>
                
                <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
                <p style="background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all;">
                  ${verificationUrl}
                </p>
                
                <p><strong>This verification link will expire in 24 hours.</strong></p>
                
                <p>If you didn't create an account with us, you can safely ignore this email.</p>
                
                <p>Welcome aboard!</p>
                <p>The ${branding.displayName} Team</p>
              </div>
              ${buildFooterHtml(branding.displayName)}
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error('Failed to send verification email:', error);
        throw new Error('Failed to send verification email');
      }

      console.log('Verification email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Email service error:', error);
      throw error;
    }
  }

  async sendReviewerApprovalEmail(email: string, approveUrl: string, subject?: string, emailData?: any) {
    // Use enhanced email service if enabled, otherwise fallback to legacy
    if (this.useEnhanced) {
      try {
        console.log('[EmailService] Using enhanced email service for approval email');
        const result = await enhancedEmailService.sendReviewerApprovalEmail(email, approveUrl, subject, emailData);

        if (result.success) {
          return { id: result.messageId, ...result };
        } else {
          console.warn('[EmailService] Enhanced service failed, falling back to legacy service');
          // Fall through to legacy service
        }
      } catch (error) {
        console.error('[EmailService] Enhanced service error, falling back to legacy service:', error);
        // Fall through to legacy service
      }
    }

    // Legacy service implementation
    const finalSubject = subject || `Review required: Email campaign`;
    const branding = await getTenantBrandingForEmail(email);
    try {
      console.log('[EmailService] Using legacy Resend service for approval email');
      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: finalSubject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Approval Requested</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${this.appName}</h1>
                <p>Approval Required</p>
              </div>
              <div class="content">
                <p>You have a pending email campaign awaiting your approval.</p>
                <div style="text-align: center;">
                  <a href="${approveUrl}" class="button">Approve Email</a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all;">${approveUrl}</p>
                <p>This link will expire in 7 days.</p>
              </div>
              ${buildFooterHtml(branding.displayName)}
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error('Failed to send reviewer approval email:', error);
        throw new Error('Failed to send reviewer approval email');
      }

      console.log('Reviewer approval email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Email service error (approval):', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, firstName?: string) {
    // Use enhanced email service if enabled, otherwise fallback to legacy
    if (this.useEnhanced) {
      try {
        console.log('[EmailService] Using enhanced email service for welcome email');
        const result = await enhancedEmailService.sendWelcomeEmail(email, firstName);

        if (result.success) {
          return { id: result.messageId, ...result };
        } else {
          console.warn('[EmailService] Enhanced service failed, falling back to legacy service');
          // Fall through to legacy service
        }
      } catch (error) {
        console.error('[EmailService] Enhanced service error, falling back to legacy service:', error);
        // Fall through to legacy service
      }
    }

    // Legacy service implementation
    const displayName = firstName ? ` ${firstName}` : '';
    const branding = await getTenantBrandingForEmail(email);

    try {
      console.log('[EmailService] Using legacy Resend service for welcome email');
      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: `Welcome to ${branding.displayName}! Your account is now verified`,
        text: [
          `Hi${displayName}!`,
          'Your email address has been verified and your account is now active.',
          'Visit your dashboard to explore all available features.',
          '',
          buildFooterText(branding.displayName),
        ].join('\n'),
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ${branding.displayName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Account Verified!</h1>
                <p>Welcome to ${branding.displayName}</p>
              </div>
              <div class="content">
                <h2>Hi${displayName}!</h2>
                <p>Congratulations! Your email address has been successfully verified and your account is now fully activated.</p>
                
                <p>You can now:</p>
                <ul>
                  <li>Access all features of ${branding.displayName}</li>
                  <li>Manage your profile and account settings</li>
                  <li>Enable two-factor authentication for extra security</li>
                  <li>Manage your active sessions across devices</li>
                </ul>
                
                <div style="text-align: center;">
                  <a href="${this.baseUrl}" class="button">Go to Dashboard</a>
                </div>
                
                <p>If you have any questions or need help getting started, feel free to reach out to our support team.</p>
                
                <p>Thank you for joining us!</p>
                <p>The ${branding.displayName} Team</p>
              </div>
              ${buildFooterHtml(branding.displayName)}
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error('Failed to send welcome email:', error);
        throw new Error('Failed to send welcome email');
      }

      console.log('Welcome email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Email service error:', error);
      throw error;
    }
  }

  // Additional methods for the enhanced service integration
  async getSystemStatus() {
    if (this.useEnhanced) {
      return await enhancedEmailService.getStatus();
    }
    return {
      service: 'legacy',
      provider: 'resend',
      enabled: !!process.env.RESEND_API_KEY
    };
  }

  async getHealthCheck() {
    if (this.useEnhanced) {
      return await enhancedEmailService.healthCheck();
    }
    return {
      healthy: !!process.env.RESEND_API_KEY,
      providers: { resend: !!process.env.RESEND_API_KEY }
    };
  }

  async sendCustomEmail(to: string | string[], subject: string, html: string, options: any = {}) {
    if (this.useEnhanced) {
      return await enhancedEmailService.sendCustomEmail(to, subject, html, options);
    }

    // Legacy implementation
    const recipients = Array.isArray(to) ? to : [to];
    try {
      console.log('[EmailService] Using legacy Resend service for custom email');
      const { data, error } = await resend.emails.send({
        from: options.from || this.fromEmail,
        to: recipients,
        subject,
        html,
        text: options.text
      });

      if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
      }

      return { id: data?.id, success: true };
    } catch (error) {
      console.error('Legacy email send error:', error);
      throw error;
    }
  }

  cleanup(olderThanHours?: number) {
    // Queue cleanup removed - email processing handled by Trigger.dev
    console.log('[EmailService] cleanup() called but queue processing is now handled by Trigger.dev');
  }

  shutdown() {
    if (this.useEnhanced) {
      enhancedEmailService.shutdown();
    }
  }
}

export const emailService = new EmailService();