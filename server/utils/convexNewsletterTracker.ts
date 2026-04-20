/**
 * Convex Newsletter Tracker
 * 
 * Convenience wrapper around Convex mutations for tracking newsletter
 * sends and events. All calls are fire-and-forget to avoid blocking
 * the main email sending flow.
 */

import { getConvexClient, api, internal } from './convexClient';

/**
 * Initialize tracking for a newsletter send campaign.
 */
export async function initNewsletterTracking(params: {
    tenantId: string;
    newsletterId: string;
    totalRecipients: number;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;

        await client.mutation(api.newsletterTracking.initNewsletterSend, {
            tenantId: params.tenantId,
            newsletterId: params.newsletterId,
            totalRecipients: params.totalRecipients,
        });
    } catch (error) {
        console.error('[ConvexTracker] Failed to init newsletter tracking:', error);
    }
}

/**
 * Track an individual email send within a newsletter.
 */
export async function trackNewsletterEmailSend(params: {
    tenantId: string;
    newsletterId: string;
    groupUUID: string;
    recipientEmail: string;
    recipientId?: string;
    recipientName?: string;
    providerMessageId?: string;
    status: 'queued' | 'sent' | 'failed' | 'suppressed';
    error?: string;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;

        await client.mutation(api.newsletterTracking.trackEmailSend, {
            tenantId: params.tenantId,
            newsletterId: params.newsletterId,
            groupUUID: params.groupUUID,
            recipientEmail: params.recipientEmail,
            recipientId: params.recipientId,
            recipientName: params.recipientName,
            providerMessageId: params.providerMessageId,
            status: params.status,
            error: params.error,
        });
    } catch (error) {
        console.error('[ConvexTracker] Failed to track email send:', error);
    }
}

/**
 * Track a webhook event (delivered, opened, clicked, bounced, etc.).
 */
export async function trackNewsletterEvent(params: {
    tenantId: string;
    newsletterId: string;
    recipientEmail: string;
    providerMessageId?: string;
    eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'failed' | 'suppressed' | 'reacted';
    metadata?: Record<string, any>;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;

        await client.mutation(internal.newsletterTracking.trackEmailEvent as any, {
            tenantId: params.tenantId,
            newsletterId: params.newsletterId,
            recipientEmail: params.recipientEmail,
            providerMessageId: params.providerMessageId,
            eventType: params.eventType,
            metadata: params.metadata,
        });
    } catch (error) {
        console.error('[ConvexTracker] Failed to track email event:', error);
    }
}

/**
 * Mark a newsletter send campaign as completed.
 */
export async function completeNewsletterTracking(params: {
    newsletterId: string;
    sentCount: number;
    failedCount: number;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;

        await client.mutation(api.newsletterTracking.completeNewsletterSend, {
            newsletterId: params.newsletterId,
            sentCount: params.sentCount,
            failedCount: params.failedCount,
        });
    } catch (error) {
        console.error('[ConvexTracker] Failed to complete newsletter tracking:', error);
    }
}

/**
 * Get newsletter stats from Convex.
 */
export async function getNewsletterStats(newsletterId: string): Promise<{
    totalRecipients: number;
    sent: number;
    delivered: number;
    opened: number;
    uniqueOpens: number;
    clicked: number;
    uniqueClicks: number;
    bounced: number;
    complained: number;
    failed: number;
    suppressed: number;
    unsubscribed: number;
} | null> {
    try {
        const client = getConvexClient();
        if (!client) return null;

        const stats = await client.query(api.newsletterTracking.getNewsletterStats, {
            newsletterId,
        });

        if (!stats) return null;

        return {
            totalRecipients: stats.totalRecipients ?? 0,
            sent: stats.sent ?? 0,
            delivered: stats.delivered ?? 0,
            opened: stats.opened ?? 0,
            uniqueOpens: stats.uniqueOpens ?? 0,
            clicked: stats.clicked ?? 0,
            uniqueClicks: stats.uniqueClicks ?? 0,
            bounced: stats.bounced ?? 0,
            complained: stats.complained ?? 0,
            failed: stats.failed ?? 0,
            suppressed: stats.suppressed ?? 0,
            unsubscribed: stats.unsubscribed ?? 0,
        };
    } catch (error) {
        console.error('[ConvexTracker] Failed to get newsletter stats:', error);
        return null;
    }
}

/**
 * Get newsletter sends (individual email records) from Convex.
 */
export async function getNewsletterSends(newsletterId: string, limit: number = 100): Promise<Array<{
    recipientEmail: string;
    recipientId?: string;
    status: string;
    sentAt?: number;
    deliveredAt?: number;
    firstOpenedAt?: number;
    firstClickedAt?: number;
    openCount: number;
    clickCount: number;
    error?: string;
}>> {
    try {
        const client = getConvexClient();
        if (!client) return [];

        const sends = await client.query(api.newsletterTracking.getNewsletterSends, {
            newsletterId,
            limit,
        });

        return sends || [];
    } catch (error) {
        console.error('[ConvexTracker] Failed to get newsletter sends:', error);
        return [];
    }
}

/**
 * Get newsletter events from Convex.
 */
export async function getNewsletterEvents(newsletterId: string, limit: number = 50): Promise<Array<{
    recipientEmail: string;
    eventType: string;
    occurredAt: number;
    metadata?: any;
}>> {
    try {
        const client = getConvexClient();
        if (!client) return [];

        const events = await client.query(api.newsletterTracking.getNewsletterEvents, {
            newsletterId,
            limit,
        });

        return events || [];
    } catch (error) {
        console.error('[ConvexTracker] Failed to get newsletter events:', error);
        return [];
    }
}
