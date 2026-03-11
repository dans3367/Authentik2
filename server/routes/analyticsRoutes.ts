import { Router } from 'express';
import { db } from '../db';
import { sql, and, eq, gte, lte, inArray } from 'drizzle-orm';
import {
  newsletters,
  forms,
  formResponses,
  promotions,
  emailSends,
  emailEvents,
  convexNewsletterStats,
  convexNewsletterSends,
} from '@shared/schema';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';

export const analyticsRoutes = Router();

// Get all available items (newsletters, forms, promotions) for selection
analyticsRoutes.get("/items", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Fetch newsletters (sent ones have analytics)
    const newsletterItems = await db.select({
      id: newsletters.id,
      title: newsletters.title,
      status: newsletters.status,
      sentAt: newsletters.sentAt,
      createdAt: newsletters.createdAt,
      recipientCount: newsletters.recipientCount,
    })
      .from(newsletters)
      .where(and(
        eq(newsletters.tenantId, tenantId),
        eq(newsletters.status, 'sent'),
        sql`${newsletters.deletedAt} IS NULL`
      ))
      .orderBy(sql`${newsletters.createdAt} DESC`);

    // Fetch forms
    const formItems = await db.select({
      id: forms.id,
      title: forms.title,
      category: forms.category,
      isActive: forms.isActive,
      responseCount: forms.responseCount,
      createdAt: forms.createdAt,
    })
      .from(forms)
      .where(eq(forms.tenantId, tenantId))
      .orderBy(sql`${forms.createdAt} DESC`);

    // Fetch promotions
    const promotionItems = await db.select({
      id: promotions.id,
      title: promotions.title,
      type: promotions.type,
      isActive: promotions.isActive,
      usageCount: promotions.usageCount,
      createdAt: promotions.createdAt,
    })
      .from(promotions)
      .where(eq(promotions.tenantId, tenantId))
      .orderBy(sql`${promotions.createdAt} DESC`);

    res.json({
      newsletters: newsletterItems.map(n => ({
        ...n,
        itemType: 'newsletter' as const,
      })),
      forms: formItems.map(f => ({
        ...f,
        itemType: 'form' as const,
      })),
      promotions: promotionItems.map(p => ({
        ...p,
        itemType: 'promotion' as const,
      })),
    });
  } catch (error) {
    console.error('Get analytics items error:', error);
    res.status(500).json({ message: 'Failed to get analytics items' });
  }
});

