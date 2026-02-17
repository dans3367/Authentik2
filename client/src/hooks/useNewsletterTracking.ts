/**
 * Real-time Newsletter Tracking Hooks
 * 
 * Uses Convex's useQuery for live-updating newsletter stats,
 * individual email sends, and event feeds.
 * 
 * These hooks automatically re-render when data changes in Convex,
 * providing real-time updates without polling.
 */

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Get real-time stats for a specific newsletter.
 * Returns live-updating counts for sent, delivered, opened, clicked, etc.
 */
export function useNewsletterStats(newsletterId: string | undefined) {
  return useQuery(
    api.newsletterTracking.getNewsletterStats,
    newsletterId ? { newsletterId } : "skip"
  );
}

/**
 * Get all newsletter stats for the current tenant (dashboard overview).
 */
export function useTenantNewsletterStats(tenantId: string | undefined) {
  return useQuery(
    api.newsletterTracking.getTenantNewsletterStats,
    tenantId ? { tenantId } : "skip"
  );
}

/**
 * Get individual email sends for a newsletter (paginated list).
 */
export function useNewsletterSends(
  newsletterId: string | undefined,
  options?: { status?: string; limit?: number }
) {
  return useQuery(
    api.newsletterTracking.getNewsletterSends,
    newsletterId
      ? {
          newsletterId,
          status: options?.status,
          limit: options?.limit,
        }
      : "skip"
  );
}

/**
 * Get recent events for a newsletter (live event feed).
 */
export function useNewsletterEvents(
  newsletterId: string | undefined,
  options?: { eventType?: string; limit?: number }
) {
  return useQuery(
    api.newsletterTracking.getNewsletterEvents,
    newsletterId
      ? {
          newsletterId,
          eventType: options?.eventType,
          limit: options?.limit,
        }
      : "skip"
  );
}

/**
 * Get the full trajectory of a single email send.
 */
export function useEmailTrajectory(newsletterSendId: Id<"newsletterSends"> | undefined) {
  return useQuery(
    api.newsletterTracking.getEmailTrajectory,
    newsletterSendId ? { newsletterSendId } : "skip"
  );
}

/**
 * Get status breakdown for charts (pie/bar).
 */
export function useStatusBreakdown(newsletterId: string | undefined) {
  return useQuery(
    api.newsletterTracking.getStatusBreakdown,
    newsletterId ? { newsletterId } : "skip"
  );
}
