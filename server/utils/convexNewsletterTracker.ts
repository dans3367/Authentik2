/**
 * Convex Newsletter Tracker (adapter)
 *
 * Newsletter-shaped API preserved for existing callers. Internally delegates
 * to the unified tracker at [[convexEmailTracker]] so newsletter and individual
 * email events share the same trackedEmail* tables.
 *
 * New code should import from convexEmailTracker directly.
 */

import {
    initEmailCampaign,
    trackEmailCampaignSend,
    trackEmailCampaignEvent,
    completeEmailCampaign,
    getCampaignStats,
    getCampaignSends,
    getCampaignEvents,
} from './convexEmailTracker';

export async function initNewsletterTracking(params: {
    tenantId: string;
    newsletterId: string;
    totalRecipients: number;
}): Promise<void> {
    return initEmailCampaign({
        tenantId: params.tenantId,
        sendType: 'newsletter',
        campaignId: params.newsletterId,
        totalRecipients: params.totalRecipients,
    });
}

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
    return trackEmailCampaignSend({
        tenantId: params.tenantId,
        sendType: 'newsletter',
        campaignId: params.newsletterId,
        groupUUID: params.groupUUID,
        recipientEmail: params.recipientEmail,
        recipientId: params.recipientId,
        recipientName: params.recipientName,
        providerMessageId: params.providerMessageId,
        status: params.status,
        error: params.error,
    });
}

export async function trackNewsletterEvent(params: {
    tenantId: string;
    newsletterId: string;
    recipientEmail: string;
    providerMessageId?: string;
    eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'failed' | 'suppressed' | 'reacted';
    metadata?: Record<string, any>;
}): Promise<void> {
    return trackEmailCampaignEvent({
        tenantId: params.tenantId,
        sendType: 'newsletter',
        campaignId: params.newsletterId,
        recipientEmail: params.recipientEmail,
        providerMessageId: params.providerMessageId,
        eventType: params.eventType,
        metadata: params.metadata,
    });
}

export async function completeNewsletterTracking(params: {
    newsletterId: string;
    sentCount: number;
    failedCount: number;
}): Promise<void> {
    return completeEmailCampaign({
        campaignId: params.newsletterId,
        sentCount: params.sentCount,
        failedCount: params.failedCount,
    });
}

export async function getNewsletterStats(newsletterId: string) {
    return getCampaignStats(newsletterId);
}

export async function getNewsletterSends(newsletterId: string, limit: number = 100) {
    return getCampaignSends(newsletterId, limit);
}

export async function getNewsletterEvents(newsletterId: string, limit: number = 50) {
    return getCampaignEvents(newsletterId, limit);
}
