/**
 * Convex Newsletter List Sync
 *
 * Fire-and-forget helper that mirrors kanban-relevant newsletter fields
 * to Convex for real-time kanban updates. All calls are non-fatal —
 * if Convex is unavailable the PostgreSQL write has already succeeded.
 */

import { getConvexClient, api } from './convexClient';

/** Fields we read from a PostgreSQL newsletter row (with user relation). */
interface NewsletterSyncPayload {
  id: string;
  tenantId: string;
  shopId?: string | null;
  title: string;
  subject: string;
  status: string;
  emailType?: string | null;
  recipientCount?: number | null;
  openCount?: number | null;
  uniqueOpenCount?: number | null;
  clickCount?: number | null;
  reviewStatus?: string | null;
  reviewerId?: string | null;
  reviewNotes?: string | null;
  scheduledAt?: Date | string | null;
  sentAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  archivedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  recipientType?: string | null;
  user?: { firstName?: string | null; lastName?: string | null } | null;
}

/** Convert a Date | string | null/undefined to ms-since-epoch or undefined. */
function toMs(val: Date | string | null | undefined): number | undefined {
  if (!val) return undefined;
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? undefined : d.getTime();
}

/**
 * Sync a newsletter row to Convex (upsert).
 * Call this fire-and-forget after any PostgreSQL write that changes kanban-visible fields.
 */
export async function syncNewsletterToConvex(newsletter: NewsletterSyncPayload): Promise<void> {
  try {
    const client = getConvexClient();
    if (!client) return;

    await client.mutation(api.newsletterListItems.upsertItem, {
      tenantId: newsletter.tenantId,
      shopId: newsletter.shopId ?? undefined,
      newsletterId: newsletter.id,
      title: newsletter.title,
      subject: newsletter.subject,
      status: newsletter.status,
      emailType: newsletter.emailType || 'newsletter',
      recipientCount: newsletter.recipientCount ?? 0,
      openCount: newsletter.openCount ?? 0,
      uniqueOpenCount: newsletter.uniqueOpenCount ?? 0,
      clickCount: newsletter.clickCount ?? 0,
      reviewStatus: newsletter.reviewStatus ?? undefined,
      reviewerId: newsletter.reviewerId ?? undefined,
      reviewNotes: newsletter.reviewNotes ?? undefined,
      scheduledAt: toMs(newsletter.scheduledAt),
      sentAt: toMs(newsletter.sentAt),
      createdAt: toMs(newsletter.createdAt) ?? Date.now(),
      updatedAt: toMs(newsletter.updatedAt) ?? Date.now(),
      archivedAt: toMs(newsletter.archivedAt),
      deletedAt: toMs(newsletter.deletedAt),
      authorFirstName: newsletter.user?.firstName ?? undefined,
      authorLastName: newsletter.user?.lastName ?? undefined,
      recipientType: newsletter.recipientType ?? undefined,
    });
  } catch (error) {
    console.warn('[ConvexListSync] Failed to sync newsletter to Convex (non-fatal):', error);
  }
}

/**
 * Remove a newsletter from Convex (hard-delete).
 * Called when a draft is permanently deleted from PostgreSQL.
 */
export async function removeNewsletterFromConvex(newsletterId: string): Promise<void> {
  try {
    const client = getConvexClient();
    if (!client) return;

    await client.mutation(api.newsletterListItems.removeItem, {
      newsletterId,
    });
  } catch (error) {
    console.warn('[ConvexListSync] Failed to remove newsletter from Convex (non-fatal):', error);
  }
}
