import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import { workflowLogger } from '../logger';

// Proxy activities to be used in workflows
const { 
  sendNewsletterEmail, 
  updateNewsletterStatus, 
  logNewsletterActivity,
  processNewsletterBatch 
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '30 seconds',
  retryPolicy: {
    initialInterval: '1 second',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface NewsletterWorkflowInput {
  newsletterId: string;
  tenantId: string;
  userId: string;
  groupUUID: string;
  subject: string;
  content: string;
  recipients: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }>;
  metadata: {
    tags: string[];
  };
  batchSize?: number; // Add batch size as optional parameter
}

export interface NewsletterWorkflowResult {
  newsletterId: string;
  successful: number;
  failed: number;
  total: number;
  groupUUID: string;
  completedAt: string;
}

/**
 * Newsletter sending workflow that processes email sending in batches
 * with proper error handling and status tracking
 */
export async function newsletterSendingWorkflow(
  input: NewsletterWorkflowInput
): Promise<NewsletterWorkflowResult> {
  workflowLogger.info(`🚀 Starting newsletter sending workflow for newsletter ${input.newsletterId}`);

  // Log workflow start
  await logNewsletterActivity(
    input.newsletterId,
    'workflow_started',
    {
      groupUUID: input.groupUUID,
      recipientCount: input.recipients.length,
      tenantId: input.tenantId,
      source: 'temporal-server'
    }
  );

  try {
    // Update newsletter status to 'sending'
    await updateNewsletterStatus(input.newsletterId, 'sending', {
      sentAt: new Date().toISOString(),
      recipientCount: input.recipients.length
    });

    // Process newsletter sending in batches
    // Use batch size from input or default to 50
    const batchSize = input.batchSize || 50;
    const batches = [];
    
    for (let i = 0; i < input.recipients.length; i += batchSize) {
      batches.push(input.recipients.slice(i, i + batchSize));
    }

    workflowLogger.info(`📦 Processing ${batches.length} batches for newsletter ${input.newsletterId} (batch size: ${batchSize})`);

    let totalSuccessful = 0;
    let totalFailed = 0;

    // Process each batch sequentially to avoid overwhelming email services
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      workflowLogger.info(`📬 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} recipients`);

      try {
        const batchResult = await processNewsletterBatch({
          newsletterId: input.newsletterId,
          tenantId: input.tenantId,
          groupUUID: input.groupUUID,
          subject: input.subject,
          content: input.content,
          recipients: batch,
          batchIndex: batchIndex + 1,
          totalBatches: batches.length
        });

        totalSuccessful += batchResult.successful;
        totalFailed += batchResult.failed;

        // Log batch completion
        await logNewsletterActivity(
          input.newsletterId,
          'batch_completed',
          {
            batchIndex: batchIndex + 1,
            totalBatches: batches.length,
            batchSuccessful: batchResult.successful,
            batchFailed: batchResult.failed,
            runningTotal: { successful: totalSuccessful, failed: totalFailed },
            emailResults: batchResult.results.map((r: any) => ({
              success: r.success,
              messageId: r.messageId,
              provider: r.provider,
              error: r.error
            }))
          }
        );

      } catch (batchError) {
        workflowLogger.error(`❌ Batch ${batchIndex + 1} failed:`, batchError);
        
        // Log batch failure
        await logNewsletterActivity(
          input.newsletterId,
          'batch_failed',
          {
            batchIndex: batchIndex + 1,
            totalBatches: batches.length,
            error: batchError instanceof Error ? batchError.message : String(batchError),
            recipientCount: batch.length
          }
        );

        // Mark all recipients in this batch as failed
        totalFailed += batch.length;
      }
    }

    // Update final newsletter status
    const finalStatus = totalFailed === 0 ? 'sent' : totalSuccessful > 0 ? 'partially_sent' : 'failed';
    await updateNewsletterStatus(input.newsletterId, finalStatus, {
      recipientCount: input.recipients.length,
      successfulCount: totalSuccessful,
      failedCount: totalFailed,
      completedAt: new Date().toISOString(),
      successRate: ((totalSuccessful / input.recipients.length) * 100).toFixed(2) + '%'
    });

    // Log workflow completion
    await logNewsletterActivity(
      input.newsletterId,
      'workflow_completed',
      {
        groupUUID: input.groupUUID,
        totalRecipients: input.recipients.length,
        successful: totalSuccessful,
        failed: totalFailed,
        finalStatus,
        successRate: ((totalSuccessful / input.recipients.length) * 100).toFixed(2) + '%'
      }
    );

    const result: NewsletterWorkflowResult = {
      newsletterId: input.newsletterId,
      successful: totalSuccessful,
      failed: totalFailed,
      total: input.recipients.length,
      groupUUID: input.groupUUID,
      completedAt: new Date().toISOString()
    };

    workflowLogger.info(`✅ Newsletter workflow completed for ${input.newsletterId}:`, result);
    return result;

  } catch (error) {
    workflowLogger.error(`❌ Newsletter workflow failed for ${input.newsletterId}:`, error);

    // Update newsletter status to failed
    await updateNewsletterStatus(input.newsletterId, 'failed', {
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString()
    });

    // Log workflow failure
    await logNewsletterActivity(
      input.newsletterId,
      'workflow_failed',
      {
        groupUUID: input.groupUUID,
        error: error instanceof Error ? error.message : String(error),
        recipientCount: input.recipients.length
      }
    );

    throw error;
  }
}


