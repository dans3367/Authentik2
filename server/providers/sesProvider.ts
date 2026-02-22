import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailProvider, EmailMessage, EmailSendResult, ProviderConfig, RateLimiter } from './types';
import { TokenBucketRateLimiter } from './rateLimiter';

export class SESProvider extends EmailProvider {
    private client: SESClient;

    constructor(config: ProviderConfig) {
        super(config);
        this.client = new SESClient({
            region: config.credentials.region || 'us-east-1',
            credentials: {
                accessKeyId: config.credentials.accessKeyId || '',
                secretAccessKey: config.credentials.secretAccessKey || '',
            },
        });
    }

    protected createRateLimiter(): RateLimiter {
        const rateLimit = this.config.rateLimit || { requestsPerSecond: 14 };
        return new TokenBucketRateLimiter(
            rateLimit.requestsPerSecond,
            rateLimit.burstSize || rateLimit.requestsPerSecond
        );
    }

    async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
        const startTime = Date.now();
        let attemptCount = 0;
        const maxRetries = this.config.retryPolicy?.maxRetries || 3;

        while (attemptCount <= maxRetries) {
            attemptCount++;

            try {
                // Check rate limiting
                if (!this.rateLimiter.canSend()) {
                    const nextAvailable = this.rateLimiter.getNextAvailableTime();
                    const waitTime = nextAvailable.getTime() - Date.now();

                    if (waitTime > 0) {
                        console.log(`[SESProvider] Rate limit reached, waiting ${waitTime}ms`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }

                // Record the send attempt
                this.rateLimiter.recordSend();

                // Build SES SendEmailCommand
                const command = new SendEmailCommand({
                    Source: message.from,
                    Destination: {
                        ToAddresses: message.to,
                    },
                    Message: {
                        Subject: { Data: message.subject, Charset: 'UTF-8' },
                        Body: {
                            ...(message.html ? { Html: { Data: message.html, Charset: 'UTF-8' } } : {}),
                            ...(message.text ? { Text: { Data: message.text, Charset: 'UTF-8' } } : {}),
                        },
                    },
                    ...(message.tags && message.tags.length > 0
                        ? {
                            Tags: message.tags.map(tag => ({
                                Name: tag.name,
                                Value: tag.value,
                            })),
                        }
                        : {}),
                    ...(process.env.AWS_SES_CONFIGURATION_SET
                        ? { ConfigurationSetName: process.env.AWS_SES_CONFIGURATION_SET }
                        : {}),
                });

                console.log(`[SESProvider] Sending email attempt ${attemptCount}/${maxRetries + 1}`, {
                    to: message.to,
                    subject: message.subject,
                    providerId: this.config.id,
                });

                const result = await this.client.send(command);

                console.log(`[SESProvider] Email sent successfully`, {
                    messageId: result.MessageId,
                    to: message.to,
                    attemptCount,
                    duration: Date.now() - startTime,
                });

                return {
                    success: true,
                    messageId: result.MessageId,
                    providerId: this.config.id,
                    timestamp: new Date(),
                    retryCount: attemptCount - 1,
                };
            } catch (error: any) {
                console.error(`[SESProvider] Attempt ${attemptCount} failed:`, {
                    error: error.message,
                    code: error.Code || error.name,
                    to: message.to,
                });

                if (this.isRetriableError(error) && attemptCount <= maxRetries) {
                    const retryInfo = this.calculateRetryDelay(attemptCount);
                    const waitTime = retryInfo.nextRetryAt.getTime() - Date.now();

                    console.log(`[SESProvider] Retriable error, retrying in ${waitTime}ms (attempt ${attemptCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                return {
                    success: false,
                    providerId: this.config.id,
                    timestamp: new Date(),
                    error: `Failed after ${attemptCount - 1} retries: ${error.message}`,
                    retryCount: attemptCount - 1,
                };
            }
        }

        return {
            success: false,
            providerId: this.config.id,
            timestamp: new Date(),
            error: `Unexpected end of retry loop`,
            retryCount: attemptCount - 1,
        };
    }

    private isRetriableError(error: any): boolean {
        // SES throttling
        if (error.name === 'Throttling' || error.Code === 'Throttling') {
            return true;
        }

        // Network errors
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return true;
        }

        // Server errors
        if (error.$metadata?.httpStatusCode >= 500) {
            return true;
        }

        // Temporary service errors
        if (error.message && (
            error.message.includes('service unavailable') ||
            error.message.includes('timeout') ||
            error.message.includes('Throttling')
        )) {
            return true;
        }

        return false;
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Verify SES client can be instantiated with valid credentials
            return !!(this.config.credentials.accessKeyId && this.config.credentials.secretAccessKey);
        } catch (error) {
            console.error(`[SESProvider] Health check failed:`, error);
            return false;
        }
    }

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
                retryPolicy: this.config.retryPolicy,
            },
        };
    }
}
