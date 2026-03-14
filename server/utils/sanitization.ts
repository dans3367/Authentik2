/**
 * Input sanitization and validation utilities
 */

/**
 * Trims whitespace from string inputs and normalizes empty strings to undefined
 */
export function trimAndNormalize(input: string | undefined | null): string | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Sanitizes email input by trimming whitespace and converting to lowercase
 */
export function sanitizeEmail(email: string | undefined | null): string | undefined {
  const trimmed = trimAndNormalize(email);
  return trimmed ? trimmed.toLowerCase() : undefined;
}

/**
 * Sanitizes password input by trimming whitespace only
 */
export function sanitizePassword(password: string | undefined | null): string | undefined {
  return trimAndNormalize(password);
}

/**
 * Sanitizes name inputs by trimming whitespace and normalizing case
 */
export function sanitizeName(name: string | undefined | null): string | undefined {
  const trimmed = trimAndNormalize(name);
  if (!trimmed) return undefined;
  
  // Capitalize first letter of each word
  return trimmed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Removes potentially dangerous characters for SQL injection prevention
 * Note: We use parameterized queries with Drizzle ORM which provides primary protection
 */
export function sanitizeString(input: string | undefined | null): string | undefined {
  const trimmed = trimAndNormalize(input);
  if (!trimmed) return undefined;
  
  // Remove null bytes and other control characters
  return trimmed.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Validates and sanitizes slug inputs (for tenant slugs, etc.)
 */
export function sanitizeSlug(slug: string | undefined | null): string | undefined {
  const trimmed = trimAndNormalize(slug);
  if (!trimmed) return undefined;
  
  // Convert to lowercase and replace invalid characters with hyphens
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Comprehensive input sanitization for user data
 */
export function sanitizeUserInput(data: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}) {
  return {
    ...data,
    email: data.email ? sanitizeEmail(data.email) : undefined,
    password: data.password ? sanitizePassword(data.password) : undefined,
    firstName: data.firstName ? sanitizeName(data.firstName) : undefined,
    lastName: data.lastName ? sanitizeName(data.lastName) : undefined,
  };
}

/**
 * Rate limiting helper - tracks login attempts by IP
 */
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export function checkRateLimit(ip: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset if window has passed
  if (now - attempts.lastAttempt > windowMs) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Check if exceeded limit
  if (attempts.count >= maxAttempts) {
    return false;
  }
  
  // Increment counter
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}

/**
 * Clear rate limit for successful login
 */
export function clearRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Escapes LIKE/ILIKE wildcard characters (% and _) in a search string
 * so they are treated as literal characters in SQL LIKE patterns.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Get client IP address from request
 */
export function getClientIP(req: any): string {
  return req.ip ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         'unknown';
}

/**
 * Sanitize HTML content for emails - allows safe formatting tags, strips scripts and event handlers.
 * Re-exported from server/routes/email/emailUtils.ts for convenience.
 */
export { sanitizeEmailHtml } from '../routes/email/emailUtils';