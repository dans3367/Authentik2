import { Client, Connection, WorkflowHandle } from '@temporalio/client';
import { Worker, Runtime, DefaultLogger, LogEntry } from '@temporalio/worker';
import * as activities from '../activities';
import * as workflows from '../workflows';

export class TemporalWorkerService {
  private client: Client | null = null;
  private connection: Connection | null = null;
  private worker: Worker | null = null;

  constructor(
    private temporalAddress: string,
    private namespace: string,
    private taskQueue: string = 'authentik-temporal-tasks'
  ) {}

  async initialize(): Promise<void> {
    try {
      // Create connection
      this.connection = await Connection.connect({
        address: this.temporalAddress,
      });

      // Create client
      this.client = new Client({
        connection: this.connection,
        namespace: this.namespace,
      });

      // Configure Temporal Runtime
      Runtime.install({
        logger: new DefaultLogger('WARN', (entry: LogEntry) => {
          console.log(`[Temporal ${entry.level}] ${entry.message}`);
        }),
      });

      // Create worker
      this.worker = await Worker.create({
        connection: this.connection,
        namespace: this.namespace,
        taskQueue: this.taskQueue,
        workflowsPath: require.resolve('../workflows'),
        activities,
      });

      console.log(`✅ Temporal connection established: ${this.temporalAddress}`);
      console.log(`✅ Worker configured for task queue: ${this.taskQueue}`);
    } catch (error) {
      console.error('❌ Failed to initialize Temporal:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.worker) {
      throw new Error('Worker not initialized. Call initialize() first.');
    }

    try {
      await this.worker.run();
      console.log('✅ Temporal Worker is running');
    } catch (error) {
      console.error('❌ Failed to start Temporal Worker:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.worker) {
        this.worker.shutdown();
        this.worker = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.client = null;
      console.log('✅ Temporal services shut down');
    } catch (error) {
      console.error('❌ Error during Temporal shutdown:', error);
      throw error;
    }
  }

  async startWorkflow(
    workflowType: string,
    workflowId: string,
    input?: any
  ): Promise<WorkflowHandle> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const handle = await this.client.workflow.start(workflowType, {
        workflowId,
        taskQueue: this.taskQueue,
        args: input ? [input] : [],
      });

      return handle;
    } catch (error) {
      console.error(`❌ Failed to start workflow ${workflowType}:`, error);
      throw error;
    }
  }

  async getWorkflowHandle(workflowId: string): Promise<WorkflowHandle> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    return this.client.workflow.getHandle(workflowId);
  }

  async getWorkflowResult(workflowId: string): Promise<any> {
    try {
      const handle = await this.getWorkflowHandle(workflowId);
      return await handle.result();
    } catch (error) {
      console.error(`❌ Failed to get workflow result for ${workflowId}:`, error);
      throw error;
    }
  }

  async signalWorkflow(workflowId: string, signalName: string, payload?: any): Promise<void> {
    try {
      const handle = await this.getWorkflowHandle(workflowId);
      await handle.signal(signalName, payload);
    } catch (error) {
      console.error(`❌ Failed to signal workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    try {
      const handle = await this.getWorkflowHandle(workflowId);
      await handle.cancel();
    } catch (error) {
      console.error(`❌ Failed to cancel workflow ${workflowId}:`, error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.connection !== null;
  }

  getClient(): Client | null {
    return this.client;
  }
}


