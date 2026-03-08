import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { betterAuthUser, campaigns, campaignNewsletters, newsletters, convexNewsletterStats, createCampaignSchema, updateCampaignSchema } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';
import { getNewsletterStats } from '../utils/convexNewsletterTracker';

export const campaignRoutes = Router();

// Helper: sync newsletter associations for a campaign
async function syncCampaignNewsletters(campaignId: string, newsletterIds: string[], tenantId: string) {
  // Remove all existing associations
  await db.delete(campaignNewsletters)
    .where(eq(campaignNewsletters.campaignId, campaignId));

  // Insert new associations
  if (newsletterIds.length > 0) {
    await db.insert(campaignNewsletters).values(
      newsletterIds.map(nId => ({
        campaignId,
        newsletterId: nId,
        tenantId,
      }))
    );
  }
}

// Helper: get newsletter IDs for a campaign
async function getCampaignNewsletterIds(campaignId: string): Promise<string[]> {
  const rows = await db.select({ newsletterId: campaignNewsletters.newsletterId })
    .from(campaignNewsletters)
    .where(eq(campaignNewsletters.campaignId, campaignId));
  return rows.map(r => r.newsletterId);
}

// Helper: get aggregated stats for a list of newsletter IDs
async function getAggregatedNewsletterStats(newsletterIds: string[]) {
  if (newsletterIds.length === 0) {
    return {
      totalSent: 0, totalDelivered: 0, totalOpened: 0, totalUniqueOpens: 0,
      totalClicked: 0, totalUniqueClicks: 0, totalBounced: 0, totalFailed: 0,
      totalRecipients: 0, openRate: 0, clickRate: 0, bounceRate: 0,
    };
  }

  // Try Convex stats first, fall back to local PG mirror
  let totalSent = 0, totalDelivered = 0, totalOpened = 0, totalUniqueOpens = 0;
  let totalClicked = 0, totalUniqueClicks = 0, totalBounced = 0, totalFailed = 0;
  let totalRecipients = 0;

  for (const nId of newsletterIds) {
    try {
      const convex = await getNewsletterStats(nId);
      if (convex) {
        totalSent += convex.sent ?? 0;
        totalDelivered += convex.delivered ?? 0;
        totalOpened += convex.opened ?? 0;
        totalUniqueOpens += convex.uniqueOpens ?? 0;
        totalClicked += convex.clicked ?? 0;
        totalUniqueClicks += convex.uniqueClicks ?? 0;
        totalBounced += convex.bounced ?? 0;
        totalFailed += convex.failed ?? 0;
        totalRecipients += convex.totalRecipients ?? 0;
        continue;
      }
    } catch { /* fall through to PG */ }

    // Fallback: local PG mirror stats
    const pgStats = await db.query.convexNewsletterStats.findFirst({
      where: sql`${convexNewsletterStats.newsletterId} = ${nId}`,
    });
    if (pgStats) {
      totalSent += pgStats.sent ?? 0;
      totalDelivered += pgStats.delivered ?? 0;
      totalOpened += pgStats.opened ?? 0;
      totalUniqueOpens += pgStats.uniqueOpens ?? 0;
      totalClicked += pgStats.clicked ?? 0;
      totalUniqueClicks += pgStats.uniqueClicks ?? 0;
      totalBounced += pgStats.bounced ?? 0;
      totalFailed += pgStats.failed ?? 0;
      totalRecipients += pgStats.totalRecipients ?? 0;
    }
  }

  const openRate = totalDelivered > 0 ? Math.round((totalUniqueOpens / totalDelivered) * 1000) / 10 : 0;
  const clickRate = totalDelivered > 0 ? Math.round((totalUniqueClicks / totalDelivered) * 1000) / 10 : 0;
  const bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 1000) / 10 : 0;

  return {
    totalSent, totalDelivered, totalOpened, totalUniqueOpens,
    totalClicked, totalUniqueClicks, totalBounced, totalFailed,
    totalRecipients, openRate, clickRate, bounceRate,
  };
}

// Get campaign statistics
campaignRoutes.get("/stats/overview", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const stats = await db.select({
      totalCampaigns: sql<number>`count(*)`,
      activeCampaigns: sql<number>`count(*) filter (where status = 'active')`,
      draftCampaigns: sql<number>`count(*) filter (where status = 'draft')`,
      completedCampaigns: sql<number>`count(*) filter (where status = 'completed')`,
      campaignsThisMonth: sql<number>`count(*) filter (where created_at >= current_date - interval '30 days')`,
    }).from(campaigns).where(sql`${campaigns.tenantId} = ${req.user.tenantId}`);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get campaign stats error:', error);
    res.status(500).json({ message: 'Failed to get campaign statistics' });
  }
});

