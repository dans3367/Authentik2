import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateToken } from './authRoutes';
import { users, campaigns, emailTemplates, mailingLists, emails, emailStatistics, createCampaignSchema, updateCampaignSchema } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';

export const campaignRoutes = Router();

// Get all campaigns
campaignRoutes.get("/", authenticateToken, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`1=1`;

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

    const campaigns = await db.query.campaigns.findMany({
      where: whereClause,
      orderBy: sql`${campaigns.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(db.campaigns).where(whereClause);

    res.json({
      campaigns,
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

// Get specific campaign
campaignRoutes.get("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.query.campaigns.findFirst({
      where: sql`${campaigns.id} = ${id}`,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ message: 'Failed to get campaign' });
  }
});

// Create campaign
campaignRoutes.post("/", authenticateToken, async (req: any, res) => {
  try {
    const validatedData = createCampaignSchema.parse(req.body);
    const { name, description, type, targetAudience, budget, startDate, endDate, status } = validatedData;

    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    const newCampaign = await db.insert(campaigns).values({
      name: sanitizedName,
      description: sanitizedDescription,
      type,
      targetAudience,
      budget,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newCampaign[0]);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ message: 'Failed to create campaign' });
  }
});

// Update campaign
campaignRoutes.put("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateCampaignSchema.parse(req.body);
    const { name, description, type, targetAudience, budget, startDate, endDate, status } = validatedData;

    const campaign = await db.query.campaigns.findFirst({
      where: sql`${campaigns.id} = ${id}`,
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
      updateData.budget = budget;
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
      .where(sql`${campaigns.id} = ${id}`)
      .returning();

    res.json(updatedCampaign[0]);
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ message: 'Failed to update campaign' });
  }
});

// Delete campaign
campaignRoutes.delete("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.query.campaigns.findFirst({
      where: sql`${campaigns.id} = ${id}`,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Delete campaign
    await db.delete(campaigns)
      .where(sql`${campaigns.id} = ${id}`);

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ message: 'Failed to delete campaign' });
  }
});

// Get campaign statistics
campaignRoutes.get("/campaign-stats", authenticateToken, async (req: any, res) => {
  try {
    const stats = await db.select({
      totalCampaigns: sql<number>`count(*)`,
      activeCampaigns: sql<number>`count(*) filter (where status = 'active')`,
      draftCampaigns: sql<number>`count(*) filter (where status = 'draft')`,
      completedCampaigns: sql<number>`count(*) filter (where status = 'completed')`,
      campaignsThisMonth: sql<number>`count(*) filter (where created_at >= current_date - interval '30 days')`,
    }).from(db.campaigns);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get campaign stats error:', error);
    res.status(500).json({ message: 'Failed to get campaign statistics' });
  }
});

// Get managers list
campaignRoutes.get("/managers", authenticateToken, async (req: any, res) => {
  try {
    const managers = await db.query.users.findMany({
      where: sql`${users.role} IN ('Manager', 'Administrator', 'Owner')`,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: sql`${users.firstName} ASC`,
    });

    res.json(managers);
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ message: 'Failed to get managers' });
  }
});

// Debug newsletter tracking
campaignRoutes.get("/debug/newsletter/:newsletterId/tracking", authenticateToken, async (req: any, res) => {
  try {
    const { newsletterId } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${db.newsletters.id} = ${newsletterId}`,
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
campaignRoutes.post("/debug/webhook-flow/:newsletterId", authenticateToken, async (req: any, res) => {
  try {
    const { newsletterId } = req.params;
    const { eventType, email, data } = req.body;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${db.newsletters.id} = ${newsletterId}`,
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