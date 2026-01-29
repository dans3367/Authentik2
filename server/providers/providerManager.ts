import { EmailProvider, EmailMessage, EmailSendResult, ProviderConfig } from './types';
import { InMemoryEmailQueue } from './emailQueue';
import { ResendProvider } from './resendProvider';

export class EmailProviderManager {
  private providers: Map<string, EmailProvider> = new Map();
  private queue: InMemoryEmailQueue;

  constructor() {
    this.queue = new InMemoryEmailQueue();
    this.initializeQueue();
  }

  // Initialize the queue by loading scheduled emails from database
  private async initializeQueue(): Promise<void> {
    try {
      await this.queue.initialize();
      console.log('[ProviderManager] Queue initialized successfully');
    } catch (error) {
      console.error('[ProviderManager] Failed to initialize queue:', error);
    }
  }

  // Register a provider
  registerProvider(config: ProviderConfig): void {
    let provider: EmailProvider;

    switch (config.name.toLowerCase()) {
      case 'resend':
        provider = new ResendProvider(config);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.name}`);
    }

    this.providers.set(config.id, provider);
    console.log(`[ProviderManager] Registered provider: ${config.name} (${config.id})`);
  }

  // Remove a provider
  unregisterProvider(providerId: string): void {
    if (this.providers.delete(providerId)) {
      console.log(`[ProviderManager] Unregistered provider: ${providerId}`);
    }
  }

  // Get all providers sorted by priority
  getProviders(): EmailProvider[] {
    return Array.from(this.providers.values())
      .filter(provider => provider.isEnabled())
      .sort((a, b) => a.getPriority() - b.getPriority());
  }

  // Get a specific provider
  getProvider(providerId: string): EmailProvider | undefined {
    return this.providers.get(providerId);
  }

  // Send email using the best available provider
  async sendEmail(message: EmailMessage, preferredProviderId?: string): Promise<EmailSendResult> {
    console.log(`[ProviderManager] Sending email`, {
      to: message.to,
      subject: message.subject,
      preferredProvider: preferredProviderId
    });

    // If a specific provider is requested, try it first
    if (preferredProviderId) {
      const provider = this.providers.get(preferredProviderId);
      if (provider && provider.isEnabled()) {
        try {
          const result = await this.attemptSend(provider, message);
          if (result.success) {
            return result;
          }
          console.log(`[ProviderManager] Preferred provider failed, trying others`);
        } catch (error) {
          console.error(`[ProviderManager] Preferred provider error:`, error);
        }
      } else {
        console.warn(`[ProviderManager] Preferred provider ${preferredProviderId} not available`);
      }
    }

    // Try providers in priority order
    const providers = this.getProviders();
    
    if (providers.length === 0) {
      return {
        success: false,
        providerId: 'none',
        timestamp: new Date(),
        error: 'No email providers available'
      };
    }

    let lastError = '';
    
    for (const provider of providers) {
      try {
        console.log(`[ProviderManager] Trying provider: ${provider.getName()} (${provider.getId()})`);
        
        const result = await this.attemptSend(provider, message);
        if (result.success) {
          console.log(`[ProviderManager] Email sent successfully via ${provider.getName()}`);
          return result;
        }
        
        lastError = result.error || 'Unknown error';
        console.log(`[ProviderManager] Provider ${provider.getName()} failed: ${lastError}`);
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ProviderManager] Provider ${provider.getName()} error:`, error);
      }
    }

    return {
      success: false,
      providerId: 'failed',
      timestamp: new Date(),
      error: `All providers failed. Last error: ${lastError}`
    };
  }

  // Send email with queueing (for high-volume scenarios)
  async queueEmail(message: EmailMessage, preferredProviderId?: string): Promise<string> {
    return await this.queue.enqueue(message, preferredProviderId);
  }

  // Schedule email for a specific future time
  async queueEmailAt(message: EmailMessage, runAt: Date, preferredProviderId?: string): Promise<string> {
    return await this.queue.enqueueAt(message, runAt, preferredProviderId);
  }

  // Return snapshot of all queued emails
  getAllQueuedEmails() {
    return this.queue.getAllEmails();
  }

  // Remove a queued email by ID
  removeQueuedEmail(emailId: string): boolean {
    return this.queue.remove(emailId);
  }

  // Update a queued email message or schedule time
  updateQueuedEmail(emailId: string, updates: { message?: Partial<EmailMessage>; nextRetryAt?: Date }): boolean {
    return this.queue.update(emailId, updates);
  }

  // Attempt to send email with a specific provider
  private async attemptSend(provider: EmailProvider, message: EmailMessage): Promise<EmailSendResult> {
    // Check if provider can send now (rate limiting)
    if (!provider.canSendNow()) {
      const nextAvailable = provider.getNextAvailableTime();
      const waitTime = nextAvailable.getTime() - Date.now();
      
      if (waitTime > 5000) { // If we need to wait more than 5 seconds, skip this provider
        return {
          success: false,
          providerId: provider.getId(),
          timestamp: new Date(),
          error: `Rate limited, next available in ${Math.round(waitTime / 1000)}s`
        };
      }
      
      // Wait for a short time if the delay is reasonable
      console.log(`[ProviderManager] Waiting ${waitTime}ms for rate limit`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    return await provider.sendEmail(message);
  }

  // Stop and cleanup
  stop(): void {
    this.queue.stop();
    console.log('[ProviderManager] Stopped');
  }

  // Get manager status
  getStatus() {
    const providerStatuses = Array.from(this.providers.values()).map(provider => {
      if (typeof (provider as any).getStatus === 'function') {
        return (provider as any).getStatus();
      }
      return {
        providerId: provider.getId(),
        name: provider.getName(),
        enabled: provider.isEnabled(),
        priority: provider.getPriority(),
        canSendNow: provider.canSendNow()
      };
    });

    return {
      providers: providerStatuses,
      queue: this.queue.getStatistics(),
      queueStatus: this.queue.getQueueStatus()
    };
  }

  // Health check for all providers
  async healthCheck(): Promise<{ [providerId: string]: boolean }> {
    const results: { [providerId: string]: boolean } = {};
    
    for (const provider of Array.from(this.providers.values())) {
      try {
        if (typeof (provider as any).healthCheck === 'function') {
          results[provider.getId()] = await (provider as any).healthCheck();
        } else {
          results[provider.getId()] = provider.isEnabled();
        }
      } catch (error) {
        console.error(`[ProviderManager] Health check failed for ${provider.getId()}:`, error);
        results[provider.getId()] = false;
      }
    }
    
    return results;
  }

  // Get queue status
  getQueueStatus() {
    return this.queue.getQueueStatus();
  }

  // Get specific email status
  getEmailStatus(emailId: string) {
    return this.queue.getEmailStatus(emailId);
  }

  // Cleanup old emails
  cleanupOldEmails(olderThanHours: number = 24): void {
    this.queue.cleanup(olderThanHours);
  }
}