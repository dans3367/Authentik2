/**
 * Newsletter-related activity functions for Temporal workflows
 */

export interface BatchResult {
  successful: number;
  failed: number;
  batchIndex: number;
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

/**
 * Send a single newsletter email
 */
export async function sendNewsletterEmail(
  recipient: { id: string; email: string; firstName?: string; lastName?: string },
  subject: string,
  content: string,
  newsletterId: string,
  tenantId: string,
  groupUUID: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`Sending newsletter email to ${recipient.email} for newsletter ${newsletterId}`);
  
  try {
    // Call the main Authentik backend API to send the email
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    const response = await fetch(`${backendUrl}/api/newsletters/${newsletterId}/send-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // We'll need to pass authentication here
      },
      body: JSON.stringify({
        recipient,
        subject,
        content,
        groupUUID,
        tenantId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`Successfully sent email to ${recipient.email}`);
    return { success: true };

  } catch (error) {
    console.error(`Failed to send email to ${recipient.email}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Process a batch of newsletter emails
 */
export async function processNewsletterBatch(input: NewsletterBatchInput): Promise<BatchResult> {
  console.log(`Processing batch ${input.batchIndex}/${input.totalBatches} with ${input.recipients.length} recipients`);
  
  let successful = 0;
  let failed = 0;

  // Process emails in parallel within the batch (but limit concurrency)
  const concurrencyLimit = 5;
  const promises = [];

  for (let i = 0; i < input.recipients.length; i += concurrencyLimit) {
    const batch = input.recipients.slice(i, i + concurrencyLimit);
    
    const batchPromises = batch.map(recipient => 
      sendNewsletterEmail(
        recipient,
        input.subject,
        input.content,
        input.newsletterId,
        input.tenantId,
        input.groupUUID
      )
    );

    promises.push(...batchPromises);
  }

  // Wait for all emails in this batch to complete
  const results = await Promise.allSettled(promises);

  // Count successes and failures
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      successful++;
    } else {
      failed++;
      console.error(`Email ${index + 1} in batch ${input.batchIndex} failed:`, 
        result.status === 'fulfilled' ? result.value.error : result.reason);
    }
  });

  console.log(`Batch ${input.batchIndex} completed: ${successful} successful, ${failed} failed`);

  return {
    successful,
    failed,
    batchIndex: input.batchIndex
  };
}

/**
 * Update newsletter status in the database
 */
export async function updateNewsletterStatus(
  newsletterId: string,
  status: string,
  metadata?: any
): Promise<void> {
  console.log(`Updating newsletter ${newsletterId} status to: ${status}`);
  
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    const response = await fetch(`${backendUrl}/api/newsletters/${newsletterId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        metadata
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update newsletter status: ${response.status} ${errorText}`);
    }

    console.log(`Successfully updated newsletter ${newsletterId} status to ${status}`);
  } catch (error) {
    console.error(`Failed to update newsletter status:`, error);
    throw error;
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
  console.log(`[Newsletter Activity] ${newsletterId}: ${activity}`, details);
  
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    const response = await fetch(`${backendUrl}/api/newsletters/${newsletterId}/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activity,
        details,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      // Don't throw error for logging failures, just log it
      console.warn(`Failed to log newsletter activity: ${response.status}`);
    }
  } catch (error) {
    console.warn(`Failed to log newsletter activity:`, error);
    // Don't throw - logging failures shouldn't break the workflow
  }
}
