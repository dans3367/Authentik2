/**
 * Email service activities for Temporal workflows
 */
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the project root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Debug: Check if API key is loaded
console.log('🔑 RESEND_API_KEY loaded:', process.env.RESEND_API_KEY ? 'Yes' : 'No');
console.log('🔑 API Key length:', process.env.RESEND_API_KEY?.length || 0);

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

/**
 * Send email activity using Resend
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
  try {
    console.log(`📧 Sending email to ${to} with subject: ${subject}`);

    // Validate required fields
    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new Error('Recipient email is required and cannot be empty');
    }

    if (!from || typeof from !== 'string' || from.trim() === '') {
      throw new Error('From email is required and cannot be empty');
    }

    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      throw new Error('Subject is required and cannot be empty');
    }

    if (!html || typeof html !== 'string' || html.trim() === '') {
      throw new Error('HTML content is required and cannot be empty');
    }

    // Ensure HTML content is properly formatted
    let cleanHtml = html.trim();
    if (!cleanHtml.toLowerCase().includes('<!doctype') && !cleanHtml.toLowerCase().includes('<html')) {
      // Wrap content in basic HTML structure if not already present
      cleanHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${cleanHtml}
</body>
</html>`;
    }

    const emailData = {
      from: from.trim(),
      to: to.trim(),
      subject: subject.trim(),
      html: cleanHtml,
      text: text || cleanHtml.replace(/<[^>]*>/g, '').trim(), // Strip HTML for text version
      tags: (tags || ['authentik']).map((tag, index) => ({ name: `tag-${index}`, value: tag })),
    };

    // Log email data for debugging (without sensitive content)
    console.log(`📧 Email data:`, {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      htmlLength: emailData.html.length,
      textLength: emailData.text.length,
      tagsCount: emailData.tags.length
    });

    const result = await resend.emails.send(emailData);

    if (result.error) {
      console.error('❌ Resend API error:', {
        message: result.error.message,
        name: result.error.name,
        details: result.error
      });
      
      // Log the email data that caused the error (for debugging)
      console.error('❌ Email data that caused error:', {
        fromLength: emailData.from.length,
        toLength: emailData.to.length,
        subjectLength: emailData.subject.length,
        htmlPreview: emailData.html.substring(0, 200) + '...',
        textPreview: emailData.text.substring(0, 200) + '...'
      });
      
      return {
        success: false,
        error: result.error.message || 'Unknown Resend error',
        provider: 'resend'
      };
    }

    console.log(`✅ Email sent successfully via Resend: ${result.data?.id}`);
    return {
      success: true,
      messageId: result.data?.id,
      provider: 'resend'
    };

  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      provider: 'resend'
    };
  }
}

/**
 * Get available email providers
 */
export async function getAvailableEmailProviders(): Promise<string[]> {
  const providers: string[] = [];
  
  if (process.env.RESEND_API_KEY) {
    providers.push('resend');
  }
  
  if (process.env.POSTMARK_API_KEY) {
    providers.push('postmark');
  }
  
  return providers;
}

/**
 * Send email via Resend specifically
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
  return sendEmail(to, from, subject, html, text, tags, metadata);
}

/**
 * Send email via Postmark (placeholder for future implementation)
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
  // For now, fallback to Resend
  console.log('⚠️ Postmark not implemented, falling back to Resend');
  return sendEmail(to, from, subject, html, text, tags, metadata);
}