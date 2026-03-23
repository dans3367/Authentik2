/**
 * Real-time Newsletter List Hook
 *
 * Merges TanStack Query data (primary) with Convex real-time data (overlay)
 * to provide instant kanban updates without polling.
 *
 * Fallback: If Convex is unavailable, returns TanStack data as-is.
 */

import { useMemo } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useTenantNewsletterStats } from "./useNewsletterTracking";
import type { NewsletterWithUser } from "@shared/schema";

type NewsletterListItem = NewsletterWithUser & {
  opens?: number;
  totalOpens?: number;
  publishedAt?: string | null;
  webSlug?: string | null;
};

/**
 * Merge TanStack Query newsletters with Convex real-time data.
 *
 * @param tanstackNewsletters - The newsletters fetched via TanStack Query (existing, unchanged)
 * @param tenantId - Current user's tenant ID
 * @param shopId - Selected shop ID (null/undefined for all shops)
 * @param archived - Whether we're looking at the archived view
 * @param emailType - Filter by email type ('newsletter' or 'advertise')
 */
export function useRealtimeNewsletters(
  tanstackNewsletters: NewsletterListItem[] | undefined,
  tenantId: string | undefined,
  shopId?: string | null,
  archived?: boolean,
  emailType?: string,
) {
  // Subscribe to Convex real-time list items
  const convexItems = useConvexQuery(
    api.newsletterListItems.listByTenant,
    tenantId 
      ? { tenantId, shopId: shopId ?? undefined, archived: archived ?? false, emailType: emailType ?? "newsletter" } 
      : "skip",
  );

  // Subscribe to live metrics for sending newsletters
  const tenantStats = useTenantNewsletterStats(tenantId);

  const merged = useMemo(() => {
    const base = tanstackNewsletters ?? [];

    // If Convex data isn't loaded yet, return TanStack data as-is
    if (!convexItems) return base;

    // Build a map of Convex items by newsletterId for O(1) lookup
    const convexMap = new Map(convexItems.map((item) => [item.newsletterId, item]));

    // Build a stats map for live metrics overlay
    const statsMap = new Map(
      (tenantStats ?? []).map((s: any) => [s.newsletterId, s]),
    );

    // Overlay mutable fields from Convex onto TanStack items
    const updatedItems = base.map((newsletter) => {
      const convexItem = convexMap.get(newsletter.id);
      if (!convexItem) return newsletter;

      // Remove from convexMap so we can detect Convex-only items below
      convexMap.delete(newsletter.id);

      // Overlay kanban-visible mutable fields
      const overlaid: NewsletterListItem = {
        ...newsletter,
        title: convexItem.title,
        subject: convexItem.subject,
        status: convexItem.status,
        recipientCount: convexItem.recipientCount,
        openCount: convexItem.openCount,
        uniqueOpenCount: convexItem.uniqueOpenCount,
        clickCount: convexItem.clickCount,
        reviewStatus: convexItem.reviewStatus ?? newsletter.reviewStatus,
        reviewerId: convexItem.reviewerId ?? newsletter.reviewerId,
        reviewNotes: convexItem.reviewNotes ?? newsletter.reviewNotes,
        scheduledAt: convexItem.scheduledAt
          ? new Date(convexItem.scheduledAt)
          : null,
        sentAt: convexItem.sentAt ? new Date(convexItem.sentAt) : null,
        archivedAt: convexItem.archivedAt
          ? new Date(convexItem.archivedAt)
          : null,
        recipientType: convexItem.recipientType ?? newsletter.recipientType,
      };

      // Overlay live send metrics from Convex newsletterStats
      const stats = statsMap.get(newsletter.id);
      if (stats) {
        overlaid.recipientCount = stats.totalRecipients ?? overlaid.recipientCount;
        overlaid.opens = stats.uniqueOpens ?? overlaid.opens;
        overlaid.totalOpens = stats.opened ?? overlaid.totalOpens;
        overlaid.clickCount = stats.uniqueClicks ?? overlaid.clickCount;
      }

      return overlaid;
    });

    // Filter out items that appear deleted/archived in Convex but are still in TanStack cache
    const filtered = updatedItems.filter((n) => {
      const convexItem = convexItems.find((c) => c.newsletterId === n.id);
      if (!convexItem) return true; // Not tracked in Convex, keep from TanStack

      // If this item was deleted in Convex, filter it out
      if (convexItem.deletedAt) return false;

      // If viewing non-archived and item is archived in Convex, filter out
      if (!archived && convexItem.archivedAt) return false;

      // If viewing archived and item is NOT archived in Convex, filter out
      if (archived && !convexItem.archivedAt) return false;

      return true;
    });

    // Add Convex-only items (created by other users since last TanStack fetch)
    // remaining items in convexMap were not in TanStack data
    const convexOnlyItems: NewsletterListItem[] = [];
    convexMap.forEach((item) => {
      convexOnlyItems.push({
        id: item.newsletterId,
        tenantId: item.tenantId,
        userId: "", // Not available from Convex mirror
        title: item.title,
        subject: item.subject,
        content: "", // Not stored in Convex mirror
        status: item.status,
        emailType: item.emailType,
        recipientType: item.recipientType ?? "all",
        recipientCount: item.recipientCount,
        openCount: item.openCount,
        uniqueOpenCount: item.uniqueOpenCount,
        clickCount: item.clickCount,
        reviewStatus: item.reviewStatus ?? null,
        reviewerId: item.reviewerId ?? null,
        reviewNotes: item.reviewNotes ?? null,
        scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
        sentAt: item.sentAt ? new Date(item.sentAt) : null,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
        archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
        deletedAt: null,
        reactionsEnabled: true,
        publishToBlog: true,
        requiresReviewerApproval: false,
        selectedContactIds: null,
        selectedTagIds: null,
        puckData: null,
        triggerRunId: null,
        reviewerApprovalCode: null,
        reviewedAt: null,
        publishedAt: null,
        webSlug: null,
        user: {
          id: "",
          email: "",
          name: [item.authorFirstName, item.authorLastName]
            .filter(Boolean)
            .join(" ") || "Unknown",
          firstName: item.authorFirstName ?? null,
          lastName: item.authorLastName ?? null,
        } as any,
      } as any);
    });

    return [...filtered, ...convexOnlyItems];
  }, [tanstackNewsletters, convexItems, tenantStats, archived]);

  return {
    newsletters: merged,
    isRealtime: convexItems !== undefined,
  };
}
