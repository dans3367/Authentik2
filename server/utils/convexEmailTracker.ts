/**
 * Convex Email Tracker (server-side)
 *
 * Unified live tracking for newsletter campaigns and one-off individual
 * emails. All calls are fire-and-forget — failure logs and returns rather
 * than blocking the email send.
 */

import { getConvexClient, api, internal } from './convexClient';

export type SendType = 'newsletter' | 'individual';

export function buildCampaignId(sendType: SendType, sourceId: string): string {
    return sendType === 'individual' ? `individual:${sourceId}` : sourceId;
}

export async function initEmailCampaign(params: {
    tenantId: string;
    sendType: SendType;
    campaignId: string;
    totalRecipients: number;
    shopId?: string;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;
        await client.mutation(api.emailTracking.initEmailCampaign, {
            tenantId: params.tenantId,
            sendType: params.sendType,
            campaignId: params.campaignId,
            totalRecipients: params.totalRecipients,
            shopId: params.shopId,
        });
    } catch (error) {
        console.error('[ConvexEmailTracker] initEmailCampaign failed:', error);
    }
}

export async function trackEmailCampaignSend(params: {
    tenantId: string;
    sendType: SendType;
    campaignId: string;
    groupUUID?: string;
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
        await client.mutation(api.emailTracking.trackEmailSend, {
            tenantId: params.tenantId,
            sendType: params.sendType,
            campaignId: params.campaignId,
            groupUUID: params.groupUUID,
            recipientEmail: params.recipientEmail,
            recipientId: params.recipientId,
            recipientName: params.recipientName,
            providerMessageId: params.providerMessageId,
            status: params.status,
            error: params.error,
        });
    } catch (error) {
        console.error('[ConvexEmailTracker] trackEmailCampaignSend failed:', error);
    }
}

export async function trackEmailCampaignEvent(params: {
    tenantId: string;
    sendType: SendType;
    campaignId: string;
    recipientEmail: string;
    providerMessageId?: string;
    eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'failed' | 'suppressed' | 'reacted';
    metadata?: Record<string, any>;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;
        await client.mutation(internal.emailTracking.trackEmailEvent as any, {
            tenantId: params.tenantId,
            sendType: params.sendType,
            campaignId: params.campaignId,
            recipientEmail: params.recipientEmail,
            providerMessageId: params.providerMessageId,
            eventType: params.eventType,
            metadata: params.metadata,
        });
    } catch (error) {
        console.error('[ConvexEmailTracker] trackEmailCampaignEvent failed:', error);
    }
}

export async function completeEmailCampaign(params: {
    campaignId: string;
    sentCount: number;
    failedCount: number;
}): Promise<void> {
    try {
        const client = getConvexClient();
        if (!client) return;
        await client.mutation(api.emailTracking.completeEmailCampaign, {
            campaignId: params.campaignId,
            sentCount: params.sentCount,
            failedCount: params.failedCount,
        });
    } catch (error) {
        console.error('[ConvexEmailTracker] completeEmailCampaign failed:', error);
    }
}

export async function getCampaignStats(campaignId: string): Promise<{
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

        const stats = await client.query(api.emailTracking.getCampaignStats, {
            campaignId,
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
        console.error('[ConvexEmailTracker] getCampaignStats failed:', error);
        return null;
    }
}

export async function getCampaignSends(campaignId: string, limit: number = 100): Promise<Array<{
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

        const sends = await client.query(api.emailTracking.getCampaignSends, {
            campaignId,
            limit,
        });

        return sends || [];
    } catch (error) {
        console.error('[ConvexEmailTracker] getCampaignSends failed:', error);
        return [];
    }
}

export async function getCampaignEvents(campaignId: string, limit: number = 50): Promise<Array<{
    recipientEmail: string;
    eventType: string;
    occurredAt: number;
    metadata?: any;
}>> {
    try {
        const client = getConvexClient();
        if (!client) return [];

        const events = await client.query(api.emailTracking.getCampaignEvents, {
            campaignId,
            limit,
        });

        return events || [];
    } catch (error) {
        console.error('[ConvexEmailTracker] getCampaignEvents failed:', error);
        return [];
    }
}