// Get newsletters for campaign picker
campaignRoutes.get("/newsletters/available", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const tenantNewsletters = await db.query.newsletters.findMany({
      where: sql`${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
      orderBy: sql`${newsletters.createdAt} DESC`,
      columns: {
        id: true,
        title: true,
        subject: true,
        status: true,
        sentAt: true,
        recipientCount: true,
        openCount: true,
        clickCount: true,
        createdAt: true,
      },
    });

    res.json({ newsletters: tenantNewsletters });
  } catch (error) {
    console.error('Get available newsletters error:', error);
    res.status(500).json({ message: 'Failed to get newsletters' });
  }
});

// Get eligible reviewers (all users except Employee role)
campaignRoutes.get("/managers", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const reviewers = await db.query.betterAuthUser.findMany({
      where: sql`${betterAuthUser.role} != 'Employee' AND ${betterAuthUser.tenantId} = ${req.user.tenantId}`,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: sql`${betterAuthUser.firstName} ASC`,
    });

    res.json({ managers: reviewers });
  } catch (error) {
    console.error('Get reviewers error:', error);
    res.status(500).json({ message: 'Failed to get reviewers' });
  }
});

// Get all campaigns (with newsletter count + basic aggregated stats)
campaignRoutes.get("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${campaigns.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${campaigns.name} ILIKE ${`%${sanitizedSearch}%`} OR
        ${campaigns.description} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (status) {
      whereClause = sql`${whereClause} AND ${campaigns.status} = ${status}`;
    }

    const tenantCampaigns = await db.query.campaigns.findMany({
      where: whereClause,
      orderBy: sql`${campaigns.createdAt} DESC`,
      limit: Number(limit),
      offset,
      with: {
        campaignNewsletters: true,
      },
    });

    // Enrich each campaign with newsletter count and aggregated stats
    const enrichedCampaigns = await Promise.all(
      tenantCampaigns.map(async (c: any) => {
        const nlIds = (c.campaignNewsletters || []).map((cn: any) => cn.newsletterId);
        const aggregatedStats = await getAggregatedNewsletterStats(nlIds);
        return {
          ...c,
          newsletterCount: nlIds.length,
          newsletterIds: nlIds,
          aggregatedStats,
        };
      })
    );

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(campaigns).where(whereClause);

    res.json({
      campaigns: enrichedCampaigns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ message: 'Failed to get campaigns' });
  }
});

// Get specific campaign (with newsletters and aggregated stats)
campaignRoutes.get("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.query.campaigns.findFirst({
      where: sql`${campaigns.id} = ${id} AND ${campaigns.tenantId} = ${req.user.tenantId}`,
      with: {
        campaignNewsletters: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const nlIds = ((campaign as any).campaignNewsletters || []).map((cn: any) => cn.newsletterId);

    // Fetch full newsletter objects for the associated newsletters
    let campaignNewslettersList: any[] = [];
    if (nlIds.length > 0) {
      campaignNewslettersList = await db.query.newsletters.findMany({
        where: inArray(newsletters.id, nlIds),
      });
    }

    // Per-newsletter stats
    const newslettersWithStats = await Promise.all(
      campaignNewslettersList.map(async (nl: any) => {
        let stats = null;
        try {
          stats = await getNewsletterStats(nl.id);
        } catch { /* ignore */ }
        if (!stats) {
          const pgStats = await db.query.convexNewsletterStats.findFirst({
            where: sql`${convexNewsletterStats.newsletterId} = ${nl.id}`,
          });
          if (pgStats) stats = pgStats;
        }
        const delivered = stats?.delivered ?? 0;
        const sent = stats?.sent ?? 0;
        return {
          ...nl,
          stats: {
            totalSent: sent,
            totalDelivered: delivered,
            totalOpened: stats?.opened ?? 0,
            uniqueOpens: stats?.uniqueOpens ?? 0,
            totalClicked: stats?.clicked ?? 0,
            uniqueClicks: stats?.uniqueClicks ?? 0,
            totalBounced: stats?.bounced ?? 0,
            totalRecipients: stats?.totalRecipients ?? 0,
            openRate: delivered > 0 ? Math.round(((stats?.uniqueOpens ?? 0) / delivered) * 1000) / 10 : 0,
            clickRate: delivered > 0 ? Math.round(((stats?.uniqueClicks ?? 0) / delivered) * 1000) / 10 : 0,
          },
        };
      })
    );

    const aggregatedStats = await getAggregatedNewsletterStats(nlIds);

    res.json({
      campaign: {
        ...campaign,
        newsletterIds: nlIds,
        newsletterCount: nlIds.length,
      },
      newsletters: newslettersWithStats,
      aggregatedStats,
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ message: 'Failed to get campaign' });
  }
});

// Create campaign
campaignRoutes.post("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const validatedData = createCampaignSchema.parse(req.body);
    const { name, description, type, targetAudience, budget, startDate, endDate, status, newsletterIds } = validatedData;

    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    const insertValues: any = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      name: sanitizedName,
      description: sanitizedDescription,
      type: type || 'email',
      targetAudience: targetAudience ?? null,
      budget: budget ? String(budget) : null,
      startDate: startDate ? new Date(startDate as any) : null,
      endDate: endDate ? new Date(endDate as any) : null,
      status: status || 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const newCampaign = await db.insert(campaigns).values(insertValues).returning();

    const created = newCampaign[0];

    // Sync newsletter associations
    if (newsletterIds && newsletterIds.length > 0) {
      await syncCampaignNewsletters(created.id, newsletterIds, req.user.tenantId);
    }

    res.status(201).json({ ...created, newsletterIds: newsletterIds || [] });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ message: 'Failed to create campaign' });
  }
});

// Update campaign
campaignRoutes.put("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateCampaignSchema.parse(req.body);
    const { name, description, type, targetAudience, budget, startDate, endDate, status, newsletterIds } = validatedData;

    const campaign = await db.query.campaigns.findFirst({
      where: sql`${campaigns.id} = ${id} AND ${campaigns.tenantId} = ${req.user.tenantId}`,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = sanitizeString(name);
    }

    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : null;
    }

    if (type !== undefined) {
      updateData.type = type;
    }

    if (targetAudience !== undefined) {
      updateData.targetAudience = targetAudience;
    }

    if (budget !== undefined) {
      updateData.budget = budget !== undefined ? String(budget) : undefined;
    }

    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const updatedCampaign = await db.update(campaigns)
      .set(updateData)
      .where(sql`${campaigns.id} = ${id} AND ${campaigns.tenantId} = ${req.user.tenantId}`)
      .returning();

    // Sync newsletter associations if provided
    if (newsletterIds !== undefined) {
      await syncCampaignNewsletters(id, newsletterIds, req.user.tenantId);
    }

    const nlIds = newsletterIds ?? await getCampaignNewsletterIds(id);

    res.json({ ...updatedCampaign[0], newsletterIds: nlIds });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ message: 'Failed to update campaign' });
  }
});

// Delete campaign
campaignRoutes.delete("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.query.campaigns.findFirst({
      where: sql`${campaigns.id} = ${id} AND ${campaigns.tenantId} = ${req.user.tenantId}`,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Delete campaign
    await db.delete(campaigns)
      .where(sql`${campaigns.id} = ${id} AND ${campaigns.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ message: 'Failed to delete campaign' });
  }
});

