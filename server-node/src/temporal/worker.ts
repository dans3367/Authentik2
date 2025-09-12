import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/example-activities';

/**
 * Worker configuration and startup
 */
export class TemporalWorker {
  private worker: Worker | null = null;

  async start(): Promise<void> {
    try {
      const serverUrl = process.env.TEMPORAL_SERVER_URL || '100.125.36.104:7233';
      const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'authentik-tasks';
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

      console.log(`Starting Temporal worker for task queue: ${taskQueue}`);

      // Create native connection
      const connection = await NativeConnection.connect({
        address: serverUrl,
      });

      // Create and configure worker
      this.worker = await Worker.create({
        connection,
        namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows'),
        activities: {
          ...activities,
          ...require('./activities/newsletter-activities')
        },
        // Worker options
        maxConcurrentActivityTaskExecutions: 10,
        maxConcurrentWorkflowTaskExecutions: 5, // Lower for newsletter sending
      });

      console.log('✅ Temporal worker created successfully');

      // Start the worker
      await this.worker.run();
    } catch (error) {
      console.error('❌ Failed to start Temporal worker:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      console.log('Shutting down Temporal worker...');
      this.worker.shutdown();
      this.worker = null;
      console.log('✅ Temporal worker shut down');
    }
  }
}

// If this file is run directly, start the worker
if (require.main === module) {
  const worker = new TemporalWorker();
  
  worker.start().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down worker...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down worker...');
    await worker.stop();
    process.exit(0);
  });
}
