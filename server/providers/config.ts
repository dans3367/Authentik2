import { ProviderConfig } from './types';

export class EmailProviderConfig {
  private static configs: ProviderConfig[] = [];

  static getDefaultConfigs(): ProviderConfig[] {
    return [
      {
        id: 'resend-primary',
        name: 'resend',
        priority: 1,
        enabled: true,
        rateLimit: {
          requestsPerSecond: 2, // Resend specific requirement
          burstSize: 3 // Allow small burst
        },
        retryPolicy: {
          maxRetries: 5, // As requested
          initialDelayMs: 5000, // 5 seconds for 429 errors
          maxDelayMs: 30000, // Cap at 30 seconds
          backoffMultiplier: 1, // No exponential backoff for rate limits
          retryAfterExhaustionMs: 3600000 // 1 hour as requested
        },
        credentials: {
          apiKey: process.env.RESEND_API_KEY || ''
        }
      }
      // Additional providers can be added here, e.g.:
      // {
      //   id: 'resend-backup',
      //   name: 'resend',
      //   priority: 2,
      //   enabled: false,
      //   rateLimit: {
      //     requestsPerSecond: 1
      //   },
      //   retryPolicy: {
      //     maxRetries: 3,
      //     initialDelayMs: 2000,
      //     maxDelayMs: 10000,
      //     backoffMultiplier: 2
      //   },
      //   credentials: {
      //     apiKey: process.env.RESEND_BACKUP_API_KEY || ''
      //   }
      // },
      // {
      //   id: 'sendgrid-primary',
      //   name: 'sendgrid',
      //   priority: 3,
      //   enabled: false,
      //   rateLimit: {
      //     requestsPerSecond: 10
      //   },
      //   retryPolicy: {
      //     maxRetries: 3,
      //     initialDelayMs: 1000,
      //     maxDelayMs: 8000,
      //     backoffMultiplier: 2
      //   },
      //   credentials: {
      //     apiKey: process.env.SENDGRID_API_KEY || ''
      //   }
      // }
    ];
  }

  static loadConfigs(): ProviderConfig[] {
    if (this.configs.length === 0) {
      this.configs = this.getDefaultConfigs();
      
      // Validate configurations
      this.configs = this.configs.filter(config => this.validateConfig(config));
    }
    
    return this.configs;
  }

  static addConfig(config: ProviderConfig): void {
    if (this.validateConfig(config)) {
      // Remove existing config with same ID if it exists
      this.configs = this.configs.filter(c => c.id !== config.id);
      this.configs.push(config);
    } else {
      throw new Error(`Invalid provider config: ${config.id}`);
    }
  }

  static removeConfig(providerId: string): void {
    this.configs = this.configs.filter(c => c.id !== providerId);
  }

  static updateConfig(providerId: string, updates: Partial<ProviderConfig>): void {
    const configIndex = this.configs.findIndex(c => c.id === providerId);
    if (configIndex >= 0) {
      this.configs[configIndex] = { ...this.configs[configIndex], ...updates };
      
      if (!this.validateConfig(this.configs[configIndex])) {
        throw new Error(`Invalid updated config for provider: ${providerId}`);
      }
    } else {
      throw new Error(`Provider config not found: ${providerId}`);
    }
  }

  static getConfig(providerId: string): ProviderConfig | undefined {
    return this.configs.find(c => c.id === providerId);
  }

  static getEnabledConfigs(): ProviderConfig[] {
    return this.configs.filter(c => c.enabled);
  }

  private static validateConfig(config: ProviderConfig): boolean {
    try {
      // Basic validation
      if (!config.id || !config.name) {
        console.error(`[EmailProviderConfig] Invalid config: missing id or name`);
        return false;
      }

      if (config.priority < 0) {
        console.error(`[EmailProviderConfig] Invalid config: priority must be >= 0`);
        return false;
      }

      // Validate rate limiting config
      if (config.rateLimit) {
        if (config.rateLimit.requestsPerSecond <= 0) {
          console.error(`[EmailProviderConfig] Invalid config: requestsPerSecond must be > 0`);
          return false;
        }
      }

      // Validate retry policy
      if (config.retryPolicy) {
        const policy = config.retryPolicy;
        if (policy.maxRetries < 0 || policy.initialDelayMs < 0 || policy.maxDelayMs < 0) {
          console.error(`[EmailProviderConfig] Invalid config: retry policy values must be >= 0`);
          return false;
        }
        
        if (policy.backoffMultiplier <= 0) {
          console.error(`[EmailProviderConfig] Invalid config: backoffMultiplier must be > 0`);
          return false;
        }
      }

      // Validate credentials based on provider type
      if (config.name.toLowerCase() === 'resend') {
        if (!config.credentials.apiKey) {
          console.warn(`[EmailProviderConfig] Warning: Resend provider ${config.id} has no API key`);
          // Don't return false here as the API key might be set later
        }
      }

      return true;
    } catch (error) {
      console.error(`[EmailProviderConfig] Validation error for ${config.id}:`, error);
      return false;
    }
  }

  // Get configuration for environment-specific settings
  static getEnvironmentConfig() {
    return {
      fromEmail: process.env.FROM_EMAIL || 'noreply@zendwise.work',
      appName: process.env.APP_NAME || 'SaaS Auth App',
      baseUrl: process.env.BASE_URL || 'http://localhost:5000',
      enableQueue: process.env.EMAIL_ENABLE_QUEUE === 'true',
      queueProcessingInterval: parseInt(process.env.EMAIL_QUEUE_PROCESSING_INTERVAL || '1000'),
      cleanupInterval: parseInt(process.env.EMAIL_CLEANUP_INTERVAL || '3600000'), // 1 hour
      maxQueueSize: parseInt(process.env.EMAIL_MAX_QUEUE_SIZE || '10000')
    };
  }

  // Reset configs (useful for testing)
  static reset(): void {
    this.configs = [];
  }

  // Get summary of all configs
  static getSummary() {
    const configs = this.loadConfigs();
    return {
      total: configs.length,
      enabled: configs.filter(c => c.enabled).length,
      disabled: configs.filter(c => !c.enabled).length,
      byProvider: configs.reduce((acc, config) => {
        acc[config.name] = (acc[config.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      priorities: configs.map(c => ({ id: c.id, priority: c.priority })).sort((a, b) => a.priority - b.priority)
    };
  }
}