// Debug newsletter tracking
campaignRoutes.get("/debug/newsletter/:newsletterId/tracking", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { newsletterId } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${newsletterId} AND ${newsletters.tenantId} = ${req.user.tenantId}`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Debug tracking information (placeholder)
    const trackingInfo = {
      newsletterId,
      trackingEnabled: true,
      openTracking: true,
      clickTracking: true,
      unsubscribeTracking: true,
      trackingPixel: `<img src="${process.env.API_URL}/track/open/${newsletterId}" width="1" height="1" style="display:none;" />`,
      unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe?token=UNSUBSCRIBE_TOKEN`,
    };

    res.json(trackingInfo);
  } catch (error) {
    console.error('Debug newsletter tracking error:', error);
    res.status(500).json({ message: 'Failed to get newsletter tracking info' });
  }
});

// Debug webhook flow
campaignRoutes.post("/debug/webhook-flow/:newsletterId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { newsletterId } = req.params;
    const { eventType, email, data } = req.body;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${newsletterId} AND ${newsletters.tenantId} = ${req.user.tenantId}`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Simulate webhook flow
    const webhookFlow = {
      newsletterId,
      eventType: eventType || 'email.opened',
      email: email || 'test@example.com',
      data: data || {},
      processed: true,
      timestamp: new Date().toISOString(),
      actions: [
        'Event received',
        'Newsletter found',
        'Email validated',
        'Event logged',
        'Statistics updated',
      ],
    };

    res.json(webhookFlow);
  } catch (error) {
    console.error('Debug webhook flow error:', error);
    res.status(500).json({ message: 'Failed to process webhook flow' });
  }
});