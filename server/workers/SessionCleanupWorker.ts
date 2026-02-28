import { db } from '../db';
import { betterAuthSession } from '@shared/schema';
import { lt, sql } from 'drizzle-orm';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let cleanupTimer: NodeJS.Timeout | null = null;

async function cleanupStaleSessions(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    console.log(`🧹 [SessionCleanup] Running cleanup — removing sessions older than ${cutoff.toISOString()}`);

    const deleted = await db.delete(betterAuthSession)
      .where(lt(betterAuthSession.createdAt, cutoff))
      .returning({ id: betterAuthSession.id });

    const count = deleted.length;
    if (count > 0) {
      console.log(`🧹 [SessionCleanup] Removed ${count} stale session(s)`);
    } else {
      console.log(`🧹 [SessionCleanup] No stale sessions found`);
    }

    return count;
  } catch (error) {
    console.error('❌ [SessionCleanup] Error during cleanup:', error);
    return 0;
  }
}

export function startSessionCleanupWorker(): void {
  if (cleanupTimer) {
    console.log('🧹 [SessionCleanup] Worker already running');
    return;
  }

  console.log('🧹 [SessionCleanup] Starting worker (runs every 24 hours)');

  // Run an initial cleanup after a short delay to let the server finish starting
  setTimeout(() => {
    cleanupStaleSessions();
  }, 10_000);

  // Schedule recurring cleanup every 24 hours
  cleanupTimer = setInterval(() => {
    cleanupStaleSessions();
  }, TWENTY_FOUR_HOURS);

  // Allow the process to exit even if the timer is still running
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

export function stopSessionCleanupWorker(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('🧹 [SessionCleanup] Worker stopped');
  }
}
