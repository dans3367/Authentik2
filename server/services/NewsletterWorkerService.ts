import { NewsletterWorker, NewsletterJob, JobProgress, WorkerConfig } from '../workers/NewsletterWorker';
import { EventEmitter } from 'events';

export interface WorkerServiceConfig {
  numberOfWorkers: number;
  workerConfig: Partial<WorkerConfig>;
  autoStart: boolean;
  healthCheckInterval: number;
  cleanupInterval: number;
  maxJobAge: number;
}

export interface WorkerServiceStats {
  totalWorkers: number;
  activeWorkers: number;
  totalActiveJobs: number;
  totalQueuedJobs: number;
  totalJobs: number;
  isHealthy: boolean;
  workers: Array<{
    id: string;
    isRunning: boolean;
    stats: ReturnType<NewsletterWorker['getStats']>;
  }>;
}

export class NewsletterWorkerService extends EventEmitter {
  private workers = new Map<string, NewsletterWorker>();
  private config: WorkerServiceConfig;
  private isStarted = false;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private roundRobinIndex = 0;

  constructor(config: Partial<WorkerServiceConfig> = {}) {
    super();
    
    this.config = {
      numberOfWorkers: config.numberOfWorkers || 3,
      workerConfig: config.workerConfig || {},
      autoStart: config.autoStart !== false,
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      maxJobAge: config.maxJobAge || 24 * 60 * 60 * 1000, // 24 hours
    };

    console.log('🏭 [NewsletterWorkerService] Initialized with config:', this.config);

    // Auto-start if configured
    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start the worker service
   */
  start(): void {
    if (this.isStarted) {
      console.log('⚠️ [NewsletterWorkerService] Service already started');
      return;
    }

    console.log('🚀 [NewsletterWorkerService] Starting worker service...');
    this.isStarted = true;

    // Create and start workers
    for (let i = 0; i < this.config.numberOfWorkers; i++) {
      this.createWorker(i);
    }

    // Start periodic tasks
    this.startPeriodicTasks();

    this.emit('started');
    console.log(`✅ [NewsletterWorkerService] Started with ${this.config.numberOfWorkers} workers`);
  }

  /**
   * Stop the worker service
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      console.log('⚠️ [NewsletterWorkerService] Service not started');
      return;
    }

    console.log('🛑 [NewsletterWorkerService] Stopping worker service...');
    this.isStarted = false;

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Stop all workers
    const stopPromises = Array.from(this.workers.values()).map(worker => worker.stop());
    await Promise.all(stopPromises);

    this.workers.clear();

    this.emit('stopped');
    console.log('✅ [NewsletterWorkerService] Service stopped');
  }

  /**
   * Add a job to the worker queue
   */
  addJob(job: Omit<NewsletterJob, 'id' | 'createdAt'>): string {
    if (!this.isStarted) {
      throw new Error('Worker service not started');
    }

    // Use round-robin to distribute jobs across workers
    const worker = this.getNextWorker();
    if (!worker) {
      throw new Error('No available workers');
    }

    const jobId = worker.addJob(job);
    
    console.log(`📋 [NewsletterWorkerService] Job ${jobId} assigned to worker ${Array.from(this.workers.keys())[this.roundRobinIndex]}`);
    
    this.emit('jobAdded', { jobId, workerId: Array.from(this.workers.keys())[this.roundRobinIndex] });
    
    return jobId;
  }

  /**
   * Get job status from any worker
   */
  getJobStatus(jobId: string): JobProgress | null {
    for (const worker of this.workers.values()) {
      const status = worker.getJobStatus(jobId);
      if (status) {
        return status;
      }
    }
    return null;
  }

  /**
   * Get all job statuses from all workers
   */
  getAllJobStatuses(): Record<string, JobProgress> {
    const allStatuses: Record<string, JobProgress> = {};
    
    for (const worker of this.workers.values()) {
      const workerStatuses = worker.getAllJobStatuses();
      Object.assign(allStatuses, workerStatuses);
    }
    
    return allStatuses;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    for (const worker of this.workers.values()) {
      const cancelled = await worker.cancelJob(jobId);
      if (cancelled) {
        this.emit('jobCancelled', { jobId });
        return true;
      }
    }
    return false;
  }

  /**
   * Get service statistics
   */
  getStats(): WorkerServiceStats {
    const workerStats = Array.from(this.workers.entries()).map(([id, worker]) => ({
      id,
      isRunning: worker.getStats().isRunning,
      stats: worker.getStats(),
    }));

    const totalActiveJobs = workerStats.reduce((sum, w) => sum + w.stats.activeJobs, 0);
    const totalQueuedJobs = workerStats.reduce((sum, w) => sum + w.stats.queuedJobs, 0);
    const totalJobs = workerStats.reduce((sum, w) => sum + w.stats.totalJobs, 0);
    const activeWorkers = workerStats.filter(w => w.isRunning).length;

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      totalActiveJobs,
      totalQueuedJobs,
      totalJobs,
      isHealthy: activeWorkers > 0 && activeWorkers === this.workers.size,
      workers: workerStats,
    };
  }

