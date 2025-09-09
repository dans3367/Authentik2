/**
 * Workflow-safe logger that doesn't rely on Node.js globals
 * 
 * This logger is designed to work inside Temporal workflow bundles
 * where Node.js globals like 'process' are not available.
 */

interface WorkflowLoggerLevel {
  info: (message: any, ...args: any[]) => void;
  error: (message: any, ...args: any[]) => void;
  warn: (message: any, ...args: any[]) => void;
  debug: (message: any, ...args: any[]) => void;
}

// Simple timestamp function that works in workflow context
const getTimestamp = (): string => {
  return new Date().toISOString();
};

// Format log messages consistently
const formatMessage = (level: string, context: string, message: any, ...args: any[]): string => {
  const timestamp = getTimestamp();
  const messageStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
  const argsStr = args.length > 0 ? ` ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ')}` : '';
  
  return `[${timestamp}] ${level.toUpperCase()} [${context}]: ${messageStr}${argsStr}`;
};

// Create a logger instance for a specific context
const createWorkflowLogger = (context: string): WorkflowLoggerLevel => ({
  info: (message: any, ...args: any[]) => {
    console.log(formatMessage('info', context, message, ...args));
  },
  error: (message: any, ...args: any[]) => {
    console.error(formatMessage('error', context, message, ...args));
  },
  warn: (message: any, ...args: any[]) => {
    console.warn(formatMessage('warn', context, message, ...args));
  },
  debug: (message: any, ...args: any[]) => {
    console.log(formatMessage('debug', context, message, ...args));
  },
});

// Export workflow-safe loggers for different contexts
export const workflowLogger = createWorkflowLogger('workflow');
export const activityLogger = createWorkflowLogger('activity');
export const newsletterLogger = createWorkflowLogger('newsletter');

// Default export
export default workflowLogger;
