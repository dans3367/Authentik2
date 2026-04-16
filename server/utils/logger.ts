/**
 * Centralized logging utility for the server
 * Only logs in development mode to prevent information leakage
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';

interface LogContext {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private enableSecurityLogs = process.env.ENABLE_SECURITY_LOGS !== 'false';

  /**
   * Debug logging - only in development
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }
  }

  /**
   * Info logging - only in development
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }
  }

  /**
   * Warning logging - always logs
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }

  /**
   * Error logging - always logs (without sensitive context)
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const sanitizedContext = context ? this.sanitizeContext(context) : undefined;
    console.error(`[ERROR] ${message}`, error?.message || '', sanitizedContext || '');
  }

  /**
   * Security event logging - configurable
   */
  security(event: string, context?: LogContext): void {
    if (this.enableSecurityLogs) {
      const sanitizedContext = context ? this.sanitizeContext(context) : undefined;
      console.log(`[SECURITY] ${event}`, sanitizedContext ? JSON.stringify(sanitizedContext, null, 2) : '');
    }
  }

  /**
   * Authentication success logging
   */
  authSuccess(userId: string, ip: string, userAgent?: string): void {
    this.security('AUTH_SUCCESS', {
      userId,
      ip,
      userAgent: userAgent?.substring(0, 100), // Truncate user agent
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Authentication failure logging
   */
  authFailure(reason: string, ip: string, email?: string, userAgent?: string): void {
    this.security('AUTH_FAILURE', {
      reason,
      ip,
      email: email ? this.maskEmail(email) : undefined,
      userAgent: userAgent?.substring(0, 100), // Truncate user agent
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Rate limit hit logging
   */
  rateLimitHit(identifier: string, ip: string): void {
    this.security('RATE_LIMIT_EXCEEDED', {
      identifier,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };

    // Remove or mask sensitive fields
    if (sanitized.password) delete sanitized.password;
    if (sanitized.token) delete sanitized.token;
    if (sanitized.refreshToken) delete sanitized.refreshToken;
    if (sanitized.email) sanitized.email = this.maskEmail(sanitized.email);

    return sanitized;
  }

  /**
   * Mask email for logging
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local}***@${domain}`;
    return `${local.substring(0, 2)}***@${domain}`;
  }
}

export const logger = new Logger();

/**
 * Redact an email address for safe inclusion in a log line.
 * Keeps the first two chars of the local part and the full domain so logs
 * remain useful for correlating events, without persisting the full PII.
 * Returns a fixed placeholder for malformed / missing input.
 */
export function redactEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '<no-email>';
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '<invalid-email>';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const head = local.length <= 2 ? local : local.slice(0, 2);
  return `${head}***@${domain}`;
}



