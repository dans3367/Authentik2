/**
 * GDPR Newsletter Reaction Anonymization Tool
 *
 * Anonymizes personal data (ip_address, user_agent) in newsletter_reactions
 * after the retention window expires.
 *
 * Retention behavior:
 * - Uses reacted_retention_expires when present.
 * - Falls back to reacted_at + retentionMonths for legacy rows.
 * - Marks reacted_anonymized_at when anonymization is applied.
 *
 * Usage:
 *   npx tsx tools/anonymize-newsletter-reactions.ts [--retention-months=12] [--dry-run]
 */

import { and, isNull, or, sql } from 'drizzle-orm';
import { db } from '../server/db';
import { newsletterReactions } from '../shared/schema';

const DEFAULT_RETENTION_MONTHS = 12;

function parseRetentionMonths(args: string[]): number {
  const retentionArg = args.find((a) => a.startsWith('--retention-months='));
  const parsed = retentionArg
    ? Number(retentionArg.split('=')[1])
    : DEFAULT_RETENTION_MONTHS;

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid --retention-months value. Expected a non-negative number.');
  }

  return Math.floor(parsed);
}

async function countCandidates(retentionMonths: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

  const result = await db.select({ count: sql<number>`count(*)` })
    .from(newsletterReactions)
    .where(
      and(
        isNull(newsletterReactions.reactedAnonymizedAt),
        or(
          sql`${newsletterReactions.reactedRetentionExpires} <= now()`,
          sql`(
            ${newsletterReactions.reactedRetentionExpires} IS NULL
            AND ${newsletterReactions.reactedAt} <= ${cutoffDate}
          )`
        ),
        or(
          sql`${newsletterReactions.ipAddress} IS NOT NULL`,
          sql`${newsletterReactions.userAgent} IS NOT NULL`
        )
      )
    );

  return result[0]?.count || 0;
}

async function anonymizeNewsletterReactions(retentionMonths: number, dryRun: boolean) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

  console.log('🔒 [GDPR Anonymization] Starting newsletter reaction anonymization');
  console.log(`   Retention period: ${retentionMonths} months`);
  console.log(`   Cutoff date: ${cutoffDate.toISOString()}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const candidateCount = await countCandidates(retentionMonths);
  console.log(`   Records to anonymize: ${candidateCount}`);

  if (candidateCount === 0) {
    console.log('✅ [GDPR Anonymization] No records need anonymization.');
    return;
  }

  if (dryRun) {
    console.log('⏭️  [GDPR Anonymization] Dry run - no changes made.');
    return;
  }

  const BATCH_SIZE = 1000;
  let totalAnonymized = 0;

  while (totalAnonymized < candidateCount) {
    const result = await db.execute(sql`
      UPDATE newsletter_reactions
      SET
        ip_address = NULL,
        user_agent = NULL,
        reacted_anonymized_at = now()
      WHERE id IN (
        SELECT id
        FROM newsletter_reactions
        WHERE reacted_anonymized_at IS NULL
          AND (
            reacted_retention_expires <= now()
            OR (
              reacted_retention_expires IS NULL
              AND reacted_at <= ${cutoffDate}
            )
          )
          AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
        LIMIT ${BATCH_SIZE}
      )
    `);

    const batchCount = Number(result.rowCount) || 0;
    if (batchCount === 0) break;

    totalAnonymized += batchCount;
    console.log(`   Anonymized ${totalAnonymized}/${candidateCount} records...`);
  }

  console.log(`✅ [GDPR Anonymization] Complete. ${totalAnonymized} records anonymized.`);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

let retentionMonths = DEFAULT_RETENTION_MONTHS;
try {
  retentionMonths = parseRetentionMonths(args);
} catch (error) {
  console.error(`❌ [GDPR Anonymization] ${(error as Error).message}`);
  process.exit(1);
}

anonymizeNewsletterReactions(retentionMonths, dryRun)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [GDPR Anonymization] Failed:', err);
    process.exit(1);
  });
