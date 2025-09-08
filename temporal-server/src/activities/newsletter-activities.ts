/**
 * Newsletter-related activity functions for Temporal workflows
 */
import { sendEmail, SendEmailResult } from './email-activities';

export interface BatchResult {
  successful: number;
  failed: number;
  batchIndex: number;
  results: SendEmailResult[];
}

export interface NewsletterBatchInput {
  newsletterId: string;
  tenantId: string;
  groupUUID: string;
  subject: string;
  content: string;
  recipients: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }>;
  batchIndex: number;
  totalBatches: number;
}

export interface NewsletterRecipient {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Generate personalized email content for a recipient
 */
function personalizeContent(content: string, recipient: NewsletterRecipient): string {
  let personalizedContent = content;
  
  // Replace common placeholders
  if (recipient.firstName) {
    personalizedContent = personalizedContent.replace(/\{firstName\}/g, recipient.firstName);
    personalizedContent = personalizedContent.replace(/\{first_name\}/g, recipient.firstName);
  }
  
  if (recipient.lastName) {
    personalizedContent = personalizedContent.replace(/\{lastName\}/g, recipient.lastName);
    personalizedContent = personalizedContent.replace(/\{last_name\}/g, recipient.lastName);
  }
  
  const fullName = [recipient.firstName, recipient.lastName].filter(Boolean).join(' ');
  if (fullName) {
    personalizedContent = personalizedContent.replace(/\{fullName\}/g, fullName);
    personalizedContent = personalizedContent.replace(/\{full_name\}/g, fullName);
  }
  
  personalizedContent = personalizedContent.replace(/\{email\}/g, recipient.email);
  
  return personalizedContent;
}

/**
 * Generate unsubscribe link for a recipient
 */
function generateUnsubscribeLink(newsletterId: string, recipientId: string, tenantId: string): string {
  const baseUrl = process.env.FRONTEND_URL || 'https://app.zendwise.work';
  return `${baseUrl}/unsubscribe?newsletter=${newsletterId}&recipient=${recipientId}&tenant=${tenantId}`;
}

/**
 * Send a single newsletter email with personalization
 */
export async function sendNewsletterEmail(
  recipient: NewsletterRecipient,
  subject: string,
  content: string,
  newsletterId: string,
  tenantId: string,
  groupUUID: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  console.log(`📧 Sending newsletter email to ${recipient.email} for newsletter ${newsletterId}`);
  
  try {
    // Personalize the content
    const personalizedContent = personalizeContent(content, recipient);
    
    // Add unsubscribe link
    const unsubscribeLink = generateUnsubscribeLink(newsletterId, recipient.id, tenantId);
    const contentWithUnsubscribe = personalizedContent + `
      <br/><br/>
      <div style="font-size: 12px; color: #666; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
        <p>You received this email because you're subscribed to our newsletter.</p>
        <p><a href="${unsubscribeLink}" style="color: #666;">Unsubscribe</a> from future emails</p>
      </div>
    `;

    // Determine sender email
    const fromEmail = process.env.FROM_EMAIL || 'noreply@zendwise.work';
    console.log(`🔍 [Debug] FROM_EMAIL env var: ${process.env.FROM_EMAIL || 'not set'}`);
    console.log(`🔍 [Debug] Using fromEmail: ${fromEmail}`);
    
    // Generate text version (basic HTML to text conversion)
    const textContent = personalizedContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '');

    const result = await sendEmail(
      recipient.email,
      fromEmail,
      subject,
      contentWithUnsubscribe,
      textContent,
      [`newsletter-${newsletterId}`, `group-${groupUUID}`, `tenant-${tenantId}`],
      {
        newsletterId,
        recipientId: recipient.id,
        tenantId,
        groupUUID,
        timestamp: new Date().toISOString(),
      }
    );

    if (result.success) {
      console.log(`✅ Successfully sent email to ${recipient.email} (ID: ${result.messageId})`);
      return { 
        success: true, 
        messageId: result.messageId 
      };
    } else {
      console.error(`❌ Failed to send email to ${recipient.email}:`, result.error);
      return { 
        success: false, 
        error: result.error 
      };
    }

  } catch (error: unknown) {
    console.error(`❌ Failed to send email to ${recipient.email}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Process a batch of newsletter emails
 */
export async function processNewsletterBatch(input: NewsletterBatchInput): Promise<BatchResult> {
  console.log(`📬 Processing batch ${input.batchIndex}/${input.totalBatches} with ${input.recipients.length} recipients`);
  
  const results: SendEmailResult[] = [];
  let successful = 0;
  let failed = 0;

  // Process emails with controlled concurrency
  const concurrencyLimit = parseInt(process.env.EMAIL_CONCURRENCY_LIMIT || '5');
  
  for (let i = 0; i < input.recipients.length; i += concurrencyLimit) {
    const batch = input.recipients.slice(i, i + concurrencyLimit);
    
    const batchPromises = batch.map(async (recipient) => {
      const result = await sendNewsletterEmail(
        recipient,
        input.subject,
        input.content,
        input.newsletterId,
        input.tenantId,
        input.groupUUID
      );

      const emailResult: SendEmailResult = {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        provider: 'unknown' as any, // Will be filled by sendEmail
      };

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      return emailResult;
    });

    // Wait for this sub-batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add a small delay between sub-batches to avoid overwhelming the email service
    if (i + concurrencyLimit < input.recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Batch ${input.batchIndex} completed: ${successful} successful, ${failed} failed`);

  return {
    successful,
    failed,
    batchIndex: input.batchIndex,
    results
  };
}

/**
 * Update newsletter status via backend API
 */
export async function updateNewsletterStatus(
  newsletterId: string,
  status: string,
  metadata?: any
): Promise<void> {
  console.log(`📊 Updating newsletter ${newsletterId} status to: ${status}`);
  
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3500';
    console.log(`🔗 Attempting to connect to backend at: ${backendUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${backendUrl}/api/newsletters/${newsletterId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service': 'temporal-server', // Internal service authentication
      },
      body: JSON.stringify({
        status,
        metadata
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update newsletter status: ${response.status} ${errorText}`);
    }

