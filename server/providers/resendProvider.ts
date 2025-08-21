import { Resend } from 'resend';
import { EmailProvider, EmailMessage, EmailSendResult, ProviderConfig, RateLimiter } from './types';
import { TokenBucketRateLimiter } from './rateLimiter';

export class ResendProvider extends EmailProvider {
  private client: Resend;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new Resend(config.credentials.apiKey || 'dummy-key-for-development');
  }

  protected createRateLimiter(): RateLimiter {
    const rateLimit = this.config.rateLimit || { requestsPerSecond: 2 };
    return new TokenBucketRateLimiter(
      rateLimit.requestsPerSecond,
      rateLimit.burstSize || rateLimit.requestsPerSecond
    );
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const startTime = Date.now();
    let attemptCount = 0;
    const maxRetries = this.config.retryPolicy?.maxRetries || 5;

    while (attemptCount <= maxRetries) {
      attemptCount++;

      try {
        // Check rate limiting
        if (!this.rateLimiter.canSend()) {
          const nextAvailable = this.rateLimiter.getNextAvailableTime();
          const waitTime = nextAvailable.getTime() - Date.now();
          
          if (waitTime > 0) {
            console.log(`[ResendProvider] Rate limit reached, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        // Record the send attempt for rate limiting
        this.rateLimiter.recordSend();

        // Prepare the email payload
        const emailPayload = {
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          ...(message.text && { text: message.text }),
          ...(message.attachments && { 
            attachments: message.attachments.map(att => ({
              filename: att.filename,
              content: att.content,
              content_type: att.contentType
            }))
          })
        };

        console.log(`[ResendProvider] Sending email attempt ${attemptCount}/${maxRetries + 1}`, {
          to: message.to,
          subject: message.subject,
          providerId: this.config.id
        });

        // Send the email
        const result = await this.client.emails.send(emailPayload);

        if (result.error) {
          throw new Error(`Resend API error: ${result.error.name} - ${result.error.message}`);
        }

        console.log(`[ResendProvider] Email sent successfully`, {
          messageId: result.data?.id,
          to: message.to,
          attemptCount,
          duration: Date.now() - startTime
        });

        return {
          success: true,
          messageId: result.data?.id,
          providerId: this.config.id,
          timestamp: new Date(),
          retryCount: attemptCount - 1
        };

      } catch (error: any) {
        console.error(`[ResendProvider] Attempt ${attemptCount} failed:`, {
          error: error.message,
          code: error.code,
          status: error.status,
          to: message.to
        });

        // Handle specific error codes
        if (this.isRateLimitError(error)) {
          console.log(`[ResendProvider] Rate limit error (429) detected, applying retry logic`);
          
          if (attemptCount <= maxRetries) {
            const retryInfo = this.calculateRetryDelay(attemptCount);
            const waitTime = retryInfo.nextRetryAt.getTime() - Date.now();
            
            console.log(`[ResendProvider] Retrying in ${waitTime}ms (attempt ${attemptCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }

        // For non-rate-limit errors, check if we should retry
        if (this.isRetriableError(error) && attemptCount <= maxRetries) {
          const retryInfo = this.calculateRetryDelay(attemptCount);
          const waitTime = retryInfo.nextRetryAt.getTime() - Date.now();
          
          console.log(`[ResendProvider] Retriable error, retrying in ${waitTime}ms (attempt ${attemptCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // If we've exhausted retries or it's a non-retriable error
        if (attemptCount > maxRetries) {
          // Check if we should schedule an hourly retry
          const retryPolicy = this.config.retryPolicy;
          if (retryPolicy?.retryAfterExhaustionMs) {
            return {
              success: false,
              providerId: this.config.id,
              timestamp: new Date(),
              error: `Failed after ${maxRetries} retries: ${error.message}. Will retry in ${retryPolicy.retryAfterExhaustionMs / 1000 / 60} minutes.`,
              retryCount: attemptCount - 1,
              nextRetryAt: new Date(Date.now() + retryPolicy.retryAfterExhaustionMs)
            };
          }
        }

        return {
          success: false,
          providerId: this.config.id,
          timestamp: new Date(),
          error: `Failed after ${attemptCount - 1} retries: ${error.message}`,
          retryCount: attemptCount - 1
        };
      }
    }

    // Should never reach here, but just in case
    return {
      success: false,
      providerId: this.config.id,
      timestamp: new Date(),
      error: `Unexpected end of retry loop`,
      retryCount: attemptCount - 1
    };
  }

  private isRateLimitError(error: any): boolean {
    return error.status === 429 || 
           error.code === 'too_many_requests' ||
           (error.message && error.message.toLowerCase().includes('rate limit'));
  }

  private isRetriableError(error: any): boolean {
    // Rate limit errors are always retriable
    if (this.isRateLimitError(error)) {
      return true;
    }

    // Network errors are retriable
    if (error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }

    // Server errors (5xx) are retriable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Specific Resend errors that might be temporary
    if (error.message && (
        error.message.includes('service unavailable') ||
        error.message.includes('internal server error') ||
        error.message.includes('timeout')
    )) {
      return true;
    }

    return false;
  }

  // Override the retry delay calculation to handle 429 errors specifically
  protected calculateRetryDelay(attemptNumber: number): { attemptNumber: number; nextRetryAt: Date; isExhausted: boolean } {
    const retryPolicy = this.config.retryPolicy;
    if (!retryPolicy) {
      return {
        attemptNumber,
        nextRetryAt: new Date(Date.now() + 5000), // Default 5-second delay for 429
        isExhausted: attemptNumber >= 5
      };
    }

    if (attemptNumber >= retryPolicy.maxRetries) {
      // If retryAfterExhaustionMs is set (hourly retry), schedule retry after that time
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

    // For rate limit errors (429), use a fixed 5-second delay as requested
    const delay = retryPolicy.initialDelayMs || 5000;

    return {
      attemptNumber,
      nextRetryAt: new Date(Date.now() + delay),
      isExhausted: false
    };
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      // Resend doesn't have a dedicated health check endpoint,
      // so we'll try to validate the API key by attempting to send a test email
      // to a non-existent domain (which should fail gracefully)
      return true; // For now, just return true if we can instantiate the client
    } catch (error) {
      console.error(`[ResendProvider] Health check failed:`, error);
      return false;
    }
  }

  // Get provider status and metrics
  getStatus() {
    const rateLimiterStatus = (this.rateLimiter as any).getStatus?.() || {};
    
    return {
      providerId: this.config.id,
      name: this.config.name,
      enabled: this.config.enabled,
      priority: this.config.priority,
      rateLimiter: rateLimiterStatus,
      canSendNow: this.canSendNow(),
      nextAvailableTime: this.getNextAvailableTime(),
      config: {
        rateLimit: this.config.rateLimit,
        retryPolicy: this.config.retryPolicy
      }
    };
  }
}