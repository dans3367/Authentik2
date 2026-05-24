/**
 * Real-time email tracking hooks.
 *
 * Backed by Convex's emailTracking module which unifies newsletter and
 * individual one-off email events. Hook names retain the "Newsletter"
 * prefix for backwards compat with existing call sites — for newsletter
 * data, pass the newsletter UUID as the campaignId.
 *
 * These hooks automatically re-render when data changes in Convex,
 * providing real-time updates without polling.
 */

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function useNewsletterStats(newsletterId: string | undefined) {
  return useQuery(
    api.emailTracking.getCampaignStats,
    newsletterId ? { campaignId: newsletterId } : "skip"
  );
}

export function useTenantNewsletterStats(tenantId: string | undefined) {
  return useQuery(
    api.emailTracking.getTenantCampaignStats,
    tenantId ? { tenantId, sendType: "newsletter" } : "skip"
  );
}

export function useTenantRecentEvents(
  tenantId: string | undefined,
  limit?: number,
  sendType?: "newsletter" | "individual",
) {
  return useQuery(
    api.emailTracking.getTenantRecentEvents,
    tenantId ? { tenantId, limit, sendType } : "skip",
  );
}

export function useNewsletterSends(
  newsletterId: string | undefined,
  options?: { status?: string; limit?: number }
) {
  return useQuery(
    api.emailTracking.getCampaignSends,
    newsletterId
      ? {
          campaignId: newsletterId,
          status: options?.status,
          limit: options?.limit,
        }
      : "skip"
  );
}

export function useNewsletterEvents(
  newsletterId: string | undefined,
  options?: { eventType?: string; limit?: number }
) {
  return useQuery(
    api.emailTracking.getCampaignEvents,
    newsletterId
      ? {
          campaignId: newsletterId,
          eventType: options?.eventType,
          limit: options?.limit,
        }
      : "skip"
  );
}

export function useEmailTrajectory(trackedSendId: Id<"trackedEmailSends"> | undefined) {
  return useQuery(
    api.emailTracking.getEmailTrajectory,
    trackedSendId ? { trackedSendId } : "skip"
  );
}

export function useStatusBreakdown(newsletterId: string | undefined) {
  return useQuery(
    api.emailTracking.getStatusBreakdown,
    newsletterId ? { campaignId: newsletterId } : "skip"
  );
}