    console.log(`✅ Successfully updated newsletter ${newsletterId} status to ${status}`);
    } catch (error: unknown) {
      console.error(`❌ Failed to update newsletter status (non-blocking):`, error);
      
      // Check if it's a connection error
      const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorCode === 'ECONNREFUSED' || errorMessage?.includes('fetch failed')) {
      console.warn(`⚠️ Backend server not reachable at ${process.env.BACKEND_URL || 'http://localhost:3500'}. Continuing without status update.`);
    } else {
      console.warn(`⚠️ Status update failed for newsletter ${newsletterId}:`, errorMessage);
    }
    
    // Don't throw error - make this non-blocking so email sending can continue
    // The newsletter can still be sent even if we can't update the status in the backend
  }
}

/**
 * Log newsletter activity for tracking and debugging
 */
export async function logNewsletterActivity(
  newsletterId: string,
  activity: string,
  details?: any
): Promise<void> {
  const logEntry = {
    newsletterId,
    activity,
    details,
    timestamp: new Date().toISOString(),
    source: 'temporal-server'
  };

  console.log(`📝 [Newsletter Activity] ${newsletterId}: ${activity}`, details);
  
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3500';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for logging
    
    const response = await fetch(`${backendUrl}/api/newsletters/${newsletterId}/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service': 'temporal-server',
      },
      body: JSON.stringify(logEntry),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Don't throw error for logging failures, just log it
      console.warn(`⚠️ Failed to log newsletter activity: ${response.status}`);
    }
  } catch (error: unknown) {
    const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorCode === 'ECONNREFUSED' || errorMessage?.includes('fetch failed')) {
      console.warn(`⚠️ Backend server not reachable for logging. Activity logged locally only.`);
    } else {
      console.warn(`⚠️ Failed to log newsletter activity:`, errorMessage);
    }
    // Don't throw - logging failures shouldn't break the workflow
  }
}


