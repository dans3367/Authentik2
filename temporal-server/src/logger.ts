import pino from 'pino';

// Create logger configuration based on environment
const isProduction = process.env.NODE_ENV === 'production';

const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  
  // Always use pretty printing in development and non-production
  transport: !isProduction ? {
    target: 'pino-pretty',
    options: {
      colorize: false,
      translateTime: '[HH:MM:ss.l]',
      ignore: 'hostname',
      singleLine: false,
      messageFormat: '{levelLabel} ({pid}) [{context}]: {msg}',
      hideObject: true,
      levelFirst: false,
      messageKey: 'msg',
      timestampKey: 'time',
      errorLikeObjectKeys: ['err', 'error'],
      sync: true,
    }
  } : undefined,

  // Base logger configuration for production
  formatters: isProduction ? {
    level: (label) => ({ level: label }),
  } : undefined,

  // Add default context
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'temporal-server',
  },
};

// Create the main logger instance
export const logger = pino(loggerConfig);

// Create context-specific loggers for different parts of the temporal server
export const serverLogger = logger.child({ context: 'temporal-server' });
export const workerLogger = logger.child({ context: 'temporal-worker' });
export const grpcLogger = logger.child({ context: 'grpc-service' });
export const newsletterLogger = logger.child({ context: 'newsletter' });
export const workflowLogger = logger.child({ context: 'workflow' });
export const activityLogger = logger.child({ context: 'activity' });
export const protoLogger = logger.child({ context: 'proto' });

export default logger;
