/**
 * Tiny shared-state "cooldown" helper used by handler-local rate limits
 * (e.g. /change-email-unverified's 2-minute per-user cooldown).
 *
 * Backed by Redis when configured so cooldowns are shared across workers
 * and survive restarts. Falls back to an in-process Map only when Redis
 * is unavailable (safe for single-process dev; unsafe at scale, which
 * matches the same trade-off documented for accountLockout).
 */

import { getRedisSync } from './redisClient';
import { logger } from './logger';

interface MemEntry { nextAllowedAt: number }
const memStore = new Map<string, MemEntry>();

/**
 * Returns `{ allowed: true }` if the action may proceed, otherwise
 * `{ allowed: false, retryAfterSec }`. On allow, `arm(durationMs)`
 * MUST be called by the handler to start the next cooldown window
 * (kept separate so callers can decide whether failure paths also
 * arm the cooldown).
 */
export async function checkCooldown(
  bucket: string,
  key: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const redis = getRedisSync();
  const redisKey = `cooldown:${bucket}:${key}`;

  if (redis) {
    try {
      const pttl: number = await redis.pttl(redisKey);
      if (pttl > 0) {
        return { allowed: false, retryAfterSec: Math.ceil(pttl / 1000) };
      }
      return { allowed: true };
    } catch (err: any) {
      logger.warn?.('[Cooldown] Redis check failed, falling back to memory', { error: err?.message });
      // fall through
    }
  }

  const now = Date.now();
  const entry = memStore.get(redisKey);
  if (entry && entry.nextAllowedAt > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.nextAllowedAt - now) / 1000) };
  }
  return { allowed: true };
}

export async function armCooldown(bucket: string, key: string, durationMs: number): Promise<void> {
  const redis = getRedisSync();
  const redisKey = `cooldown:${bucket}:${key}`;
  if (redis) {
    try {
      await redis.set(redisKey, '1', 'PX', durationMs);
      return;
    } catch (err: any) {
      logger.warn?.('[Cooldown] Redis arm failed, falling back to memory', { error: err?.message });
      // fall through
    }
  }
  memStore.set(redisKey, { nextAllowedAt: Date.now() + durationMs });
}

/** Periodically prunes expired entries from the in-memory fallback. */
export function pruneMemoryCooldowns(): void {
  const now = Date.now();
  for (const [k, v] of memStore) {
    if (v.nextAllowedAt <= now) memStore.delete(k);
  }
}
