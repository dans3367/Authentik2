import { EventEmitter } from 'events';
import { BirthdayWorker, BirthdayWorkerConfig, BirthdayJobProgress } from '../workers/BirthdayWorker';

export interface BirthdayWorkerStats {
  isRunning: boolean;
  enabled: boolean;
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  config: BirthdayWorkerConfig;
}

export class BirthdayWorkerService extends EventEmitter {
  private worker: BirthdayWorker;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<BirthdayWorkerConfig> = {}) {
    super();
    
    this.worker = new BirthdayWorker(config);
    this.setupEventHandlers();
    
    // Setup periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.worker.cleanupOldJobs();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  private setupEventHandlers(): void {
    this.worker.on('started', () => {
      console.log('🎂 [BirthdayWorkerService] Birthday worker started');
      this.emit('workerStarted');
    });

    this.worker.on('stopped', () => {
      console.log('🎂 [BirthdayWorkerService] Birthday worker stopped');
      this.emit('workerStopped');
    });

    this.worker.on('jobCreated', (data) => {
      console.log(`🎂 [BirthdayWorkerService] Birthday job created: ${data.jobId}`);
      this.emit('jobCreated', data);
    });

    this.worker.on('jobStarted', (data) => {
      console.log(`🎂 [BirthdayWorkerService] Birthday job started: ${data.jobId}`);
      this.emit('jobStarted', data);
    });

    this.worker.on('jobCompleted', (data) => {
      console.log(`🎂 [BirthdayWorkerService] Birthday job completed: ${data.jobId}`);
      this.emit('jobCompleted', data);
    });

    this.worker.on('jobFailed', (data) => {
      console.error(`🎂 [BirthdayWorkerService] Birthday job failed: ${data.jobId}`, data.error);
      this.emit('jobFailed', data);
    });

    this.worker.on('error', (error) => {
      console.error('🎂 [BirthdayWorkerService] Birthday worker error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Start the birthday worker
   * DISABLED: Workers are now handled by cardprocessor-go on port 5004
   */
  start(): void {
    console.log('🚫 [BirthdayWorkerService] Start called but DISABLED - workers handled by cardprocessor-go on port 5004');
    return;
    
    // Original code commented out - workers now handled by cardprocessor-go
    // this.worker.start();
  }

  /**
   * Stop the birthday worker
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    await this.worker.stop();
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BirthdayJobProgress | null {
    return this.worker.getJobStatus(jobId);
  }

  /**
   * Get all job statuses
   */
  getAllJobStatuses(): Record<string, BirthdayJobProgress> {
    return this.worker.getAllJobStatuses();
  }

  /**
   * Get worker statistics
   */
  getStats(): BirthdayWorkerStats {
    return this.worker.getStats();
  }

  /**
   * Force cleanup of old jobs
   */
  cleanupOldJobs(maxAge?: number): number {
    return this.worker.cleanupOldJobs(maxAge);
  }

  /**
   * Check if the worker is running
   */
  isRunning(): boolean {
    return this.worker.getStats().isRunning;
  }

  /**
   * Check if the worker is enabled
   */
  isEnabled(): boolean {
    return this.worker.getStats().enabled;
  }
}

// Create a singleton instance
// DISABLED: Workers are now handled by cardprocessor-go on port 5004
const birthdayWorkerService = new BirthdayWorkerService({
  checkInterval: parseInt(process.env.BIRTHDAY_CHECK_INTERVAL || '3600000'), // 1 hour default
  batchSize: parseInt(process.env.BIRTHDAY_BATCH_SIZE || '10'),
  maxRetries: parseInt(process.env.BIRTHDAY_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.BIRTHDAY_RETRY_DELAY || '5000'),
  enabled: false, // DISABLED - workers handled by cardprocessor-go
});

export { birthdayWorkerService };
export default birthdayWorkerService;