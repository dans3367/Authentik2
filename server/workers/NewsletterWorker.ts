import { EventEmitter } from 'events';
import { db } from '../db';
import { newsletters, emailContacts, bouncedEmails } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { enhancedEmailService } from '../emailService';

export interface NewsletterJob {
  id: string;
  newsletterId: string;
  tenantId: string;
  userId: string;
  groupUUID: string;
  subject: string;
  content: string;
  recipients: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }>;
  metadata?: Record<string, any>;
  batchSize: number;
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  scheduledFor?: Date;
}

export interface JobProgress {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  progress: number; // 0-100
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  currentBatch?: number;
  totalBatches?: number;
  errors: Array<{
    email: string;
    error: string;
    timestamp: Date;
  }>;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionTime?: Date;
}

export interface WorkerConfig {
  maxConcurrentJobs: number;
  batchSize: number;
  delayBetweenBatches: number;
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  progressUpdateInterval: number;
}

export class NewsletterWorker extends EventEmitter {
  private isRunning = false;
  private jobs = new Map<string, NewsletterJob>();
  private jobProgress = new Map<string, JobProgress>();
  private activeJobs = new Set<string>();
  private processingQueue: string[] = [];
  private config: WorkerConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private progressUpdateTimer?: NodeJS.Timeout;

  constructor(config: Partial<WorkerConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs || 3,
      batchSize: config.batchSize || 25,
      delayBetweenBatches: config.delayBetweenBatches || 2000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      progressUpdateInterval: config.progressUpdateInterval || 5000,
    };