  /**
   * Restart a specific worker
   */
  async restartWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    console.log(`🔄 [NewsletterWorkerService] Restarting worker ${workerId}...`);
    
    await worker.stop();
    this.workers.delete(workerId);
    
    // Create new worker with same ID
    const newWorker = this.createWorker(parseInt(workerId.split('-')[1]));
    
    console.log(`✅ [NewsletterWorkerService] Worker ${workerId} restarted`);
    this.emit('workerRestarted', { workerId });
  }

  /**
   * Scale the number of workers
   */
  async scaleWorkers(newCount: number): Promise<void> {
    if (newCount < 1) {
      throw new Error('Must have at least 1 worker');
    }

    const currentCount = this.workers.size;
    
    if (newCount === currentCount) {
      return;
    }

    console.log(`📈 [NewsletterWorkerService] Scaling from ${currentCount} to ${newCount} workers`);

    if (newCount > currentCount) {
      // Add workers
      for (let i = currentCount; i < newCount; i++) {
        this.createWorker(i);
      }
    } else {
      // Remove workers
      const workersToRemove = Array.from(this.workers.keys()).slice(newCount);
      
      for (const workerId of workersToRemove) {
        const worker = this.workers.get(workerId);
        if (worker) {
          await worker.stop();
          this.workers.delete(workerId);
        }
      }
    }

    this.config.numberOfWorkers = newCount;
    
    console.log(`✅ [NewsletterWorkerService] Scaled to ${newCount} workers`);
    this.emit('scaled', { newCount, previousCount: currentCount });
  }

  /**
   * Get the next available worker using round-robin
   */
  private getNextWorker(): NewsletterWorker | null {
    if (this.workers.size === 0) {
      return null;
    }

    const workerIds = Array.from(this.workers.keys());
    const workerId = workerIds[this.roundRobinIndex % workerIds.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % workerIds.length;

    return this.workers.get(workerId) || null;
  }

  /**
   * Create a new worker
   */
  private createWorker(index: number): NewsletterWorker {
    const workerId = `worker-${index}`;
    const worker = new NewsletterWorker(this.config.workerConfig);

    // Forward worker events
    worker.on('jobQueued', (data) => this.emit('jobQueued', { ...data, workerId }));
    worker.on('jobStarted', (data) => this.emit('jobStarted', { ...data, workerId }));
    worker.on('jobCompleted', (data) => this.emit('jobCompleted', { ...data, workerId }));
    worker.on('jobFailed', (data) => this.emit('jobFailed', { ...data, workerId }));
    worker.on('jobCancelled', (data) => this.emit('jobCancelled', { ...data, workerId }));
    worker.on('progressUpdate', (data) => this.emit('progressUpdate', { ...data, workerId }));
    worker.on('healthCheck', (data) => this.emit('workerHealthCheck', { ...data, workerId }));

    this.workers.set(workerId, worker);
    worker.start();

    console.log(`👷 [NewsletterWorkerService] Worker ${workerId} created and started`);
    
    return worker;
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Perform service health check
   */
  private performHealthCheck(): void {
    const stats = this.getStats();
    
    this.emit('healthCheck', stats);
    
    if (!stats.isHealthy) {
      console.warn('⚠️ [NewsletterWorkerService] Service health check failed:', {
        activeWorkers: stats.activeWorkers,
        totalWorkers: stats.totalWorkers,
      });
    }

    // Check individual worker health
    for (const [workerId, worker] of this.workers) {
      const workerStats = worker.getStats();
      if (!workerStats.isRunning) {
        console.warn(`⚠️ [NewsletterWorkerService] Worker ${workerId} is not running`);
        // Optionally restart the worker
        this.restartWorker(workerId).catch(error => {
          console.error(`❌ [NewsletterWorkerService] Failed to restart worker ${workerId}:`, error);
        });
      }
    }
  }

  /**
   * Perform cleanup of old jobs
   */
  private performCleanup(): void {
    let totalCleaned = 0;

    for (const worker of this.workers.values()) {
      const cleaned = worker.cleanupOldJobs(this.config.maxJobAge);
      totalCleaned += cleaned;
    }

    if (totalCleaned > 0) {
      console.log(`🧹 [NewsletterWorkerService] Cleaned up ${totalCleaned} old jobs across all workers`);
      this.emit('cleanup', { cleanedJobs: totalCleaned });
    }
  }

  /**
   * Get detailed worker information
   */
  getWorkerDetails(): Array<{
    id: string;
    isRunning: boolean;
    stats: ReturnType<NewsletterWorker['getStats']>;
    jobStatuses: Record<string, JobProgress>;
  }> {
    return Array.from(this.workers.entries()).map(([id, worker]) => ({
      id,
      isRunning: worker.getStats().isRunning,
      stats: worker.getStats(),
      jobStatuses: worker.getAllJobStatuses(),
    }));
  }

  /**
   * Emergency stop all jobs
   */
  async emergencyStop(): Promise<void> {
    console.log('🚨 [NewsletterWorkerService] Emergency stop initiated');
    
    const allJobs = this.getAllJobStatuses();
    const activeJobIds = Object.keys(allJobs).filter(
      jobId => allJobs[jobId].status === 'processing' || allJobs[jobId].status === 'pending'
    );

    // Cancel all active jobs
    const cancelPromises = activeJobIds.map(jobId => this.cancelJob(jobId));
    await Promise.all(cancelPromises);

    console.log(`🚨 [NewsletterWorkerService] Emergency stop complete: ${activeJobIds.length} jobs cancelled`);
    this.emit('emergencyStop', { cancelledJobs: activeJobIds.length });
  }
}

// Create and export a singleton instance
export const newsletterWorkerService = new NewsletterWorkerService({
  numberOfWorkers: parseInt(process.env.NEWSLETTER_WORKERS || '3'),
  workerConfig: {
    maxConcurrentJobs: parseInt(process.env.NEWSLETTER_MAX_CONCURRENT_JOBS || '2'),
    batchSize: parseInt(process.env.NEWSLETTER_BATCH_SIZE || '25'),
    delayBetweenBatches: parseInt(process.env.NEWSLETTER_BATCH_DELAY || '2000'),
    maxRetries: parseInt(process.env.NEWSLETTER_MAX_RETRIES || '3'),
  },
  autoStart: process.env.NODE_ENV !== 'test',
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📞 [NewsletterWorkerService] Received SIGTERM, shutting down gracefully...');
  await newsletterWorkerService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📞 [NewsletterWorkerService] Received SIGINT, shutting down gracefully...');
  await newsletterWorkerService.stop();
  process.exit(0);
});

export default newsletterWorkerService;

