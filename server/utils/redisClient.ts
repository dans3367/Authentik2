/**
 * Shared Redis client.
 *
 * Used to back account-lockout counters and express-rate-limit stores so
 * the state survives process restarts and is shared across workers /
 * pods. When REDIS_URL is not set (e.g. local dev) we return null and the
 * call sites fall back to their in-process implementations — that is OK
 * for a single dev process but unsafe in production, so we warn loudly
 * if NODE_ENV === 'production' and REDIS_URL is missing.
 *
 * `ioredis` is imported lazily so the dependency is only required when
 * Redis is actually configured.
 */

import { logger } from './logger';

// Use `any` for the Redis type because ioredis is loaded dynamically and we
// don't want a hard compile-time dependency for environments that don't
// install it.
export type RedisLike = any;

let cachedClient: RedisLike | null | undefined;
let initPromise: Promise<RedisLike | null> | null = null;

async function createClient(): Promise<RedisLike | null> {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️ [Redis] REDIS_URL is not set in production. Account lockout ' +
        'and rate-limit counters will be PER-PROCESS only — this is ' +
        'effectively disabled under any horizontal scaling.'
      );
    }
    return null;
  }

  try {
    // Lazy ESM dynamic import so the dep is optional. Suppress TS module
    // resolution errors in environments that haven't installed it yet —
    // we fall back to in-memory state in that case.
    // @ts-ignore optional peer dep
    const mod: any = await import('ioredis');
    const Redis = mod.default || mod.Redis || mod;
    const client = new Redis(url, {
      // Don't crash the process if Redis is temporarily unavailable; the
      // call sites have in-memory fallbacks.
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      // Keep keys namespaced so multiple apps can share a Redis instance.
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'authentik:',
    });

    client.on('error', (err: any) => {
      // Avoid log flooding — ioredis reconnects automatically.
      logger.warn?.('[Redis] client error', { message: err?.message });
    });
    client.on('ready', () => {
      console.log('✅ [Redis] connected');
    });

    return client;
  } catch (err: any) {
    console.error(
      '❌ [Redis] Failed to initialise ioredis — falling back to in-memory ' +
      'state. Install the `ioredis` package to enable shared lockout/' +
      'rate-limit storage.',
      err?.message || err
    );
    return null;
  }
}

/**
 * Returns a shared Redis client, or null if Redis is not configured /
 * unavailable. Idempotent: subsequent calls return the same instance.
 */
export async function getRedis(): Promise<RedisLike | null> {
  if (cachedClient !== undefined) return cachedClient;
  if (!initPromise) {
    initPromise = createClient().then(c => {
      cachedClient = c;
      return c;
    });
  }
  return initPromise;
}

/**
 * Synchronous accessor — returns the cached client if it has already been
 * initialised, otherwise null. Useful for code paths that cannot await.
 */
export function getRedisSync(): RedisLike | null {
  return cachedClient ?? null;
}

// Eagerly start initialisation so the first request doesn't pay the cost.
void getRedis();
