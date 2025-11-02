import { EmailQueue, EmailMessage, QueuedEmail, QueueStatus } from './types';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { scheduledEmails } from '../../shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

export class InMemoryEmailQueue implements EmailQueue {
  private queue: Map<string, QueuedEmail> = new Map();
  private processing: Set<string> = new Set();
  private retryTimer: NodeJS.Timeout | null = null;
  private dbInitialized: boolean = false;

  // Initialize and load scheduled emails from database
  async initialize(): Promise<void> {
    if (this.dbInitialized) {
      console.log('[EmailQueue] Already initialized');
      return;
    }

    try {
      console.log('[EmailQueue] Loading scheduled emails from database...');
      
      // Load all pending and retrying emails from the database
      const dbEmails = await db.select().from(scheduledEmails).where(
        sql`${scheduledEmails.status} IN ('pending', 'retrying')`
      );

      let loadedCount = 0;
      for (const dbEmail of dbEmails) {
        try {
          const metadata = dbEmail.metadata ? JSON.parse(dbEmail.metadata) : {};
          const to = dbEmail.to ? JSON.parse(dbEmail.to) : [];
          
          const queuedEmail: QueuedEmail = {
            id: dbEmail.id,
            message: {
              to,
              from: metadata.from || '',
              subject: dbEmail.subject,
              html: dbEmail.html || '',
              text: dbEmail.text || undefined,
              metadata,
            },
            providerId: dbEmail.providerId || undefined,
            status: dbEmail.status as any,
            attemptCount: dbEmail.attemptCount || 0,
            createdAt: dbEmail.createdAt || new Date(),
            lastAttemptAt: dbEmail.lastAttemptAt || undefined,
            nextRetryAt: dbEmail.nextRetryAt || undefined,
            error: dbEmail.error || undefined,
          };

          this.queue.set(queuedEmail.id, queuedEmail);
          loadedCount++;
        } catch (error) {
          console.error(`[EmailQueue] Failed to load email ${dbEmail.id}:`, error);
        }
      }

      console.log(`[EmailQueue] Loaded ${loadedCount} scheduled emails from database`);
      this.dbInitialized = true;

      // Schedule processing for any due emails
      if (loadedCount > 0) {
        this.scheduleRetryProcessing();
      }
    } catch (error) {
      console.error('[EmailQueue] Failed to initialize from database:', error);
      // Continue anyway - the queue can still work with in-memory only
      this.dbInitialized = true;
    }
  }

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

  // Return a snapshot of all emails currently in the queue
  getAllEmails() {
    return Array.from(this.queue.values());
  }

  // Remove an email from the queue
  remove(emailId: string): boolean {
    const existed = this.queue.delete(emailId);
    if (existed) {
      this.processing.delete(emailId);
      console.log(`[EmailQueue] Removed queued email ${emailId}`);
      // Also remove from database
      this.removeFromDatabase(emailId).catch(err => 
        console.error(`[EmailQueue] Failed to remove from DB:`, err)
      );
    }
    return existed;
  }

  // Remove a scheduled email from the database
  private async removeFromDatabase(emailId: string): Promise<void> {
    try {
      await db.delete(scheduledEmails).where(eq(scheduledEmails.id, emailId));
      console.log(`[EmailQueue] Removed scheduled email ${emailId} from database`);
    } catch (error) {
      console.error(`[EmailQueue] Failed to remove scheduled email ${emailId} from database:`, error);
    }
  }

  // Update queued email message or schedule time
  update(emailId: string, updates: { message?: Partial<EmailMessage>; nextRetryAt?: Date }): boolean {
    const item = this.queue.get(emailId);
    if (!item) return false;
    if (updates.message) {
      item.message = { ...item.message, ...updates.message } as any;
    }
    if (updates.nextRetryAt) {
      item.nextRetryAt = updates.nextRetryAt;
      // Ensure it's in a schedulable state
      if (item.status === 'pending' && updates.nextRetryAt > new Date()) {
        item.status = 'retrying';
      }
      this.scheduleRetryProcessing();
    }
    this.queue.set(emailId, item);
    console.log(`[EmailQueue] Updated queued email ${emailId}`);
    
    // Persist update to database
    this.persistScheduledEmail(item).catch(err => 
      console.error(`[EmailQueue] Failed to persist update to DB:`, err)
    );
    
    return true;
  }

  // Enqueue an email to be processed at or after a specific future time
  async enqueueAt(message: EmailMessage, runAt: Date, providerId?: string): Promise<string> {
    const id = nanoid();
    const queuedEmail: QueuedEmail = {
      id,
      message,
      providerId,
      status: 'retrying',
      attemptCount: 0,
      createdAt: new Date(),
      nextRetryAt: runAt,
    } as any;

    this.queue.set(id, queuedEmail);

    console.log(`[EmailQueue] Enqueued (scheduled) email ${id}`, {
      to: message.to,
      subject: message.subject,
      providerId,
      runAt: runAt.toISOString(),
    });

    // Persist to database for scheduled emails
    await this.persistScheduledEmail(queuedEmail);

    // Ensure retry processing is scheduled to pick it up when due
    this.scheduleRetryProcessing();

    return id;
  }

  // Persist a scheduled email to the database
  private async persistScheduledEmail(queuedEmail: QueuedEmail): Promise<void> {
    try {
      const metadata = queuedEmail.message.metadata || {};
      const tenantId = metadata.tenantId;
      const contactId = metadata.contactId || metadata.recipientId;

      if (!tenantId) {
        console.warn(`[EmailQueue] Cannot persist scheduled email ${queuedEmail.id}: missing tenantId`);
        return;
      }

      await db.insert(scheduledEmails).values({
        id: queuedEmail.id,
        tenantId: tenantId,
        contactId: contactId || null,
        to: JSON.stringify(queuedEmail.message.to),
        subject: queuedEmail.message.subject,
        html: queuedEmail.message.html || null,
        text: queuedEmail.message.text || null,
        scheduledAt: queuedEmail.nextRetryAt || queuedEmail.createdAt,
        status: queuedEmail.status,
        providerId: queuedEmail.providerId || null,
        attemptCount: queuedEmail.attemptCount,
        lastAttemptAt: queuedEmail.lastAttemptAt || null,
        nextRetryAt: queuedEmail.nextRetryAt || null,
        error: queuedEmail.error || null,
        metadata: JSON.stringify(metadata),
        createdAt: queuedEmail.createdAt,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: scheduledEmails.id,
        set: {
          status: queuedEmail.status,
          attemptCount: queuedEmail.attemptCount,
          lastAttemptAt: queuedEmail.lastAttemptAt || null,
          nextRetryAt: queuedEmail.nextRetryAt || null,
          error: queuedEmail.error || null,
          updatedAt: new Date(),
        },
      });

      console.log(`[EmailQueue] Persisted scheduled email ${queuedEmail.id} to database`);
    } catch (error) {
      console.error(`[EmailQueue] Failed to persist scheduled email ${queuedEmail.id}:`, error);
    }
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
      // Update database and then remove it
      this.removeFromDatabase(emailId).catch(err => 
        console.error(`[EmailQueue] Failed to remove sent email from DB:`, err)
      );
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