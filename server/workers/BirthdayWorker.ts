import { EventEmitter } from 'events';
import { db } from '../db';
import { emailContacts, birthdaySettings, promotions } from '@shared/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import { enhancedEmailService } from '../emailService';

export interface BirthdayJob {
  id: string;
  contactId: string;
  contactEmail: string;
  contactFirstName?: string;
  contactLastName?: string;
  tenantId: string;
  tenantName?: string;
  birthdayDate: string;
  settings: {
    emailTemplate: string;
    customMessage?: string;
    customThemeData?: string;
    senderName?: string;
    promotionId?: string;
  };
  promotionData?: {
    id: string;
    title: string;
    content: string;
    type: string;
  };
  createdAt: Date;
}

export interface BirthdayJobProgress {
  jobId: string;
  contactId: string;
  contactEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  sentAt?: Date;
  messageId?: string;
  provider?: string;
}

export interface BirthdayWorkerConfig {
  checkInterval: number; // How often to check for birthdays (in milliseconds)
  batchSize: number; // How many birthday cards to process at once
  maxRetries: number;
  retryDelay: number;
  enabled: boolean;
}

export class BirthdayWorker extends EventEmitter {
  private isRunning = false;
  private jobs = new Map<string, BirthdayJob>();
  private jobProgress = new Map<string, BirthdayJobProgress>();
  private config: BirthdayWorkerConfig;
  private checkTimer?: NodeJS.Timeout;

  constructor(config: Partial<BirthdayWorkerConfig> = {}) {
    super();
    this.config = {
      checkInterval: config.checkInterval || 60 * 60 * 1000, // Check every hour
      batchSize: config.batchSize || 10,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      enabled: config.enabled !== false,
    };
  }

