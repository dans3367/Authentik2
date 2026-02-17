/**
 * Convex Newsletter Tracker
 * 
 * Convenience wrapper around Convex mutations for tracking newsletter
 * sends and events. All calls are fire-and-forget to avoid blocking
 * the main email sending flow.
 */

import { getConvexClient, api } from './convexClient';

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
    status: 'queued' | 'sent' | 'failed';
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
    eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'failed';
    metadata?: Record<string, any>;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;

        await client.mutation(api.newsletterTracking.trackEmailEvent, {
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
