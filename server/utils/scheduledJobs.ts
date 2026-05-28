/**
 * Scheduled-job leader election.
 *
 * Many of our background cleanup jobs (temp-2FA cleanup, rate-limit map
 * GC, etc.) live inside the API process and run on a setInterval. Under
 * horizontal scaling (multiple workers, multiple pods) the naive
 * `setInterval` registration fires in every process, which:
 *
 *   - duplicates DB writes and logs,
 *   - wastes work,
 *   - and in some cases (counter resets, mass DELETEs) can race.
 *
 * `runScheduledJob(name, intervalMs, fn)` runs `fn` only when this
 * process holds the named lock. Locking strategy:
 *
 *   1. If REDIS_URL is configured, acquire a short-lived Redis lock
 *      (`SET NX PX`) keyed by job name. The TTL is slightly longer than
 *      the run interval so a crashed worker releases the lock naturally.
 *
 *   2. If Redis is unavailable, fall back to an env-gated single-runner
 *      mode: jobs only run when `RUN_SCHEDULED_JOBS === 'true'`.
 *      Operators are expected to set this on exactly one worker.
 *
 *   3. If neither Redis nor the env flag is set AND NODE_ENV !==
 *      'production', we run the job (preserves the dev/single-process
 *      experience). In production with neither, we LOG and skip — refusing
 *      to silently duplicate work.
 */

import { getRedisSync } from './redisClient';
import { logger } from './logger';

const SHOULD_RUN_ENV = () => process.env.RUN_SCHEDULED_JOBS === 'true';
const IS_PROD = () => process.env.NODE_ENV === 'production';

async function tryAcquireRedisLock(name: string, ttlMs: number): Promise<boolean> {
  const client = getRedisSync();
  if (!client) return false;
  try {
    // SET key value NX PX ttl — returns 'OK' if acquired, null otherwise.
    const result = await client.set(`sched:lock:${name}`, String(process.pid), 'PX', ttlMs, 'NX');
    return result === 'OK';
  } catch (err: any) {
    logger.warn?.('[ScheduledJobs] Redis lock acquire failed', { name, error: err?.message });
    return false;
  }
}

/**
 * Register a periodic job that should run at most once across the
 * deployment per `intervalMs`. The handle returned can be cleared on
 * shutdown.
 */
export function runScheduledJob(
  name: string,
  intervalMs: number,
  fn: () => Promise<void> | void,
): NodeJS.Timeout {
  // Lock TTL: 80% of the interval. Long enough that if we're slow we
  // don't double-fire; short enough that a crashed leader doesn't block
  // the next worker for too long.
  const lockTtlMs = Math.max(5_000, Math.floor(intervalMs * 0.8));

  const tick = async () => {
    try {
      let allowed = false;
      const redis = getRedisSync();

      if (redis) {
        allowed = await tryAcquireRedisLock(name, lockTtlMs);
      } else if (SHOULD_RUN_ENV()) {
        allowed = true;
      } else if (!IS_PROD()) {
        // Dev convenience: single-process, no Redis, no flag set — just run.
        allowed = true;
      } else {
        // Production with no Redis and no RUN_SCHEDULED_JOBS flag. Refuse
        // to run rather than silently duplicating across every worker.
        logger.warn?.(
          `[ScheduledJobs] Skipping ${name}: no Redis configured and RUN_SCHEDULED_JOBS is not 'true'. ` +
          `Set RUN_SCHEDULED_JOBS=true on exactly one worker, or configure REDIS_URL for automatic leader election.`,
        );
        return;
      }

      if (!allowed) return;

      await fn();
    } catch (err: any) {
      logger.error?.(`[ScheduledJobs] ${name} failed`, err);
    }
  };

  // Don't await the first tick — let the interval drive cadence.
  const handle = setInterval(() => { void tick(); }, intervalMs);
  // Tick once shortly after start so we don't wait a full interval for
  // the first cleanup pass.
  setTimeout(() => { void tick(); }, Math.min(intervalMs, 30_000));
  return handle;
}
