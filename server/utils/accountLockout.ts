/**
 * Account Lockout System
 * Implements progressive delays and temporary lockouts for failed login attempts
 */

import { logger } from './logger';

interface AccountAttempt {
  count: number;
  lastAttempt: number;
  lockoutUntil?: number;
  totalAttempts: number;
}

interface LockoutConfig {
  // Progressive delay thresholds and delays (in milliseconds)
  progressiveDelays: {
    after: number;    // After this many attempts
    delay: number;    // Delay in milliseconds
  }[];

  // Temporary lockout settings
  temporaryLockouts: {
    after: number;    // After this many attempts
    duration: number; // Lockout duration in milliseconds
  }[];

  // Reset settings
  resetAfter: number; // Reset attempts after this time (successful login)
  maxTrackingTime: number; // Don't track attempts older than this

  // Database persistence (for better reliability)
  persistToDb: boolean;
}

const defaultConfig: LockoutConfig = {
  progressiveDelays: [
    { after: 3, delay: 1000 },      // 1 second after 3 attempts
    { after: 5, delay: 5000 },      // 5 seconds after 5 attempts
    { after: 7, delay: 15000 },     // 15 seconds after 7 attempts
    { after: 10, delay: 60000 },    // 1 minute after 10 attempts
  ],

  temporaryLockouts: [
    { after: 15, duration: 15 * 60 * 1000 },   // 15 minutes after 15 attempts
    { after: 20, duration: 60 * 60 * 1000 },   // 1 hour after 20 attempts
    { after: 25, duration: 24 * 60 * 60 * 1000 }, // 24 hours after 25 attempts
  ],

  resetAfter: 24 * 60 * 60 * 1000, // Reset after 24 hours of no attempts
  maxTrackingTime: 7 * 24 * 60 * 60 * 1000, // Track for max 7 days
  persistToDb: false, // Set to true if you want DB persistence
};

class AccountLockoutManager {
  private attempts = new Map<string, AccountAttempt>();
  private config: LockoutConfig;

  constructor(config: Partial<LockoutConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Check if an account is currently locked out
   */
  isLocked(identifier: string): { locked: boolean; remainingTime?: number; reason?: string } {
    const attempt = this.attempts.get(identifier);

    if (!attempt) {
      return { locked: false };
    }

    // Clean up expired attempts
    this.cleanup(identifier);

    // Check if currently locked out
    if (attempt.lockoutUntil && attempt.lockoutUntil > Date.now()) {
      const remainingTime = attempt.lockoutUntil - Date.now();
      return {
        locked: true,
        remainingTime,
        reason: `Temporary lockout due to ${attempt.totalAttempts} failed attempts`
      };
    }

    return { locked: false };
  }

  /**
   * Record a failed login attempt
   */
  recordFailedAttempt(identifier: string, ip: string): { shouldDelay: boolean; delayMs?: number; locked?: boolean } {
    const now = Date.now();
    let attempt = this.attempts.get(identifier);

    if (!attempt) {
      attempt = {
        count: 0,
        lastAttempt: now,
        totalAttempts: 0
      };
    }

    // Increment counters
    attempt.count++;
    attempt.totalAttempts++;
    attempt.lastAttempt = now;

    // Check for progressive delays
    const progressiveDelay = this.getProgressiveDelay(attempt.totalAttempts);
    if (progressiveDelay) {
      logger.security('PROGRESSIVE_DELAY', {
        identifier,
        ip,
        attemptCount: attempt.totalAttempts,
        delayMs: progressiveDelay,
        timestamp: new Date().toISOString()
      });

      this.attempts.set(identifier, attempt);
      return { shouldDelay: true, delayMs: progressiveDelay };
    }

    // Check for temporary lockouts
    const lockout = this.getTemporaryLockout(attempt.totalAttempts);
    if (lockout) {
      attempt.lockoutUntil = now + lockout.duration;

      logger.security('ACCOUNT_LOCKOUT', {
        identifier,
        ip,
        attemptCount: attempt.totalAttempts,
        lockoutDuration: lockout.duration,
        lockoutUntil: new Date(attempt.lockoutUntil).toISOString(),
        timestamp: new Date().toISOString()
      });

      this.attempts.set(identifier, attempt);
      return { shouldDelay: false, locked: true };
    }

    this.attempts.set(identifier, attempt);
    return { shouldDelay: false };
  }

  /**
   * Record a successful login (resets the attempt counter)
   */
  recordSuccessfulLogin(identifier: string, ip: string): void {
    const attempt = this.attempts.get(identifier);

    if (attempt && attempt.totalAttempts > 0) {
      logger.security('ACCOUNT_UNLOCKED', {
        identifier,
        ip,
        previousAttempts: attempt.totalAttempts,
        timestamp: new Date().toISOString()
      });
    }

    // Clear the attempt record on successful login
    this.attempts.delete(identifier);
  }

  /**
   * Get progressive delay for current attempt count
   */
  private getProgressiveDelay(attemptCount: number): number | null {
    // Find the highest threshold we've crossed
    for (let i = this.config.progressiveDelays.length - 1; i >= 0; i--) {
      const delay = this.config.progressiveDelays[i];
      if (attemptCount >= delay.after) {
        return delay.delay;
      }
    }
    return null;
  }

  /**
   * Get temporary lockout for current attempt count
   */
  private getTemporaryLockout(attemptCount: number): { duration: number } | null {
    // Find the highest threshold we've crossed
    for (let i = this.config.temporaryLockouts.length - 1; i >= 0; i--) {
      const lockout = this.config.temporaryLockouts[i];
      if (attemptCount >= lockout.after) {
        return { duration: lockout.duration };
      }
    }
    return null;
  }

  /**
   * Clean up expired attempts
   */
  private cleanup(identifier: string): void {
    const attempt = this.attempts.get(identifier);
    if (!attempt) return;

    const now = Date.now();

    // Remove if no attempts in reset window
    if (now - attempt.lastAttempt > this.config.resetAfter) {
      this.attempts.delete(identifier);
      return;
    }

    // Remove if max tracking time exceeded
    if (now - attempt.lastAttempt > this.config.maxTrackingTime) {
      this.attempts.delete(identifier);
      return;
    }

    // Clear expired lockouts
    if (attempt.lockoutUntil && attempt.lockoutUntil < now) {
      attempt.lockoutUntil = undefined;
      this.attempts.set(identifier, attempt);
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalTracked: number;
    currentlyLocked: number;
    totalAttempts: number;
  } {
    let currentlyLocked = 0;
    let totalAttempts = 0;

    for (const attempt of this.attempts.values()) {
      if (attempt.lockoutUntil && attempt.lockoutUntil > Date.now()) {
        currentlyLocked++;
      }
      totalAttempts += attempt.totalAttempts;
    }

    return {
      totalTracked: this.attempts.size,
      currentlyLocked,
      totalAttempts
    };
  }

  /**
   * Manual cleanup of old entries (call periodically)
   */
  cleanupExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [identifier, attempt] of this.attempts.entries()) {
      if (now - attempt.lastAttempt > this.config.maxTrackingTime) {
        toDelete.push(identifier);
      }
    }

    toDelete.forEach(id => this.attempts.delete(id));

    if (toDelete.length > 0) {
      logger.debug(`Cleaned up ${toDelete.length} expired lockout records`);
    }
  }
}

// Global instance
export const accountLockout = new AccountLockoutManager();

// Periodic cleanup (every 30 minutes)
setInterval(() => {
  accountLockout.cleanupExpired();
}, 30 * 60 * 1000);