// Get aggregated analytics for selected items within a date range
analyticsRoutes.post("/aggregate", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { selectedItems, startDate, endDate } = req.body;

    if (!selectedItems || !Array.isArray(selectedItems) || selectedItems.length === 0) {
      return res.status(400).json({ message: 'At least one item must be selected' });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    // Set end to end of day
    end.setHours(23, 59, 59, 999);

    const newsletterIds = selectedItems.filter((i: any) => i.type === 'newsletter').map((i: any) => i.id);
    const formIds = selectedItems.filter((i: any) => i.type === 'form').map((i: any) => i.id);
    const promotionIds = selectedItems.filter((i: any) => i.type === 'promotion').map((i: any) => i.id);

    // --- Newsletter analytics ---
    let newsletterAnalytics: any = {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalUniqueOpens: 0,
      totalClicked: 0,
      totalUniqueClicks: 0,
      totalBounced: 0,
      totalFailed: 0,
      totalUnsubscribed: 0,
      totalSuppressed: 0,
      perNewsletter: [],
    };

    if (newsletterIds.length > 0) {
      // Get stats from convex_newsletter_stats
      const stats = await db.select()
        .from(convexNewsletterStats)
        .where(and(
          eq(convexNewsletterStats.tenantId, tenantId),
          inArray(convexNewsletterStats.newsletterId, newsletterIds),
        ));

      // Get newsletter details for each
      const nlDetails = await db.select({
        id: newsletters.id,
        title: newsletters.title,
        subject: newsletters.subject,
        sentAt: newsletters.sentAt,
        recipientCount: newsletters.recipientCount,
        status: newsletters.status,
      })
        .from(newsletters)
        .where(and(
          eq(newsletters.tenantId, tenantId),
          inArray(newsletters.id, newsletterIds),
        ));

      const nlMap = new Map(nlDetails.map(n => [n.id, n]));

      for (const stat of stats) {
        const nl = nlMap.get(stat.newsletterId);
        // Filter by date range using newsletter sentAt or stat startedAt
        const sentDate = nl?.sentAt || stat.startedAt;
        if (sentDate && (sentDate < start || sentDate > end)) continue;

        newsletterAnalytics.totalSent += stat.sent || 0;
        newsletterAnalytics.totalDelivered += stat.delivered || 0;
        newsletterAnalytics.totalOpened += stat.opened || 0;
        newsletterAnalytics.totalUniqueOpens += stat.uniqueOpens || 0;
        newsletterAnalytics.totalClicked += stat.clicked || 0;
        newsletterAnalytics.totalUniqueClicks += stat.uniqueClicks || 0;
        newsletterAnalytics.totalBounced += stat.bounced || 0;
        newsletterAnalytics.totalFailed += stat.failed || 0;
        newsletterAnalytics.totalUnsubscribed += stat.unsubscribed || 0;
        newsletterAnalytics.totalSuppressed += stat.suppressed || 0;

        newsletterAnalytics.perNewsletter.push({
          id: stat.newsletterId,
          title: nl?.title || 'Unknown',
          subject: nl?.subject || '',
          sentAt: nl?.sentAt,
          sent: stat.sent || 0,
          delivered: stat.delivered || 0,
          opened: stat.opened || 0,
          uniqueOpens: stat.uniqueOpens || 0,
          clicked: stat.clicked || 0,
          uniqueClicks: stat.uniqueClicks || 0,
          bounced: stat.bounced || 0,
          failed: stat.failed || 0,
          unsubscribed: stat.unsubscribed || 0,
          suppressed: stat.suppressed || 0,
          openRate: (stat.delivered || 0) > 0 ? Math.round(((stat.uniqueOpens || 0) / (stat.delivered || 1)) * 1000) / 10 : 0,
          clickRate: (stat.delivered || 0) > 0 ? Math.round(((stat.uniqueClicks || 0) / (stat.delivered || 1)) * 1000) / 10 : 0,
        });
      }

      // For newsletters without convex stats, fall back to newsletter table data
      for (const nl of nlDetails) {
        if (stats.find(s => s.newsletterId === nl.id)) continue;
        const sentDate = nl.sentAt;
        if (sentDate && (sentDate < start || sentDate > end)) continue;
        if (nl.status !== 'sent' && nl.status !== 'sending') continue;

        newsletterAnalytics.totalSent += nl.recipientCount || 0;
        newsletterAnalytics.perNewsletter.push({
          id: nl.id,
          title: nl.title,
          subject: nl.subject,
          sentAt: nl.sentAt,
          sent: nl.recipientCount || 0,
          delivered: 0,
          opened: 0,
          uniqueOpens: 0,
          clicked: 0,
          uniqueClicks: 0,
          bounced: 0,
          failed: 0,
          unsubscribed: 0,
          suppressed: 0,
          openRate: 0,
          clickRate: 0,
        });
      }
    }

    // --- Form analytics ---
    let formAnalytics: any = {
      totalResponses: 0,
      perForm: [],
    };

    if (formIds.length > 0) {
      const formDetails = await db.select({
        id: forms.id,
        title: forms.title,
        category: forms.category,
        responseCount: forms.responseCount,
        createdAt: forms.createdAt,
      })
        .from(forms)
        .where(and(
          eq(forms.tenantId, tenantId),
          inArray(forms.id, formIds),
        ));

      // Get response counts within date range for each form
      for (const form of formDetails) {
        const [responseData] = await db.select({
          count: sql<number>`count(*)`,
        })
          .from(formResponses)
          .where(and(
            eq(formResponses.formId, form.id),
            eq(formResponses.tenantId, tenantId),
            gte(formResponses.submittedAt, start),
            lte(formResponses.submittedAt, end),
          ));

        const count = responseData?.count || 0;
        formAnalytics.totalResponses += count;
        formAnalytics.perForm.push({
          id: form.id,
          title: form.title,
          category: form.category,
          responsesInRange: count,
          totalResponses: form.responseCount || 0,
        });
      }
    }

    // --- Promotion analytics (email sends tied to promotions) ---
    let promotionAnalytics: any = {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalBounced: 0,
      perPromotion: [],
    };

    if (promotionIds.length > 0) {
      const promoDetails = await db.select({
        id: promotions.id,
        title: promotions.title,
        type: promotions.type,
        usageCount: promotions.usageCount,
        createdAt: promotions.createdAt,
      })
        .from(promotions)
        .where(and(
          eq(promotions.tenantId, tenantId),
          inArray(promotions.id, promotionIds),
        ));

      for (const promo of promoDetails) {
        // Get email sends linked to this promotion within date range
        const [sendStats] = await db.select({
          totalSent: sql<number>`count(*)`,
          totalDelivered: sql<number>`count(*) filter (where ${emailSends.status} = 'delivered')`,
          totalBounced: sql<number>`count(*) filter (where ${emailSends.status} = 'bounced')`,
        })
          .from(emailSends)
          .where(and(
            eq(emailSends.tenantId, tenantId),
            eq(emailSends.promotionId, promo.id),
            gte(emailSends.createdAt, start),
            lte(emailSends.createdAt, end),
          ));

        // Count opened events from email_events for this promotion's sends
        const [openStats] = await db.select({
          totalOpened: sql<number>`count(distinct ${emailEvents.emailSendId})`,
        })
          .from(emailEvents)
          .innerJoin(emailSends, eq(emailEvents.emailSendId, emailSends.id))
          .where(and(
            eq(emailSends.tenantId, tenantId),
            eq(emailSends.promotionId, promo.id),
            eq(emailEvents.eventType, 'opened'),
            gte(emailEvents.occurredAt, start),
            lte(emailEvents.occurredAt, end),
          ));

        const sent = sendStats?.totalSent || 0;
        const delivered = sendStats?.totalDelivered || 0;
        const bounced = sendStats?.totalBounced || 0;
        const opened = openStats?.totalOpened || 0;

        promotionAnalytics.totalSent += sent;
        promotionAnalytics.totalDelivered += delivered;
        promotionAnalytics.totalOpened += opened;
        promotionAnalytics.totalBounced += bounced;

        promotionAnalytics.perPromotion.push({
          id: promo.id,
          title: promo.title,
          type: promo.type,
          usageCount: promo.usageCount || 0,
          sent,
          delivered,
          opened,
          bounced,
          openRate: delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0,
        });
      }
    }

    // --- Timeline data (daily aggregation for charts) ---
    let timelineData: any[] = [];

    if (newsletterIds.length > 0) {
      // Build daily timeline from convex_newsletter_sends
      const dailySends = await db.select({
        date: sql<string>`DATE(${convexNewsletterSends.createdAt})`,
        sent: sql<number>`count(*)`,
        delivered: sql<number>`count(*) filter (where ${convexNewsletterSends.status} = 'delivered' OR ${convexNewsletterSends.status} = 'sent')`,
        opened: sql<number>`count(*) filter (where ${convexNewsletterSends.openCount} > 0)`,
        clicked: sql<number>`count(*) filter (where ${convexNewsletterSends.clickCount} > 0)`,
        bounced: sql<number>`count(*) filter (where ${convexNewsletterSends.status} = 'bounced')`,
      })
        .from(convexNewsletterSends)
        .where(and(
          eq(convexNewsletterSends.tenantId, tenantId),
          inArray(convexNewsletterSends.newsletterId, newsletterIds),
          gte(convexNewsletterSends.createdAt, start),
          lte(convexNewsletterSends.createdAt, end),
        ))
        .groupBy(sql`DATE(${convexNewsletterSends.createdAt})`)
        .orderBy(sql`DATE(${convexNewsletterSends.createdAt})`);

      timelineData = dailySends.map(d => ({
        date: d.date,
        sent: d.sent || 0,
        delivered: d.delivered || 0,
        opened: d.opened || 0,
        clicked: d.clicked || 0,
        bounced: d.bounced || 0,
      }));
    }

    // Compute aggregate rates
    const totalDelivered = newsletterAnalytics.totalDelivered + promotionAnalytics.totalDelivered;
    const totalSent = newsletterAnalytics.totalSent + promotionAnalytics.totalSent;
    const totalOpened = newsletterAnalytics.totalUniqueOpens + promotionAnalytics.totalOpened;
    const totalClicked = newsletterAnalytics.totalUniqueClicks;

    res.json({
      summary: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced: newsletterAnalytics.totalBounced + promotionAnalytics.totalBounced,
        totalFailed: newsletterAnalytics.totalFailed,
        totalUnsubscribed: newsletterAnalytics.totalUnsubscribed,
        totalFormResponses: formAnalytics.totalResponses,
        openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 1000) / 10 : 0,
        clickRate: totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 1000) / 10 : 0,
        bounceRate: totalSent > 0 ? Math.round(((newsletterAnalytics.totalBounced + promotionAnalytics.totalBounced) / totalSent) * 1000) / 10 : 0,
      },
      newsletters: newsletterAnalytics,
      forms: formAnalytics,
      promotions: promotionAnalytics,
      timeline: timelineData,
      dateRange: { start, end },
    });
  } catch (error) {
    console.error('Get aggregated analytics error:', error);
    res.status(500).json({ message: 'Failed to get aggregated analytics' });
  }
});
