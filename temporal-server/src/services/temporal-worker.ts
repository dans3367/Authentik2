import { Client, Connection, WorkflowHandle } from '@temporalio/client';
import { Worker, Runtime, DefaultLogger, LogEntry, NativeConnection } from '@temporalio/worker';
import * as activities from '../activities';
import * as workflows from '../workflows';
import { workerLogger } from '../logger';
import { initializeActivityConfigFromEnv } from '../activity-config';

export class TemporalWorkerService {
  private client: Client | null = null;
  private connection: Connection | null = null; // Client connection for starting workflows
  private nativeConnection: NativeConnection | null = null; // Worker connection
  private worker: Worker | null = null;

  constructor(
    private temporalAddress: string,
    private namespace: string,
    private taskQueue: string = 'authentik-tasks'
  ) {}

  async initialize(): Promise<void> {
    try {
      // Initialize activity configuration from environment variables
      // This must be done before creating the worker since activities need config
      const config = initializeActivityConfigFromEnv();
      workerLogger.info(`🔧 Initialized activity configuration:`, {
        backendUrl: config.backendUrl,
        primaryEmailProvider: config.primaryEmailProvider,
        fromEmail: config.fromEmail,
        hasResendKey: config.resendApiKey ? 'yes' : 'no',
        hasPostmarkToken: config.postmarkApiToken ? 'yes' : 'no'
      });
      
      // Install Temporal Runtime once; ignore if already installed
      try {
        Runtime.install({
          logger: new DefaultLogger('DEBUG', (entry: LogEntry) => {
            workerLogger.debug(`[Temporal ${entry.level}] ${entry.message}`);
          }),
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('already been instantiated')) {
          workerLogger.warn('⚠️ Temporal Runtime already installed; continuing');
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
      workerLogger.info(`🔧 Creating worker with configuration:`);
      workerLogger.info(`   - Address: ${this.temporalAddress}`);
      workerLogger.info(`   - Namespace: ${this.namespace}`);
      workerLogger.info(`   - Task Queue: ${this.taskQueue}`);
      
      this.worker = await Worker.create({
        connection: this.nativeConnection,
        namespace: this.namespace,
        taskQueue: this.taskQueue,
        workflowsPath: require.resolve('../workflows'),
        activities,
      });

      workerLogger.info(`✅ Temporal connections established: ${this.temporalAddress}`);
      workerLogger.info(`✅ Worker configured for task queue: ${this.taskQueue}`);
      workerLogger.info(
        `🧩 Workflows loaded: ${Object.keys(workflows).join(', ') || 'none'} | Activities loaded: ${Object.keys(activities).join(', ') || 'none'}`
      );
    } catch (error) {
      workerLogger.error('❌ Failed to initialize Temporal:', error);
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
        workerLogger.error('❌ Temporal Worker error:', error);
        process.exit(1);
      });
      workerLogger.info('✅ Temporal Worker is running and polling for tasks');
    } catch (error) {
      workerLogger.error('❌ Failed to start Temporal Worker:', error);
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
      workerLogger.info('✅ Temporal services shut down');
    } catch (error) {
      workerLogger.error('❌ Error during Temporal shutdown:', error);
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
      workerLogger.error(`❌ Failed to start workflow ${workflowType}:`, error);
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
      workerLogger.error(`❌ Failed to get workflow result for ${workflowId}:`, error);
      throw error;
    }
  }

  async signalWorkflow(workflowId: string, signalName: string, payload?: any): Promise<void> {
    try {
      const handle = await this.getWorkflowHandle(workflowId);
      await handle.signal(signalName, payload);
    } catch (error) {
      workerLogger.error(`❌ Failed to signal workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    try {
      const handle = await this.getWorkflowHandle(workflowId);
      await handle.cancel();
    } catch (error) {
      workerLogger.error(`❌ Failed to cancel workflow ${workflowId}:`, error);
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


