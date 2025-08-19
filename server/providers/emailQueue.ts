import { EmailQueue, EmailMessage, QueuedEmail, QueueStatus } from './types';
import { nanoid } from 'nanoid';

export class InMemoryEmailQueue implements EmailQueue {
  private queue: Map<string, QueuedEmail> = new Map();
  private processing: Set<string> = new Set();
  private retryTimer: NodeJS.Timeout | null = null;

  async enqueue(message: EmailMessage, providerId?: string): Promise<string> {
    const id = nanoid();
    const queuedEmail: QueuedEmail = {
      id,
      message,
      providerId,
      status: 'pending',
      attemptCount: 0,
      createdAt: new Date()
    };

    this.queue.set(id, queuedEmail);
    
    console.log(`[EmailQueue] Enqueued email ${id}`, {
      to: message.to,
      subject: message.subject,
      providerId
    });

    // Start processing if not already running
    this.scheduleProcessing();

    return id;
  }

  async processQueue(): Promise<void> {
    const pendingEmails = Array.from(this.queue.values())
      .filter(email => 
        email.status === 'pending' || 
        (email.status === 'retrying' && (!email.nextRetryAt || email.nextRetryAt <= new Date()))
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const email of pendingEmails) {
      if (this.processing.has(email.id)) {
        continue; // Skip if already processing
      }

      this.processing.add(email.id);
      email.status = 'processing';
      email.lastAttemptAt = new Date();

      try {
        // This would be called by the provider manager
        // For now, we'll just mark it as processed
        console.log(`[EmailQueue] Processing email ${email.id}`);
        
        // The actual sending will be handled by the provider manager
        // This is just the queue management
        
      } catch (error) {
        console.error(`[EmailQueue] Error processing email ${email.id}:`, error);
        email.status = 'failed';
        email.error = error instanceof Error ? error.message : 'Unknown error';
      } finally {
        this.processing.delete(email.id);
      }
    }

    // Schedule next processing cycle for retry emails
    this.scheduleRetryProcessing();
  }

  getQueueStatus(): QueueStatus {
    const emails = Array.from(this.queue.values());
    
    return {
      pending: emails.filter(e => e.status === 'pending').length,
      processing: emails.filter(e => e.status === 'processing').length,
      failed: emails.filter(e => e.status === 'failed').length,
      retrying: emails.filter(e => e.status === 'retrying').length
    };
  }

  // Get specific email status
  getEmailStatus(emailId: string): QueuedEmail | undefined {
    return this.queue.get(emailId);
  }

  // Mark email as sent
  markAsSent(emailId: string): void {
    const email = this.queue.get(emailId);
    if (email) {
      email.status = 'sent';
      console.log(`[EmailQueue] Email ${emailId} marked as sent`);
    }
  }

  // Mark email as failed and optionally schedule retry
  markAsFailed(emailId: string, error: string, nextRetryAt?: Date): void {
    const email = this.queue.get(emailId);
    if (email) {
      email.error = error;
      
      if (nextRetryAt && nextRetryAt > new Date()) {
        email.status = 'retrying';
        email.nextRetryAt = nextRetryAt;
        console.log(`[EmailQueue] Email ${emailId} scheduled for retry at ${nextRetryAt.toISOString()}`);
      } else {
        email.status = 'failed';
        console.log(`[EmailQueue] Email ${emailId} marked as failed: ${error}`);
      }
    }
  }

  // Remove old emails from queue (cleanup)
  cleanup(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, email] of Array.from(this.queue.entries())) {
      if (email.createdAt < cutoff && (email.status === 'sent' || email.status === 'failed')) {
        this.queue.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[EmailQueue] Cleaned up ${removedCount} old emails`);
    }
  }

  // Get all pending/retry emails for a specific provider
  getEmailsForProvider(providerId: string): QueuedEmail[] {
    return Array.from(this.queue.values())
      .filter(email => 
        email.providerId === providerId && 
        (email.status === 'pending' || 
         (email.status === 'retrying' && (!email.nextRetryAt || email.nextRetryAt <= new Date())))
      );
  }

  // Get all emails ready for processing (no specific provider)
  getReadyEmails(): QueuedEmail[] {
    return Array.from(this.queue.values())
      .filter(email => 
        email.status === 'pending' || 
        (email.status === 'retrying' && (!email.nextRetryAt || email.nextRetryAt <= new Date()))
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  private scheduleProcessing(): void {
    // Process immediately
    setImmediate(() => this.processQueue());
  }

  private scheduleRetryProcessing(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    // Find the next retry time
    const retryEmails = Array.from(this.queue.values())
      .filter(email => email.status === 'retrying' && email.nextRetryAt)
      .sort((a, b) => a.nextRetryAt!.getTime() - b.nextRetryAt!.getTime());

    if (retryEmails.length > 0) {
      const nextRetry = retryEmails[0].nextRetryAt!;
      const waitTime = Math.max(0, nextRetry.getTime() - Date.now());
      
      console.log(`[EmailQueue] Next retry scheduled in ${waitTime}ms`);
      
      this.retryTimer = setTimeout(() => {
        this.processQueue();
      }, waitTime);
    }
  }

  // Get queue statistics
  getStatistics(): {
    totalEmails: number;
    byStatus: Record<string, number>;
    averageProcessingTime: number;
    oldestPending: Date | null;
  } {
    const emails = Array.from(this.queue.values());
    const byStatus: Record<string, number> = {};
    let totalProcessingTime = 0;
    let processedEmails = 0;
    let oldestPending: Date | null = null;

    for (const email of emails) {
      byStatus[email.status] = (byStatus[email.status] || 0) + 1;

      if (email.status === 'sent' && email.lastAttemptAt) {
        totalProcessingTime += email.lastAttemptAt.getTime() - email.createdAt.getTime();
        processedEmails++;
      }

      if (email.status === 'pending' && (!oldestPending || email.createdAt < oldestPending)) {
        oldestPending = email.createdAt;
      }
    }

    return {
      totalEmails: emails.length,
      byStatus,
      averageProcessingTime: processedEmails > 0 ? totalProcessingTime / processedEmails : 0,
      oldestPending
    };
  }

  // Stop processing and clear timers
  stop(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    console.log('[EmailQueue] Stopped');
  }
}