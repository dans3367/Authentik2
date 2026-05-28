/**
 * Account Lockout System
 * Implements progressive delays and temporary lockouts for failed login attempts.
 *
 * State is stored in Redis when REDIS_URL is configured, so counters survive
 * process restarts and are shared across workers / pods. Falls back to an
 * in-memory Map if Redis is unavailable — that fallback is only safe for
 * single-process dev environments.
 */

import { logger } from './logger';
import { getRedis, getRedisSync, type RedisLike } from './redisClient';

interface AccountAttempt {
  count: number;
  lastAttempt: number;
  lockoutUntil?: number;
  totalAttempts: number;
}

interface LockoutConfig {
  progressiveDelays: { after: number; delay: number }[];
  temporaryLockouts: { after: number; duration: number }[];
  resetAfter: number;
  maxTrackingTime: number;
}

const defaultConfig: LockoutConfig = {
  progressiveDelays: [
    { after: 3, delay: 1000 },
    { after: 5, delay: 5000 },
    { after: 7, delay: 15000 },
    { after: 10, delay: 60000 },
  ],
  temporaryLockouts: [
    { after: 15, duration: 15 * 60 * 1000 },
    { after: 20, duration: 60 * 60 * 1000 },
    { after: 25, duration: 24 * 60 * 60 * 1000 },
  ],
  resetAfter: 24 * 60 * 60 * 1000,
  maxTrackingTime: 7 * 24 * 60 * 60 * 1000,
};

// --- Key helpers -------------------------------------------------------------

const REDIS_NS = 'lockout';
function attemptsKey(id: string) { return `${REDIS_NS}:a:${id}`; }
function lockoutKey(id: string) { return `${REDIS_NS}:l:${id}`; }

// --- Implementation ----------------------------------------------------------

class AccountLockoutManager {
  private attempts = new Map<string, AccountAttempt>(); // fallback only
  private config: LockoutConfig;

