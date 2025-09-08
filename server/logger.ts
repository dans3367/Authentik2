import pino from 'pino';

// Create logger configuration based on environment
const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // In development, use pretty printing for better readability
  // In production, use structured JSON logging
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: true,
      messageFormat: '{levelLabel} [{context}] {msg}',
    }
  } : undefined,

  // Base logger configuration for production
  formatters: process.env.NODE_ENV === 'production' ? {
    time: () => `,"timestamp":"${new Date().toISOString()}"`,
    level: (label) => ({ level: label }),
  } : undefined,

  // Add default context
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'localhost',
  },
};

// Create the main logger instance
export const logger = pino(loggerConfig);

// Create context-specific loggers for different parts of the application
export const serverLogger = logger.child({ context: 'server' });
export const dbLogger = logger.child({ context: 'database' });
export const authLogger = logger.child({ context: 'auth' });
export const apiLogger = logger.child({ context: 'api' });
export const temporalLogger = logger.child({ context: 'temporal' });
export const storageLogger = logger.child({ context: 'storage' });
export const routeLogger = logger.child({ context: 'routes' });

// Legacy compatibility function to replace the existing log function
export function log(message: string, source = "express") {
  const contextLogger = logger.child({ context: source });
  contextLogger.info(message);
}

export default logger;
