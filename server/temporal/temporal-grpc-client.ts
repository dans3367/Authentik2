import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

// GRPC client types (matching the proto definitions)
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

export interface WorkflowRequest {
  workflow_type: string;
  workflow_id: string;
  input: string; // JSON serialized input
}

export interface WorkflowResponse {
  success: boolean;
  workflow_id: string;
  run_id: string;
  error?: string;
}

export class TemporalGrpcClient {
  private newsletterClient: any;
  private workflowClient: any;
  private connected: boolean = false;

  constructor(
    private serverAddress: string = 'localhost:50051'
  ) {
    this.initializeClients();
  }

  private initializeClients(): void {
    try {
      // Load proto definitions
      const PROTO_PATH = path.join(__dirname, '../../temporal-server/proto/temporal-bridge.proto');
      
      const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });

      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
      
      // Create clients
      this.newsletterClient = new protoDescriptor.temporal.bridge.NewsletterService(
        this.serverAddress,
        grpc.credentials.createInsecure()
      );

      this.workflowClient = new protoDescriptor.temporal.bridge.WorkflowService(
        this.serverAddress,
        grpc.credentials.createInsecure()
      );

      this.connected = true;
      console.log(`✅ GRPC clients initialized for ${this.serverAddress}`);
    } catch (error) {
      console.error('❌ Failed to initialize GRPC clients:', error);
      this.connected = false;
    }
  }

  async sendNewsletter(request: NewsletterRequest): Promise<NewsletterResponse> {
    if (!this.connected) {
      throw new Error('GRPC client not connected to temporal server');
    }

    return new Promise((resolve, reject) => {
      this.newsletterClient.sendNewsletter(request, (error: any, response: NewsletterResponse) => {
        if (error) {
          console.error('❌ GRPC sendNewsletter error:', error);
          reject(error);
        } else {
          console.log(`✅ Newsletter workflow started via GRPC: ${response.workflow_id}`);
          resolve(response);
        }
      });
    });
  }

  async getNewsletterStatus(workflowId: string): Promise<any> {
    if (!this.connected) {
      throw new Error('GRPC client not connected to temporal server');
    }

    return new Promise((resolve, reject) => {
      this.newsletterClient.getNewsletterStatus(
        { workflow_id: workflowId },
        (error: any, response: any) => {
          if (error) {
            console.error('❌ GRPC getNewsletterStatus error:', error);
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async cancelNewsletter(workflowId: string): Promise<any> {
    if (!this.connected) {
      throw new Error('GRPC client not connected to temporal server');
    }

    return new Promise((resolve, reject) => {
      this.newsletterClient.cancelNewsletter(
        { workflow_id: workflowId },
        (error: any, response: any) => {
          if (error) {
            console.error('❌ GRPC cancelNewsletter error:', error);
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async startWorkflow(request: WorkflowRequest): Promise<WorkflowResponse> {
    if (!this.connected) {
      throw new Error('GRPC client not connected to temporal server');
    }

    return new Promise((resolve, reject) => {
      this.workflowClient.startWorkflow(request, (error: any, response: WorkflowResponse) => {
        if (error) {
          console.error('❌ GRPC startWorkflow error:', error);
          reject(error);
        } else {
          console.log(`✅ Workflow started via GRPC: ${response.workflow_id}`);
          resolve(response);
        }
      });
    });
  }

  async getWorkflowResult(workflowId: string): Promise<any> {
    if (!this.connected) {
      throw new Error('GRPC client not connected to temporal server');
    }

    return new Promise((resolve, reject) => {
      this.workflowClient.getWorkflowResult(
        { workflow_id: workflowId },
        (error: any, response: any) => {
          if (error) {
            console.error('❌ GRPC getWorkflowResult error:', error);
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async signalWorkflow(workflowId: string, signalName: string, payload?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('GRPC client not connected to temporal server');
    }

    const request = {
      workflow_id: workflowId,
      signal_name: signalName,
      payload: payload ? JSON.stringify(payload) : ''
    };

    return new Promise((resolve, reject) => {
      this.workflowClient.signalWorkflow(request, (error: any, response: any) => {
        if (error) {
          console.error('❌ GRPC signalWorkflow error:', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async cancelWorkflow(workflowId: string): Promise<any> {
    if (!this.connected) {
      throw new Error('GRPC client not connected to temporal server');
    }

    return new Promise((resolve, reject) => {
      this.workflowClient.cancelWorkflow(
        { workflow_id: workflowId },
        (error: any, response: any) => {
          if (error) {
            console.error('❌ GRPC cancelWorkflow error:', error);
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    try {
      if (this.newsletterClient) {
        this.newsletterClient.close();
      }
      if (this.workflowClient) {
        this.workflowClient.close();
      }
      this.connected = false;
      console.log('✅ GRPC clients disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting GRPC clients:', error);
    }
  }
}


