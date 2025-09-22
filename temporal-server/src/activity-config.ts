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
  fromEmail: 'admin@zendwise.work',
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
  // Check if we're in a Node.js environment with proper globals
  if (typeof globalThis !== 'undefined' &&
      typeof globalThis.process !== 'undefined' &&
      typeof globalThis.process.env !== 'undefined' &&
      typeof globalThis.require !== 'undefined') {

    try {
      // Load environment variables using dotenv for the temporal server
      const dotenv = globalThis.require('dotenv');
      const path = globalThis.require('path');

      // Load local .env file in temporal-server directory first
      const localEnvPath = path.resolve(globalThis.process.cwd(), '.env');
      const localResult = dotenv.config({ path: localEnvPath });

      // Load root .env file from main project as fallback
      const rootEnvPath = path.resolve(globalThis.process.cwd(), '../.env');
      const rootResult = dotenv.config({ path: rootEnvPath });

      console.log(`[ActivityConfig] Local .env (${localEnvPath}) loaded: ${localResult.error ? 'no' : 'yes'}`);
      console.log(`[ActivityConfig] Root .env (${rootEnvPath}) loaded: ${rootResult.error ? 'no' : 'yes'}`);
      console.log(`[ActivityConfig] Current working directory: ${globalThis.process.cwd()}`);
      console.log(`[ActivityConfig] RESEND_API_KEY available: ${globalThis.process.env.RESEND_API_KEY ? 'yes' : 'no'}`);
      if (globalThis.process.env.RESEND_API_KEY) {
        console.log(`[ActivityConfig] RESEND_API_KEY length: ${globalThis.process.env.RESEND_API_KEY.length}`);
      }
      console.log(`[ActivityConfig] POSTMARK_API_TOKEN available: ${globalThis.process.env.POSTMARK_API_TOKEN ? 'yes' : 'no'}`);
    } catch (error) {
      console.warn('[ActivityConfig] Failed to load dotenv:', error);
    }

    const config: ActivityConfig = {
      backendUrl: globalThis.process.env.BACKEND_URL || 'http://localhost:3500',
      resendApiKey: globalThis.process.env.RESEND_API_KEY || '',
      postmarkApiToken: globalThis.process.env.POSTMARK_API_TOKEN || globalThis.process.env.POSTMARK_API_KEY || '',
      primaryEmailProvider: globalThis.process.env.PRIMARY_EMAIL_PROVIDER || 'resend',
      frontendUrl: globalThis.process.env.FRONTEND_URL || 'https://app.zendwise.work',
      fromEmail: globalThis.process.env.FROM_EMAIL || 'admin@zendwise.work',
      emailConcurrencyLimit: parseInt(globalThis.process.env.EMAIL_CONCURRENCY_LIMIT || '5')
    };

    setActivityConfig(config);
    return config;
  }

  console.log('[ActivityConfig] Running in sandboxed environment, using default config');
  // Return defaults if we're in a sandboxed environment (like workflow)
  return activityConfig;
}
