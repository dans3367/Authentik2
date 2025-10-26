// Types and interfaces for email providers

export interface EmailMessage {
  to: string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  providerId: string;
  timestamp: Date;
  error?: string;
  retryCount?: number;
  nextRetryAt?: Date;
}

export interface ProviderConfig {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  rateLimit?: {
    requestsPerSecond: number;
    burstSize?: number;
  };
  retryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryAfterExhaustionMs?: number; // Retry every X ms after all retries exhausted
  };
  credentials: Record<string, string>;
}

export interface RateLimiter {
  canSend(): boolean;
  recordSend(): void;
  getNextAvailableTime(): Date;
}

export interface RetryInfo {
  attemptNumber: number;
  nextRetryAt: Date;
  isExhausted: boolean;
}

export abstract class EmailProvider {
  protected config: ProviderConfig;
  protected rateLimiter: RateLimiter;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.rateLimiter = this.createRateLimiter();
  }

  abstract sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  
  protected abstract createRateLimiter(): RateLimiter;
  
  public getId(): string {
    return this.config.id;
  }

  public getName(): string {
    return this.config.name;
  }

  public getPriority(): number {
    return this.config.priority;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public canSendNow(): boolean {
    return this.rateLimiter.canSend();
  }

  public getNextAvailableTime(): Date {
    return this.rateLimiter.getNextAvailableTime();
  }

  protected calculateRetryDelay(attemptNumber: number): RetryInfo {
    const retryPolicy = this.config.retryPolicy;
    if (!retryPolicy) {
      return {
        attemptNumber,
        nextRetryAt: new Date(),
        isExhausted: true
      };
    }

    if (attemptNumber >= retryPolicy.maxRetries) {
      // If retryAfterExhaustionMs is set, schedule retry after that time
      if (retryPolicy.retryAfterExhaustionMs) {
        return {
          attemptNumber,
          nextRetryAt: new Date(Date.now() + retryPolicy.retryAfterExhaustionMs),
          isExhausted: false
        };
      }
      return {
        attemptNumber,
        nextRetryAt: new Date(),
        isExhausted: true
      };
    }

    // Calculate exponential backoff with jitter
    const baseDelay = retryPolicy.initialDelayMs * Math.pow(retryPolicy.backoffMultiplier, attemptNumber - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
    const delay = Math.min(baseDelay + jitter, retryPolicy.maxDelayMs);

    return {
      attemptNumber,
      nextRetryAt: new Date(Date.now() + delay),
      isExhausted: false
    };
  }
}

export interface EmailQueue {
  enqueue(message: EmailMessage, providerId?: string): Promise<string>;
  enqueueAt(message: EmailMessage, runAt: Date, providerId?: string): Promise<string>;
  processQueue(): Promise<void>;
  getQueueStatus(): QueueStatus;
  getAllEmails(): QueuedEmail[];
  remove(emailId: string): boolean;
  update(emailId: string, updates: { message?: Partial<EmailMessage>; nextRetryAt?: Date }): boolean;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
  retrying: number;
}

export interface QueuedEmail {
  id: string;
  message: EmailMessage;
  providerId?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'retrying';
  attemptCount: number;
  nextRetryAt?: Date;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}