  constructor(config: Partial<LockoutConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // Treat Redis as the source of truth when configured. We expose async
  // methods so callers can `await` Redis ops. Where the legacy in-memory
  // API was synchronous (isLocked / recordFailedAttempt / recordSuccessfulLogin),
  // we keep them async — call sites already use `await`.

  private getRedis(): RedisLike | null {
    return getRedisSync();
  }

  /**
   * Check if an account is currently locked out.
   */
  async isLocked(identifier: string): Promise<{ locked: boolean; remainingTime?: number; reason?: string }> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const [until, total] = await Promise.all([
          redis.get(lockoutKey(identifier)),
          redis.get(attemptsKey(identifier)),
        ]);
        const untilMs = until ? Number(until) : 0;
        if (untilMs && untilMs > Date.now()) {
          return {
            locked: true,
            remainingTime: untilMs - Date.now(),
            reason: `Temporary lockout due to ${total || '?'} failed attempts`,
          };
        }
        return { locked: false };
      } catch (err: any) {
        logger.warn('[Lockout] Redis isLocked failed, falling back to memory', { error: err?.message });
        // fall through to memory
      }
    }
    return this.isLockedMemory(identifier);
  }

  /**
   * Record a failed login attempt.
   * Returns whether to delay the response, and/or whether the account is now locked.
   */
  async recordFailedAttempt(
    identifier: string,
    ip: string,
  ): Promise<{ shouldDelay: boolean; delayMs?: number; locked?: boolean }> {
    const redis = this.getRedis();
    if (redis) {
      try {
        // Atomic increment with TTL refresh. We use the maxTrackingTime TTL
        // (in seconds) so abandoned counters expire on their own.
        const ttlSec = Math.ceil(this.config.maxTrackingTime / 1000);
        const totalAttempts = await redis.incr(attemptsKey(identifier));
        // Only set TTL on the first increment; we don't want to keep
        // pushing the window out indefinitely.
        if (totalAttempts === 1) {
          await redis.expire(attemptsKey(identifier), ttlSec);
        }

        const progressiveDelay = this.getProgressiveDelay(totalAttempts);
        const lockout = this.getTemporaryLockout(totalAttempts);

        if (lockout) {
          const lockoutUntil = Date.now() + lockout.duration;
          await redis.set(
            lockoutKey(identifier),
            String(lockoutUntil),
            'PX',
            lockout.duration,
          );
          logger.security('ACCOUNT_LOCKOUT', {
            identifier, ip,
            attemptCount: totalAttempts,
            lockoutDuration: lockout.duration,
            lockoutUntil: new Date(lockoutUntil).toISOString(),
            store: 'redis',
          });
          return { shouldDelay: false, locked: true };
        }

        if (progressiveDelay) {
          logger.security('PROGRESSIVE_DELAY', {
            identifier, ip,
            attemptCount: totalAttempts,
            delayMs: progressiveDelay,
            store: 'redis',
          });
          return { shouldDelay: true, delayMs: progressiveDelay };
        }
        return { shouldDelay: false };
      } catch (err: any) {
        logger.warn('[Lockout] Redis recordFailedAttempt failed, falling back to memory', { error: err?.message });
        // fall through to memory
      }
    }
    return this.recordFailedAttemptMemory(identifier, ip);
  }

  /**
   * Record a successful login (resets the attempt counter).
   */
  async recordSuccessfulLogin(identifier: string, ip: string): Promise<void> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const total = await redis.get(attemptsKey(identifier));
        if (total && Number(total) > 0) {
          logger.security('ACCOUNT_UNLOCKED', {
            identifier, ip,
            previousAttempts: Number(total),
            store: 'redis',
          });
        }
        await redis.del(attemptsKey(identifier), lockoutKey(identifier));
        return;
      } catch (err: any) {
        logger.warn('[Lockout] Redis recordSuccessfulLogin failed, falling back to memory', { error: err?.message });
        // fall through to memory
      }
    }
    this.recordSuccessfulLoginMemory(identifier, ip);
  }

  // ------------- In-memory fallback (single-process only) -------------------

  private isLockedMemory(identifier: string): { locked: boolean; remainingTime?: number; reason?: string } {
    const attempt = this.attempts.get(identifier);
    if (!attempt) return { locked: false };
    this.cleanupMemory(identifier);
    if (attempt.lockoutUntil && attempt.lockoutUntil > Date.now()) {
      return {
        locked: true,
        remainingTime: attempt.lockoutUntil - Date.now(),
        reason: `Temporary lockout due to ${attempt.totalAttempts} failed attempts`,
      };
    }
    return { locked: false };
  }

  private recordFailedAttemptMemory(
    identifier: string, ip: string,
  ): { shouldDelay: boolean; delayMs?: number; locked?: boolean } {
    const now = Date.now();
    let attempt = this.attempts.get(identifier);
    if (!attempt) attempt = { count: 0, lastAttempt: now, totalAttempts: 0 };
    attempt.count++;
    attempt.totalAttempts++;
    attempt.lastAttempt = now;

    const progressiveDelay = this.getProgressiveDelay(attempt.totalAttempts);
    if (progressiveDelay) {
      logger.security('PROGRESSIVE_DELAY', { identifier, ip, attemptCount: attempt.totalAttempts, delayMs: progressiveDelay, store: 'memory' });
      this.attempts.set(identifier, attempt);
      return { shouldDelay: true, delayMs: progressiveDelay };
    }
    const lockout = this.getTemporaryLockout(attempt.totalAttempts);
    if (lockout) {
      attempt.lockoutUntil = now + lockout.duration;
      logger.security('ACCOUNT_LOCKOUT', { identifier, ip, attemptCount: attempt.totalAttempts, lockoutDuration: lockout.duration, lockoutUntil: new Date(attempt.lockoutUntil).toISOString(), store: 'memory' });
      this.attempts.set(identifier, attempt);
      return { shouldDelay: false, locked: true };
    }
    this.attempts.set(identifier, attempt);
    return { shouldDelay: false };
  }

  private recordSuccessfulLoginMemory(identifier: string, ip: string): void {
    const attempt = this.attempts.get(identifier);
    if (attempt && attempt.totalAttempts > 0) {
      logger.security('ACCOUNT_UNLOCKED', { identifier, ip, previousAttempts: attempt.totalAttempts, store: 'memory' });
    }
    this.attempts.delete(identifier);
  }

  private getProgressiveDelay(attemptCount: number): number | null {
    for (let i = this.config.progressiveDelays.length - 1; i >= 0; i--) {
      const d = this.config.progressiveDelays[i];
      if (attemptCount >= d.after) return d.delay;
    }
    return null;
  }

  private getTemporaryLockout(attemptCount: number): { duration: number } | null {
    for (let i = this.config.temporaryLockouts.length - 1; i >= 0; i--) {
      const l = this.config.temporaryLockouts[i];
      if (attemptCount >= l.after) return { duration: l.duration };
    }
    return null;
  }

  private cleanupMemory(identifier: string): void {
    const attempt = this.attempts.get(identifier);
    if (!attempt) return;
    const now = Date.now();
    if (now - attempt.lastAttempt > this.config.resetAfter) {
      this.attempts.delete(identifier);
      return;
    }
    if (now - attempt.lastAttempt > this.config.maxTrackingTime) {
      this.attempts.delete(identifier);
      return;
    }
    if (attempt.lockoutUntil && attempt.lockoutUntil < now) {
      attempt.lockoutUntil = undefined;
      this.attempts.set(identifier, attempt);
    }
  }

  getStats(): { totalTracked: number; currentlyLocked: number; totalAttempts: number } {
    let currentlyLocked = 0;
    let totalAttempts = 0;
    for (const a of this.attempts.values()) {
      if (a.lockoutUntil && a.lockoutUntil > Date.now()) currentlyLocked++;
      totalAttempts += a.totalAttempts;
    }
    return { totalTracked: this.attempts.size, currentlyLocked, totalAttempts };
  }

  cleanupExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    for (const [id, a] of this.attempts.entries()) {
      if (now - a.lastAttempt > this.config.maxTrackingTime) toDelete.push(id);
    }
    toDelete.forEach(id => this.attempts.delete(id));
    if (toDelete.length > 0) logger.debug(`Cleaned up ${toDelete.length} expired lockout records`);
  }
}

export const accountLockout = new AccountLockoutManager();

// Periodic cleanup of the memory fallback (Redis keys expire on their own).
setInterval(() => accountLockout.cleanupExpired(), 30 * 60 * 1000);

// Ensure Redis client initialisation kicks off on module load.
void getRedis();
