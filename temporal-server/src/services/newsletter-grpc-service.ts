import { sendUnaryData, ServerUnaryCall } from '@grpc/grpc-js';
import { v4 as uuidv4 } from 'uuid';
import { TemporalWorkerService } from './temporal-worker';

// GRPC message types (we'll define these based on our proto)
export interface NewsletterRequest {
  newsletter_id: string;
  tenant_id: string;
  user_id: string;
  group_uuid: string;
  subject: string;
  content: string;
  recipients: NewsletterRecipient[];
  metadata: NewsletterMetadata;
}

export interface NewsletterRecipient {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface NewsletterMetadata {
  tags: string[];
}

export interface NewsletterResponse {
  success: boolean;
  workflow_id: string;
  run_id: string;
  newsletter_id: string;
  group_uuid: string;
  error?: string;
}

export interface NewsletterStatusRequest {
  workflow_id: string;
}

export interface NewsletterStatusResponse {
  success: boolean;
  newsletter_id: string;
  successful: number;
  failed: number;
  total: number;
  group_uuid: string;
  completed_at: string;
  status: string;
  error?: string;
}

export interface CancelNewsletterRequest {
  workflow_id: string;
}

export interface CancelNewsletterResponse {
  success: boolean;
  error?: string;
}

export class NewsletterGrpcService {
  constructor(private temporalWorker: TemporalWorkerService) {}

  async sendNewsletter(
    call: ServerUnaryCall<NewsletterRequest, NewsletterResponse>,
    callback: sendUnaryData<NewsletterResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      console.log(`📧 Starting newsletter workflow for ${request.newsletter_id}`);

      // Generate unique workflow ID
      const workflowId = `newsletter-${request.newsletter_id}-${Date.now()}-${uuidv4().substring(0, 8)}`;

      // Convert GRPC request to Temporal workflow input
      const workflowInput = {
        newsletterId: request.newsletter_id,
        tenantId: request.tenant_id,
        userId: request.user_id,
        groupUUID: request.group_uuid,
        subject: request.subject,
        content: request.content,
        recipients: request.recipients.map(recipient => ({
          id: recipient.id,
          email: recipient.email,
          firstName: recipient.first_name,
          lastName: recipient.last_name,
        })),
        metadata: {
          tags: request.metadata.tags,
        },
      };

      // Start the workflow
      const handle = await this.temporalWorker.startWorkflow(
        'newsletterSendingWorkflow',
        workflowId,
        workflowInput
      );

      const response: NewsletterResponse = {
        success: true,
        workflow_id: handle.workflowId,
        run_id: handle.firstExecutionRunId,
        newsletter_id: request.newsletter_id,
        group_uuid: request.group_uuid,
      };

      console.log(`✅ Newsletter workflow started: ${workflowId}`);
      callback(null, response);

    } catch (error) {
      console.error('❌ Failed to send newsletter:', error);
      
      const response: NewsletterResponse = {
        success: false,
        workflow_id: '',
        run_id: '',
        newsletter_id: call.request.newsletter_id,
        group_uuid: call.request.group_uuid,
        error: error.message || 'Unknown error occurred',
      };

      callback(null, response);
    }
  }

  async getNewsletterStatus(
    call: ServerUnaryCall<NewsletterStatusRequest, NewsletterStatusResponse>,
    callback: sendUnaryData<NewsletterStatusResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      console.log(`📊 Getting newsletter status for workflow ${request.workflow_id}`);

      // Get workflow result
      const result = await this.temporalWorker.getWorkflowResult(request.workflow_id);

      const response: NewsletterStatusResponse = {
        success: true,
        newsletter_id: result.newsletterId,
        successful: result.successful,
        failed: result.failed,
        total: result.total,
        group_uuid: result.groupUUID,
        completed_at: result.completedAt,
        status: 'completed',
      };

      console.log(`✅ Newsletter status retrieved for ${request.workflow_id}`);
      callback(null, response);

    } catch (error) {
      console.error('❌ Failed to get newsletter status:', error);

      const response: NewsletterStatusResponse = {
        success: false,
        newsletter_id: '',
        successful: 0,
        failed: 0,
        total: 0,
        group_uuid: '',
        completed_at: '',
        status: 'error',
        error: error.message || 'Unknown error occurred',
      };

      callback(null, response);
    }
  }

  async cancelNewsletter(
    call: ServerUnaryCall<CancelNewsletterRequest, CancelNewsletterResponse>,
    callback: sendUnaryData<CancelNewsletterResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      console.log(`🛑 Cancelling newsletter workflow ${request.workflow_id}`);

      await this.temporalWorker.cancelWorkflow(request.workflow_id);

      const response: CancelNewsletterResponse = {
        success: true,
      };

      console.log(`✅ Newsletter workflow cancelled: ${request.workflow_id}`);
      callback(null, response);

    } catch (error) {
      console.error('❌ Failed to cancel newsletter:', error);

      const response: CancelNewsletterResponse = {
        success: false,
        error: error.message || 'Unknown error occurred',
      };

      callback(null, response);
    }
  }
}


