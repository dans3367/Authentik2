/**
 * One-time script to populate Convex newsletterListItems from existing PostgreSQL data.
 *
 * Usage: npx tsx scripts/sync-newsletters-to-convex.ts
 *
 * Idempotent — safe to re-run. Uses upsert so existing items are updated.
 */

import 'dotenv/config';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { db } from '../server/db';
import { newsletters } from '@shared/schema';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 100;

async function main() {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error('CONVEX_URL environment variable is not set.');
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  console.log('[SyncScript] Connected to Convex at', convexUrl);

  // Fetch all non-hard-deleted newsletters with user relations
  const allNewsletters = await db.query.newsletters.findMany({
    where: sql`${newsletters.deletedAt} IS NULL`,
    with: { user: true },
    orderBy: sql`${newsletters.createdAt} DESC`,
  });

  console.log(`[SyncScript] Found ${allNewsletters.length} newsletters to sync.`);

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < allNewsletters.length; i += BATCH_SIZE) {
    const batch = allNewsletters.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((nl: any) =>
        client.mutation(api.newsletterListItems.upsertItem, {
          tenantId: nl.tenantId,
          newsletterId: nl.id,
          title: nl.title,
          subject: nl.subject,
          status: nl.status,
          emailType: nl.emailType || 'newsletter',
          recipientCount: nl.recipientCount ?? 0,
          openCount: nl.openCount ?? 0,
          uniqueOpenCount: nl.uniqueOpenCount ?? 0,
          clickCount: nl.clickCount ?? 0,
          reviewStatus: nl.reviewStatus ?? undefined,
          reviewerId: nl.reviewerId ?? undefined,
          reviewNotes: nl.reviewNotes ?? undefined,
          scheduledAt: nl.scheduledAt ? new Date(nl.scheduledAt).getTime() : undefined,
          sentAt: nl.sentAt ? new Date(nl.sentAt).getTime() : undefined,
          createdAt: nl.createdAt ? new Date(nl.createdAt).getTime() : Date.now(),
          updatedAt: nl.updatedAt ? new Date(nl.updatedAt).getTime() : Date.now(),
          archivedAt: nl.archivedAt ? new Date(nl.archivedAt).getTime() : undefined,
          deletedAt: nl.deletedAt ? new Date(nl.deletedAt).getTime() : undefined,
          authorFirstName: nl.user?.firstName ?? undefined,
          authorLastName: nl.user?.lastName ?? undefined,
          recipientType: nl.recipientType ?? undefined,
        }),
      ),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        synced++;
      } else {
        failed++;
        console.error('[SyncScript] Failed to sync:', result.reason);
      }
    }

    console.log(`[SyncScript] Progress: ${Math.min(i + BATCH_SIZE, allNewsletters.length)}/${allNewsletters.length} (synced: ${synced}, failed: ${failed})`);
  }

  console.log(`[SyncScript] Done. Synced: ${synced}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[SyncScript] Fatal error:', err);
  process.exit(1);
});