    console.log('📮 [NewsletterWorker] Initialized with config:', this.config);
  }

  /**
   * Start the worker
   * DISABLED: Newsletter processing is now handled by Trigger.dev
   */
  start(): void {
    console.log('🚫 [NewsletterWorker] Start called but DISABLED - newsletter processing handled by Trigger.dev');
    return;

    // Original code commented out - newsletter processing now handled by Trigger.dev
    /*
    if (this.isRunning) {
      console.log('⚠️ [NewsletterWorker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 [NewsletterWorker] Starting worker...');

    // Start health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Start progress update timer
    this.progressUpdateTimer = setInterval(() => {
      this.updateProgressEstimates();
    }, this.config.progressUpdateInterval);

    // Start processing queue
    this.processQueue();

    this.emit('started');
    console.log('✅ [NewsletterWorker] Worker started successfully');
    */
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    console.log('🛑 [NewsletterWorker] Stopping worker...');
    this.isRunning = false;

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.progressUpdateTimer) {
      clearInterval(this.progressUpdateTimer);
    }

    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < timeout) {
      console.log(`⏳ [NewsletterWorker] Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force cancel remaining jobs
    for (const jobId of this.activeJobs) {
      await this.cancelJob(jobId);
    }

    this.emit('stopped');
    console.log('✅ [NewsletterWorker] Worker stopped');
  }

  /**
   * Add a job to the queue
   */
  addJob(job: Omit<NewsletterJob, 'id' | 'createdAt'>): string {
    const jobId = `newsletter-${job.newsletterId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullJob: NewsletterJob = {
      ...job,
      id: jobId,
      createdAt: new Date(),
    };

    // Initialize job progress
    const progress: JobProgress = {
      jobId,
      total: job.recipients.length,
      sent: 0,
      failed: 0,
      progress: 0,
      status: 'pending',
      errors: [],
    };

    this.jobs.set(jobId, fullJob);
    this.jobProgress.set(jobId, progress);
    this.processingQueue.push(jobId);

    console.log(`📝 [NewsletterWorker] Job ${jobId} queued with ${job.recipients.length} recipients`);
    this.emit('jobQueued', { jobId, job: fullJob });

    // Sort queue by priority
    this.sortQueue();

    return jobId;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): JobProgress | null {
    return this.jobProgress.get(jobId) || null;
  }

  /**
   * Get all job statuses
   */
  getAllJobStatuses(): Record<string, JobProgress> {
    const statuses: Record<string, JobProgress> = {};
    for (const [jobId, progress] of this.jobProgress) {
      statuses[jobId] = progress;
    }
    return statuses;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const progress = this.jobProgress.get(jobId);
    if (!progress) {
      return false;
    }

    if (progress.status === 'completed' || progress.status === 'failed') {
      return false;
    }

    progress.status = 'cancelled';
    progress.completedAt = new Date();

    // Remove from active jobs
    this.activeJobs.delete(jobId);

    // Remove from queue if not started
    const queueIndex = this.processingQueue.indexOf(jobId);
    if (queueIndex > -1) {
      this.processingQueue.splice(queueIndex, 1);
    }

    console.log(`❌ [NewsletterWorker] Job ${jobId} cancelled`);
    this.emit('jobCancelled', { jobId, progress });

    return true;
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can process more jobs
        if (this.activeJobs.size < this.config.maxConcurrentJobs && this.processingQueue.length > 0) {
          const jobId = this.processingQueue.shift();
          if (jobId) {
            this.processJob(jobId);
          }
        }

        // Short delay before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('❌ [NewsletterWorker] Error in queue processing:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    const progress = this.jobProgress.get(jobId);

    if (!job || !progress) {
      console.error(`❌ [NewsletterWorker] Job ${jobId} not found`);
      return;
    }

    this.activeJobs.add(jobId);
    progress.status = 'processing';
    progress.startedAt = new Date();

    console.log(`📧 [NewsletterWorker] Starting job ${jobId} with ${job.recipients.length} recipients`);
    this.emit('jobStarted', { jobId, job, progress });

    try {
      // Check if job should be delayed
      if (job.scheduledFor && job.scheduledFor > new Date()) {
        const delay = job.scheduledFor.getTime() - Date.now();
        console.log(`⏰ [NewsletterWorker] Job ${jobId} scheduled for later, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Filter out bounced/suppressed emails
      const validRecipients = await this.filterValidRecipients(job.recipients, job.tenantId);
      console.log(`✅ [NewsletterWorker] Job ${jobId}: ${validRecipients.length}/${job.recipients.length} recipients after filtering`);

      // Update total count after filtering
      progress.total = validRecipients.length;

      // Process recipients in batches
      const batches = this.createBatches(validRecipients, job.batchSize);
      progress.totalBatches = batches.length;

      for (let i = 0; i < batches.length; i++) {
        if (progress.status === 'cancelled') {
          break;
        }

        progress.currentBatch = i + 1;
        await this.processBatch(job, batches[i], progress, i + 1, batches.length);

        // Add delay between batches (except for the last batch)
        if (i < batches.length - 1 && this.config.delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
        }
      }

      // Mark as completed
      if (progress.status !== 'cancelled') {
        progress.status = 'completed';
        progress.progress = 100;
        progress.completedAt = new Date();

        // Update newsletter status in database
        await this.updateNewsletterStatus(job.newsletterId, 'sent', {
          sentCount: progress.sent,
          failedCount: progress.failed,
          totalCount: progress.total,
        });
      }

      console.log(`✅ [NewsletterWorker] Job ${jobId} completed: ${progress.sent} sent, ${progress.failed} failed`);
      this.emit('jobCompleted', { jobId, job, progress });

    } catch (error) {
      console.error(`❌ [NewsletterWorker] Job ${jobId} failed:`, error);
      progress.status = 'failed';
      progress.completedAt = new Date();
      progress.errors.push({
        email: 'system',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      this.emit('jobFailed', { jobId, job, progress, error });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Filter out invalid recipients (bounced, unsubscribed, etc.)
   */
  private async filterValidRecipients(
    recipients: NewsletterJob['recipients'],
    tenantId: string
  ): Promise<NewsletterJob['recipients']> {
    try {
      // Get list of suppressed emails
      const suppressedEmails = await db
        .select({ email: bouncedEmails.email })
        .from(bouncedEmails)
        .where(eq(bouncedEmails.isActive, true));

      const suppressedSet = new Set(suppressedEmails.map(item => item.email.toLowerCase()));

      // Filter out suppressed emails
      const validRecipients = recipients.filter(recipient => {
        const email = recipient.email.toLowerCase().trim();
        return !suppressedSet.has(email);
      });

      return validRecipients;
    } catch (error) {
      console.error('[NewsletterWorker] Error filtering recipients:', error);
      // Return all recipients if filtering fails
      return recipients;
    }
  }

  /**
   * Create batches from recipients
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of recipients
   */
  private async processBatch(
    job: NewsletterJob,
    batch: NewsletterJob['recipients'],
    progress: JobProgress,
    batchNumber: number,
    totalBatches: number
  ): Promise<void> {
    console.log(`📮 [NewsletterWorker] Processing batch ${batchNumber}/${totalBatches} with ${batch.length} recipients`);

    // Prepare emails for the batch
    const emails = batch.map(recipient => ({
      to: recipient.email,
      subject: job.subject,
      html: job.content,
      text: job.content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      metadata: {
        type: 'newsletter',
        newsletterId: job.newsletterId,
        groupUUID: job.groupUUID,
        recipientId: recipient.id,
        tenantId: job.tenantId,
        userId: job.userId,
        batchNumber,
        tags: [
          `newsletter-${job.newsletterId}`,
          `groupUUID-${job.groupUUID}`,
          `tenant-${job.tenantId}`,
        ],
      },
    }));

    try {
      // Send batch using enhanced email service
      const result = await enhancedEmailService.sendBatchEmails(emails, {
        batchSize: Math.min(batch.length, 10), // Sub-batch size for rate limiting
        delayBetweenBatches: 500,
      });

      // Update progress
      progress.sent += result.queued.length;
      progress.failed += result.errors.length;

      // Add errors to progress
      for (const error of result.errors) {
        progress.errors.push({
          email: error.email,
          error: error.error,
          timestamp: new Date(),
        });
      }

      // Update progress percentage
      progress.progress = Math.round((progress.sent + progress.failed) / progress.total * 100);

      console.log(`✅ [NewsletterWorker] Batch ${batchNumber} complete: ${result.queued.length} sent, ${result.errors.length} failed`);

    } catch (error) {
      console.error(`❌ [NewsletterWorker] Batch ${batchNumber} failed:`, error);
      
      // Mark all emails in batch as failed
      progress.failed += batch.length;
      for (const recipient of batch) {
        progress.errors.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : 'Batch processing failed',
          timestamp: new Date(),
        });
      }
    }

    // Emit progress update
    this.emit('progressUpdate', { jobId: job.id, progress });
  }

  /**
   * Update newsletter status in database
   */
  private async updateNewsletterStatus(
    newsletterId: string,
    status: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await db
        .update(newsletters)
        .set({
          status: status as any,
          recipientCount: metadata.sentCount || 0,
          updatedAt: new Date(),
        })
        .where(eq(newsletters.id, newsletterId));

      console.log(`📊 [NewsletterWorker] Newsletter ${newsletterId} status updated to ${status}`);
    } catch (error) {
      console.error(`❌ [NewsletterWorker] Failed to update newsletter status:`, error);
    }
  }

  /**
   * Sort queue by priority and creation time
   */
  private sortQueue(): void {
    this.processingQueue.sort((a, b) => {
      const jobA = this.jobs.get(a);
      const jobB = this.jobs.get(b);
      
      if (!jobA || !jobB) return 0;

      // First sort by priority
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[jobB.priority] - priorityOrder[jobA.priority];
      
      if (priorityDiff !== 0) return priorityDiff;

      // Then by creation time (older first)
      return jobA.createdAt.getTime() - jobB.createdAt.getTime();
    });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const emailHealth = await enhancedEmailService.healthCheck();
      
      const workerStats = {
        isRunning: this.isRunning,
        activeJobs: this.activeJobs.size,
        queuedJobs: this.processingQueue.length,
        totalJobs: this.jobs.size,
        emailServiceHealth: emailHealth,
      };

      this.emit('healthCheck', workerStats);
      
      if (!emailHealth.healthy) {
        console.warn('⚠️ [NewsletterWorker] Email service health check failed:', emailHealth);
      }
    } catch (error) {
      console.error('❌ [NewsletterWorker] Health check failed:', error);
    }
  }

  /**
   * Update progress estimates for active jobs
   */
  private updateProgressEstimates(): void {
    for (const [jobId, progress] of this.jobProgress) {
      if (progress.status === 'processing' && progress.startedAt) {
        const elapsed = Date.now() - progress.startedAt.getTime();
        const processed = progress.sent + progress.failed;
        
        if (processed > 0) {
          const avgTimePerEmail = elapsed / processed;
          const remaining = progress.total - processed;
          const estimatedRemainingTime = remaining * avgTimePerEmail;
          
          progress.estimatedCompletionTime = new Date(Date.now() + estimatedRemainingTime);
        }
      }
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    isRunning: boolean;
    activeJobs: number;
    queuedJobs: number;
    totalJobs: number;
    config: WorkerConfig;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      queuedJobs: this.processingQueue.length,
      totalJobs: this.jobs.size,
      config: this.config,
    };
  }

  /**
   * Clean up old jobs (call periodically)
   */
  cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [jobId, job] of this.jobs) {
      if (job.createdAt.getTime() < cutoff) {
        const progress = this.jobProgress.get(jobId);
        if (progress && (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled')) {
          this.jobs.delete(jobId);
          this.jobProgress.delete(jobId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [NewsletterWorker] Cleaned up ${cleaned} old jobs`);
    }

    return cleaned;
  }
}
