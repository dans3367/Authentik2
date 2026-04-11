/**
 * Tenant Purge Worker
 *
 * Runs every 6 hours. Finds tenants whose 30-day grace period has ended
 * (deletion_scheduled_at <= now) and hard-deletes them via purgeTenant().
 *
 * See server/services/tenantDeletionService.ts for the purge logic.
 */

import { db } from '../db';
import { tenants } from '@shared/schema';
import { and, isNotNull, lte } from 'drizzle-orm';
import { purgeTenant } from '../services/tenantDeletionService';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let workerTimer: NodeJS.Timeout | null = null;

async function processExpiredTenants(): Promise<void> {
  try {
    const now = new Date();
    const dueTenants = await db
      .select({ id: tenants.id, name: tenants.name, deletionScheduledAt: tenants.deletionScheduledAt })
      .from(tenants)
      .where(
        and(isNotNull(tenants.deletionScheduledAt), lte(tenants.deletionScheduledAt, now)),
      );

    if (dueTenants.length === 0) {
      console.log('🗑️  [TenantPurge] No tenants due for purge');
      return;
    }

    console.log(`🗑️  [TenantPurge] Purging ${dueTenants.length} tenant(s)`);

    for (const tenant of dueTenants) {
      try {
        const result = await purgeTenant(tenant.id);
        console.log(
          `🗑️  [TenantPurge] ${tenant.id} (${tenant.name}) — success=${result.success} r2=${result.r2Deleted}/${result.r2Errors}`,
        );
      } catch (err) {
        console.error(`🗑️  [TenantPurge] Error purging tenant ${tenant.id}:`, err);
      }
    }
  } catch (err) {
    console.error('🗑️  [TenantPurge] Worker error:', err);
  }
}

export function startTenantPurgeWorker(): void {
  if (workerTimer) {
    console.log('🗑️  [TenantPurge] Worker already running');
    return;
  }

  console.log('🗑️  [TenantPurge] Starting worker (runs every 6 hours)');

  // First run after a short delay to let the server finish starting
  setTimeout(() => {
    processExpiredTenants();
  }, 30_000);

  workerTimer = setInterval(() => {
    processExpiredTenants();
  }, SIX_HOURS_MS);

  if (workerTimer.unref) {
    workerTimer.unref();
  }
}

export function stopTenantPurgeWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log('🗑️  [TenantPurge] Worker stopped');
  }
}