  start(): void {
    if (this.isRunning) {
      console.log('🎂 [BirthdayWorker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('🎂 [BirthdayWorker] Starting birthday automation worker');

    if (this.config.enabled) {
      // Start the periodic birthday check
      this.scheduleNextCheck();
      
      // Run an initial check
      this.checkForBirthdays();
    } else {
      console.log('🎂 [BirthdayWorker] Worker started but disabled in config');
    }

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🎂 [BirthdayWorker] Stopping birthday worker...');
    this.isRunning = false;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = undefined;
    }

    // Wait for any active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.getActiveJobCount() > 0 && (Date.now() - startTime) < timeout) {
      console.log(`⏳ [BirthdayWorker] Waiting for ${this.getActiveJobCount()} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('🎂 [BirthdayWorker] Stopped');
    this.emit('stopped');
  }

  private scheduleNextCheck(): void {
    if (!this.isRunning || !this.config.enabled) {
      return;
    }

    this.checkTimer = setTimeout(() => {
      this.checkForBirthdays();
      this.scheduleNextCheck();
    }, this.config.checkInterval);
  }

  private async checkForBirthdays(): Promise<void> {
    if (!this.isRunning || !this.config.enabled) {
      return;
    }

    try {
      console.log('🎂 [BirthdayWorker] Checking for birthdays...');

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      // Extract month and day for birthday matching (MM-DD format)
      const monthDay = todayString.substring(5); // Gets MM-DD part

      // Find contacts with birthdays today who have birthday emails enabled
      const birthdayContacts = await db
        .select({
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          birthday: emailContacts.birthday,
          tenantId: emailContacts.tenantId,
        })
        .from(emailContacts)
        .where(
          and(
            isNotNull(emailContacts.birthday),
            eq(emailContacts.birthdayEmailEnabled, true),
            eq(emailContacts.status, 'active'),
            // Match month and day (ignoring year)
            sql`SUBSTRING(${emailContacts.birthday}, 6) = ${monthDay}`
          )
        );

      if (birthdayContacts.length === 0) {
        console.log('🎂 [BirthdayWorker] No birthdays found for today');
        return;
      }

      console.log(`🎂 [BirthdayWorker] Found ${birthdayContacts.length} birthday(s) for today`);

      // Group contacts by tenant to get their settings
      const tenantGroups = new Map<string, typeof birthdayContacts>();
      for (const contact of birthdayContacts) {
        if (!tenantGroups.has(contact.tenantId)) {
          tenantGroups.set(contact.tenantId, []);
        }
        tenantGroups.get(contact.tenantId)!.push(contact);
      }

      // Process each tenant group
      for (const [tenantId, contacts] of Array.from(tenantGroups.entries())) {
        await this.processTenantBirthdays(tenantId, contacts);
      }

    } catch (error) {
      console.error('🎂 [BirthdayWorker] Error checking for birthdays:', error);
      this.emit('error', error);
    }
  }

  private async processTenantBirthdays(tenantId: string, contacts: any[]): Promise<void> {
    try {
      // Get birthday settings for this tenant
      const settings = await db.query.birthdaySettings.findFirst({
        where: eq(birthdaySettings.tenantId, tenantId),
      });

      if (!settings || !settings.enabled) {
        console.log(`🎂 [BirthdayWorker] Birthday emails disabled for tenant ${tenantId}`);
        return;
      }

      // Get promotion data if specified
      let promotionData = null;
      if (settings.promotionId) {
        try {
          const promotion = await db.select().from(promotions).where(eq(promotions.id, settings.promotionId)).limit(1);
          promotionData = promotion.length > 0 ? promotion[0] : null;
          console.log(`🎁 [BirthdayWorker] Fetched promotion data for tenant ${tenantId}:`, promotionData ? 'Success' : 'Not found');
        } catch (promotionError) {
          console.warn(`🎁 [BirthdayWorker] Failed to fetch promotion data for tenant ${tenantId}:`, promotionError);
        }
      }

      // Create birthday jobs for each contact
      for (const contact of contacts) {
        const jobId = this.createBirthdayJob(contact, settings, promotionData);
        console.log(`🎂 [BirthdayWorker] Created birthday job ${jobId} for ${contact.email}`);
      }

      // Process jobs in batches
      await this.processJobs();

    } catch (error) {
      console.error(`🎂 [BirthdayWorker] Error processing tenant ${tenantId} birthdays:`, error);
    }
  }

  private createBirthdayJob(contact: any, settings: any, promotionData: any): string {
    const jobId = `birthday-${contact.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const job: BirthdayJob = {
      id: jobId,
      contactId: contact.id,
      contactEmail: contact.email,
      contactFirstName: contact.firstName,
      contactLastName: contact.lastName,
      tenantId: contact.tenantId,
      birthdayDate: contact.birthday,
      settings: {
        emailTemplate: settings.emailTemplate || 'default',
        customMessage: settings.customMessage || '',
        customThemeData: settings.customThemeData || null,
        senderName: settings.senderName || '',
        promotionId: settings.promotionId || null,
      },
      promotionData: promotionData ? {
        id: promotionData.id,
        title: promotionData.title,
        content: promotionData.content,
        type: promotionData.type,
      } : undefined,
      createdAt: new Date(),
    };

    const progress: BirthdayJobProgress = {
      jobId,
      contactId: contact.id,
      contactEmail: contact.email,
      status: 'pending',
    };

    this.jobs.set(jobId, job);
    this.jobProgress.set(jobId, progress);

    this.emit('jobCreated', { jobId, job });
    return jobId;
  }

  private async processJobs(): Promise<void> {
    const pendingJobs = Array.from(this.jobProgress.values())
      .filter(progress => progress.status === 'pending')
      .slice(0, this.config.batchSize);

    if (pendingJobs.length === 0) {
      return;
    }

    console.log(`🎂 [BirthdayWorker] Processing ${pendingJobs.length} birthday jobs`);

    const promises = pendingJobs.map(progress => this.processJob(progress.jobId));
    await Promise.allSettled(promises);
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    const progress = this.jobProgress.get(jobId);

    if (!job || !progress) {
      console.error(`🎂 [BirthdayWorker] Job ${jobId} not found`);
      return;
    }

    try {
      progress.status = 'processing';
      this.emit('jobStarted', { jobId, job });

      console.log(`🎂 [BirthdayWorker] Sending birthday card to ${job.contactEmail}`);

      // Prepare recipient name
      const recipientName = job.contactFirstName 
        ? `${job.contactFirstName}${job.contactLastName ? ` ${job.contactLastName}` : ''}` 
        : 'Friend';

      // Render birthday template with promotion content
      const htmlContent = this.renderBirthdayTemplate(job.settings.emailTemplate as any, {
        recipientName,
        message: job.settings.customMessage || 'Wishing you a wonderful birthday!',
        brandName: job.tenantName || 'Your Company',
        customThemeData: job.settings.customThemeData ? JSON.parse(job.settings.customThemeData) : null,
        senderName: job.settings.senderName || 'Your Team',
        promotionContent: job.promotionData?.content || undefined,
      });

      // Send the birthday email
      const result = await enhancedEmailService.send({
        to: job.contactEmail,
        from: 'admin@zendwise.work', // You might want to make this configurable
        subject: `🎉 Happy Birthday ${recipientName}!`,
        html: htmlContent,
        text: htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        tags: ['birthday', 'automated', `tenant-${job.tenantId}`],
        metadata: {
          type: 'birthday-card',
          contactId: job.contactId,
          tenantId: job.tenantId,
          birthdayDate: job.birthdayDate,
          promotionId: job.settings.promotionId,
          automated: true,
        },
      });

      if (result.success) {
        progress.status = 'completed';
        progress.sentAt = new Date();
        progress.messageId = result.messageId;
        progress.provider = result.provider;

        console.log(`✅ [BirthdayWorker] Birthday card sent successfully to ${job.contactEmail}: ${result.messageId}`);
        this.emit('jobCompleted', { jobId, job, result });

        // Update promotion usage count if promotion was used
        if (job.promotionData) {
          try {
            await db.update(promotions)
              .set({ usageCount: sql`${promotions.usageCount} + 1` })
              .where(eq(promotions.id, job.promotionData.id));
            console.log(`🎁 [BirthdayWorker] Updated promotion usage count for ${job.promotionData.id}`);
          } catch (promotionError) {
            console.warn(`🎁 [BirthdayWorker] Failed to update promotion usage:`, promotionError);
          }
        }
      } else {
        throw new Error(result.error || 'Failed to send birthday card');
      }

    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : String(error);

      console.error(`❌ [BirthdayWorker] Failed to send birthday card to ${job.contactEmail}:`, error);
      this.emit('jobFailed', { jobId, job, error });
    }
  }

  private renderBirthdayTemplate(
    template: 'default' | 'confetti' | 'balloons' | 'custom',
    params: { recipientName?: string; message?: string; brandName?: string; customThemeData?: any; senderName?: string; promotionContent?: string }
  ): string {
    // This is a simplified version - you might want to import the actual template renderer
    // from your existing birthday template system
    
    const themeColors = {
      default: { primary: '#667eea', secondary: '#764ba2' },
      confetti: { primary: '#ff6b6b', secondary: '#feca57' },
      balloons: { primary: '#54a0ff', secondary: '#5f27cd' }
    };

    const colors = themeColors[template as keyof typeof themeColors] || themeColors.default;
    const headline = `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
    const fromMessage = params.senderName || params.brandName || 'The Team';

    return `<html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
            <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${headline}</h1>
          </div>
          <div style="padding: 30px;">
            <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">${params.message || 'Wishing you a wonderful day!'}</div>
            ${params.promotionContent ? `<div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 8px; border-left: 4px solid ${colors.primary}; text-align: left;">${params.promotionContent}</div>` : ''}
          </div>
          <div style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 0.9rem; color: #718096;">
              <p style="margin: 0;">Best regards,</p>
              <p style="margin: 5px 0 0 0; font-weight: 600; color: #4a5568;">${fromMessage}</p>
            </div>
          </div>
        </div>
      </body>
    </html>`;
  }

  getJobStatus(jobId: string): BirthdayJobProgress | null {
    return this.jobProgress.get(jobId) || null;
  }

  getAllJobStatuses(): Record<string, BirthdayJobProgress> {
    const statuses: Record<string, BirthdayJobProgress> = {};
    for (const [jobId, progress] of Array.from(this.jobProgress.entries())) {
      statuses[jobId] = progress;
    }
    return statuses;
  }

  getActiveJobCount(): number {
    return Array.from(this.jobProgress.values())
      .filter(progress => progress.status === 'processing').length;
  }

  getStats() {
    const allJobs = Array.from(this.jobProgress.values());
    return {
      isRunning: this.isRunning,
      enabled: this.config.enabled,
      totalJobs: allJobs.length,
      pendingJobs: allJobs.filter(j => j.status === 'pending').length,
      processingJobs: allJobs.filter(j => j.status === 'processing').length,
      completedJobs: allJobs.filter(j => j.status === 'completed').length,
      failedJobs: allJobs.filter(j => j.status === 'failed').length,
      config: this.config,
    };
  }

  // Clean up old job data
  cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [jobId, job] of Array.from(this.jobs.entries())) {
      if (job.createdAt < cutoff) {
        this.jobs.delete(jobId);
        this.jobProgress.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [BirthdayWorker] Cleaned up ${cleaned} old birthday jobs`);
    }

    return cleaned;
  }
}