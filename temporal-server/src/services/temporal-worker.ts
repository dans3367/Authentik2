import { Client, Connection, WorkflowHandle } from '@temporalio/client';
import { Worker, Runtime, DefaultLogger, LogEntry, NativeConnection } from '@temporalio/worker';
import * as activities from '../activities';
import * as workflows from '../workflows';

export class TemporalWorkerService {
  private client: Client | null = null;
  private connection: Connection | null = null; // Client connection for starting workflows
  private nativeConnection: NativeConnection | null = null; // Worker connection
  private worker: Worker | null = null;

  constructor(
    private temporalAddress: string,
    private namespace: string,
    private taskQueue: string = 'newsletterSendingWorkflow'
  ) {}

  async initialize(): Promise<void> {
    try {
      // Install Temporal Runtime once; ignore if already installed
      try {
        Runtime.install({
          logger: new DefaultLogger('DEBUG', (entry: LogEntry) => {
            console.log(`[Temporal ${entry.level}] ${entry.message}`);
          }),
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('already been instantiated')) {
          console.warn('⚠️ Temporal Runtime already installed; continuing');
        } else {
          throw e;
        }
      }

      // Create worker native connection (for polling tasks)
      this.nativeConnection = await NativeConnection.connect({
        address: this.temporalAddress,
      });

      // Create client (for starting/signaling workflows)
      this.connection = await Connection.connect({ address: this.temporalAddress });
      this.client = new Client({ connection: this.connection, namespace: this.namespace });

      // Create worker
      console.log(`🔧 Creating worker with configuration:`);
      console.log(`   - Address: ${this.temporalAddress}`);
      console.log(`   - Namespace: ${this.namespace}`);
      console.log(`   - Task Queue: ${this.taskQueue}`);
      
      this.worker = await Worker.create({
        connection: this.nativeConnection,
        namespace: this.namespace,
        taskQueue: this.taskQueue,
        workflowsPath: require.resolve('../workflows'),
        activities,
      });

      console.log(`✅ Temporal connections established: ${this.temporalAddress}`);
      console.log(`✅ Worker configured for task queue: ${this.taskQueue}`);
      console.log(
        `🧩 Workflows loaded: ${Object.keys(workflows).join(', ') || 'none'} | Activities loaded: ${Object.keys(activities).join(', ') || 'none'}`
      );
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
      // Start the worker without awaiting (it runs indefinitely)
      this.worker.run().catch((error) => {
        console.error('❌ Temporal Worker error:', error);
        process.exit(1);
      });
      console.log('✅ Temporal Worker is running and polling for tasks');
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

      if (this.nativeConnection) {
        await this.nativeConnection.close();
        this.nativeConnection = null;
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


