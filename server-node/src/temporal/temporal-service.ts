import { Client, Connection, WorkflowHandle } from '@temporalio/client';
import { WorkflowExecutionAlreadyStartedError } from '@temporalio/common';

export class TemporalService {
  private client: Client | null = null;
  private connection: Connection | null = null;

  constructor() {
    this.client = null;
    this.connection = null;
  }

  async connect(): Promise<void> {
    try {
      const serverUrl = process.env.TEMPORAL_SERVER_URL || '100.125.36.104:7233';
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

      console.log(`Connecting to Temporal server at ${serverUrl}`);

      // Create connection
      this.connection = await Connection.connect({
        address: serverUrl,
        // Add TLS configuration if needed
        // tls: {
        //   serverNameOverride: 'temporal',
        //   clientCertPair: {
        //     crt: Buffer.from(process.env.TEMPORAL_TLS_CERT || ''),
        //     key: Buffer.from(process.env.TEMPORAL_TLS_KEY || ''),
        //   },
        // },
      });

      // Create client
      this.client = new Client({
        connection: this.connection,
        namespace,
      });

      console.log(`✅ Connected to Temporal namespace: ${namespace}`);
    } catch (error) {
      console.error('❌ Failed to connect to Temporal:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
        this.client = null;
        console.log('✅ Disconnected from Temporal');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from Temporal:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.connection !== null;
  }

  async startWorkflow(
    workflowType: string,
    workflowId: string,
    input?: any
  ): Promise<WorkflowHandle> {
    if (!this.client) {
      throw new Error('Temporal client not connected');
    }

    try {
      const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'authentik-tasks';

      const handle = await this.client.workflow.start(workflowType, {
        workflowId,
        taskQueue,
        args: input ? [input] : [],
      });

      console.log(`✅ Started workflow: ${workflowType} with ID: ${workflowId}`);
      return handle;
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        console.log(`⚠️ Workflow ${workflowId} already started, getting handle`);
        return this.client.workflow.getHandle(workflowId);
      }
      console.error(`❌ Failed to start workflow ${workflowType}:`, error);
      throw error;
    }
  }

  async getWorkflowHandle(workflowId: string): Promise<WorkflowHandle> {
    if (!this.client) {
      throw new Error('Temporal client not connected');
    }

    return this.client.workflow.getHandle(workflowId);
  }

  async getWorkflowResult(workflowId: string): Promise<any> {
    if (!this.client) {
      throw new Error('Temporal client not connected');
    }

    try {
      const handle = await this.getWorkflowHandle(workflowId);
      const result = await handle.result();
      console.log(`✅ Got workflow result for: ${workflowId}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to get workflow result for ${workflowId}:`, error);
      throw error;
    }
  }

  async signalWorkflow(
    workflowId: string,
    signalName: string,
    payload?: any
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not connected');
    }

    try {
      const handle = await this.getWorkflowHandle(workflowId);
      await handle.signal(signalName, payload);
      console.log(`✅ Sent signal ${signalName} to workflow: ${workflowId}`);
    } catch (error) {
      console.error(`❌ Failed to signal workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not connected');
    }

    try {
      const handle = await this.getWorkflowHandle(workflowId);
      await handle.cancel();
      console.log(`✅ Cancelled workflow: ${workflowId}`);
    } catch (error) {
      console.error(`❌ Failed to cancel workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not connected');
    }

    try {
      const handle = await this.getWorkflowHandle(workflowId);
      await handle.terminate(reason);
      console.log(`✅ Terminated workflow: ${workflowId}`);
    } catch (error) {
      console.error(`❌ Failed to terminate workflow ${workflowId}:`, error);
      throw error;
    }
  }

  getClient(): Client | null {
    return this.client;
  }
}
