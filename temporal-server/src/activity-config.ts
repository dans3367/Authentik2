/**
 * Activity configuration that works in Temporal workflow sandbox
 * 
 * This provides a safe way to access configuration without relying on process.env
 * which is not available in the workflow sandbox environment.
 */

export interface ActivityConfig {
  backendUrl: string;
  resendApiKey: string;
  postmarkApiToken: string;
  primaryEmailProvider: string;
  frontendUrl: string;
  fromEmail: string;
  emailConcurrencyLimit: number;
}

// Default configuration - will be overridden at runtime
let activityConfig: ActivityConfig = {
  backendUrl: 'http://localhost:3500',
  resendApiKey: '',
  postmarkApiToken: '',
  primaryEmailProvider: 'resend',
  frontendUrl: 'https://app.zendwise.work',
  fromEmail: 'noreply@zendwise.work',
  emailConcurrencyLimit: 5
};

/**
 * Set the activity configuration from the worker environment
 * This should be called once when the worker starts, before any workflows run
 */
export function setActivityConfig(config: ActivityConfig): void {
  activityConfig = { ...config };
}

/**
 * Get the current activity configuration
 * Safe to use in workflow sandbox environment
 */
export function getActivityConfig(): ActivityConfig {
  return { ...activityConfig };
}

/**
 * Initialize activity configuration from environment variables
 * This should only be called from the main worker process, not in workflows
 */
export function initializeActivityConfigFromEnv(): ActivityConfig {
  // Only access process.env from the non-sandboxed worker environment
  if (typeof process !== 'undefined' && process.env) {
    // Load environment variables using dotenv for the temporal server
    try {
      const dotenv = require('dotenv');
      const path = require('path');
      
      // Load local .env file in temporal-server directory
      const localResult = dotenv.config();
      
      // Load root .env file from main project
      const rootEnvPath = path.resolve(__dirname, '../../.env');
      const rootResult = dotenv.config({ path: rootEnvPath });
      
      console.log(`[ActivityConfig] Local .env loaded: ${localResult.error ? 'no' : 'yes'}, Root .env loaded: ${rootResult.error ? 'no' : 'yes'}`);
      console.log(`[ActivityConfig] RESEND_API_KEY available: ${process.env.RESEND_API_KEY ? 'yes' : 'no'}`);
      console.log(`[ActivityConfig] POSTMARK_API_TOKEN available: ${process.env.POSTMARK_API_TOKEN ? 'yes' : 'no'}`);
    } catch (error) {
      console.warn('[ActivityConfig] Failed to load dotenv:', error);
    }
    
    const config: ActivityConfig = {
      backendUrl: process.env.BACKEND_URL || 'http://localhost:3500',
      resendApiKey: process.env.RESEND_API_KEY || '',
      postmarkApiToken: process.env.POSTMARK_API_TOKEN || process.env.POSTMARK_API_KEY || '',
      primaryEmailProvider: process.env.PRIMARY_EMAIL_PROVIDER || 'resend',
      frontendUrl: process.env.FRONTEND_URL || 'https://app.zendwise.work',
      fromEmail: process.env.FROM_EMAIL || 'noreply@zendwise.work',
      emailConcurrencyLimit: parseInt(process.env.EMAIL_CONCURRENCY_LIMIT || '5')
    };
    
    setActivityConfig(config);
    return config;
  }
  
  // Return defaults if process.env is not available
  return activityConfig;
}
