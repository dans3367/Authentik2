/**
 * GDPR Activity Log Anonymization Tool
 * 
 * Anonymizes personal data (ip_address, user_agent) in activity_logs
 * for records older than the retention period (default: 12 months).
 * 
 * This satisfies GDPR Recital 30 requirements for online identifiers.
 * Should be run on a regular schedule (e.g., daily cron job).
 * 
 * Usage:
 *   npx tsx tools/anonymize-activity-logs.ts [--retention-months=12] [--dry-run]
 */

import { db } from '../server/db';
import { activityLogs } from '../shared/schema';
import { sql, lt, and, or, isNotNull } from 'drizzle-orm';

const DEFAULT_RETENTION_MONTHS = 12;

async function anonymizeActivityLogs(retentionMonths: number, dryRun: boolean) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

  console.log(`🔒 [GDPR Anonymization] Starting activity log anonymization`);
  console.log(`   Retention period: ${retentionMonths} months`);
  console.log(`   Cutoff date: ${cutoffDate.toISOString()}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Count records that need anonymization
  const countResult = await db.select({
    count: sql<number>`count(*)`,
  })
    .from(activityLogs)
    .where(
      and(
        lt(activityLogs.createdAt, cutoffDate),
        or(
          isNotNull(activityLogs.ipAddress),
          isNotNull(activityLogs.userAgent)
        )
      )
    );

  const recordCount = countResult[0]?.count || 0;
  console.log(`   Records to anonymize: ${recordCount}`);

  if (recordCount === 0) {
    console.log(`✅ [GDPR Anonymization] No records need anonymization.`);
    return;
  }

  if (dryRun) {
    console.log(`⏭️  [GDPR Anonymization] Dry run - no changes made.`);
    return;
  }

  // Anonymize in batches to avoid long-running transactions
  const BATCH_SIZE = 1000;
  let totalAnonymized = 0;

  while (totalAnonymized < recordCount) {
    const result = await db.execute(sql`
      UPDATE activity_logs
      SET ip_address = NULL, user_agent = NULL
      WHERE id IN (
        SELECT id FROM activity_logs
        WHERE created_at < ${cutoffDate}
          AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
        LIMIT ${BATCH_SIZE}
      )
    `);

    const batchCount = Number(result.rowCount) || 0;
    if (batchCount === 0) break;

    totalAnonymized += batchCount;
    console.log(`   Anonymized ${totalAnonymized}/${recordCount} records...`);
  }

  console.log(`✅ [GDPR Anonymization] Complete. ${totalAnonymized} records anonymized.`);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const retentionArg = args.find(a => a.startsWith('--retention-months='));
const retentionMonths = retentionArg
  ? parseInt(retentionArg.split('=')[1], 10)
  : DEFAULT_RETENTION_MONTHS;

anonymizeActivityLogs(retentionMonths, dryRun)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [GDPR Anonymization] Failed:', err);
    process.exit(1);
  });
