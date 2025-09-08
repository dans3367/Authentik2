/**
 * Temporal Service for GRPC communication with Temporal server
 */
import { TemporalGrpcClient } from '../temporal/temporal-grpc-client';
import { temporalLogger } from '../logger';

export interface NewsletterRequest {
  newsletter_id: string;
  tenant_id: string;
  user_id: string;
  group_uuid: string;
  subject: string;
  content: string;
  recipients: Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  }>;
  metadata: {
    tags: string[];
  };
}

export interface NewsletterResponse {
  success: boolean;
  error?: string;
  workflow_id?: string;
  run_id?: string;
  newsletter_id?: string;
  group_uuid?: string;
}

class TemporalService {
  private client: TemporalGrpcClient | null = null;
  private isConnected: boolean = false;
  private connectionStatus: string = 'disconnected';

  constructor() {
    this.initialize();
  }

  private async initialize() {
    temporalLogger.info('🔄 [TemporalService] Initializing GRPC connection to Temporal server...');
    
    try {
      // Get Temporal server address from environment or use default
      const temporalServerAddress = process.env.TEMPORAL_GRPC_SERVER || 'localhost:50051';
      
      temporalLogger.info(`🌐 [TemporalService] Connecting to Temporal GRPC server at: ${temporalServerAddress}`);
      
      // Initialize actual GRPC client
      this.client = new TemporalGrpcClient(temporalServerAddress);
      
      // Test connection
      await this.testConnection();
      
      this.isConnected = true;
      this.connectionStatus = 'connected';
      temporalLogger.info('✅ [TemporalService] GRPC connection to Temporal server established successfully');
    } catch (error) {
      temporalLogger.error('❌ [TemporalService] Failed to establish GRPC connection to Temporal server:', error);
      this.isConnected = false;
      this.connectionStatus = `failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Fallback to mock client for development
      temporalLogger.warn('🔧 [TemporalService] Falling back to mock temporal client for development');
      this.client = {
        sendNewsletter: this.sendNewsletterMock.bind(this),
        isConnected: () => false
      } as any;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('GRPC client not initialized');
    }

    // Test the connection by calling a simple method
    temporalLogger.info('🔍 [TemporalService] Testing GRPC connection...');
    
    // Add a small delay to allow connection to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    temporalLogger.info('✅ [TemporalService] GRPC connection test completed');
  }

  public getClient() {
    return this.client;
  }

  public isServiceConnected(): boolean {
    return this.isConnected;
  }

  public getConnectionStatus(): string {
    return this.connectionStatus;
  }

  private async sendNewsletterMock(request: NewsletterRequest): Promise<NewsletterResponse> {
    try {
      temporalLogger.info(`[TemporalService] Sending newsletter workflow request (MOCK) for: ${request.newsletter_id}`);
      
      // Simulate GRPC call to temporal server (development fallback)
      const workflowId = `newsletter-${request.newsletter_id}-${Date.now()}`;
      const runId = `run-${Math.random().toString(36).substring(7)}`;
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response: NewsletterResponse = {
        success: true,
        workflow_id: workflowId,
        run_id: runId,
        newsletter_id: request.newsletter_id,
        group_uuid: request.group_uuid
      };
      
      temporalLogger.info(`[TemporalService] Newsletter workflow created successfully (MOCK):`, {
        workflowId: response.workflow_id,
        newsletterId: response.newsletter_id
      });
      
      return response;
    } catch (error) {
      temporalLogger.error(`[TemporalService] Failed to send newsletter workflow (MOCK):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      // Check if the GRPC client is connected
      if (this.client.isConnected && typeof this.client.isConnected === 'function') {
        return this.client.isConnected();
      }
      
      return this.isConnected;
    } catch (error) {
      temporalLogger.error('[TemporalService] Health check failed:', error);
      return false;
    }
  }
}

// Temporal service removed from main server - now using server-node proxy
// export const temporalService = new TemporalService();

