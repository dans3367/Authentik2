import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { 
  promotions, 
  createPromotionSchema, 
  updatePromotionSchema,
  type Promotion 
} from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';
import { storage } from '../storage';

export const promotionRoutes = Router();

// Get all promotions
promotionRoutes.get("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, type, isActive } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${promotions.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${promotions.title} ILIKE ${`%${sanitizedSearch}%`} OR
        ${promotions.description} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (type) {
      whereClause = sql`${whereClause} AND ${promotions.type} = ${type}`;
    }

    if (isActive !== undefined) {
      whereClause = sql`${whereClause} AND ${promotions.isActive} = ${isActive === 'true'}`;
    }

    const tenantPromotions = await db.query.promotions.findMany({
      where: whereClause,
      orderBy: sql`${promotions.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(promotions).where(whereClause);

    res.json({
      promotions: tenantPromotions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({ message: 'Failed to get promotions' });
  }
});

// Get promotion stats
promotionRoutes.get("/stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const stats = await storage.getPromotionStats(req.user.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Get promotion stats error:', error);
    res.status(500).json({ message: 'Failed to get promotion statistics' });
  }
});

// Get specific promotion
promotionRoutes.get("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const promotion = await storage.getPromotion(id, req.user.tenantId);

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    res.json(promotion);
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({ message: 'Failed to get promotion' });
  }
});

// Create promotion
promotionRoutes.post("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const validatedData = createPromotionSchema.parse(req.body);

    const promotion = await storage.createPromotion(
      validatedData,
      req.user.id,
      req.user.tenantId
    );

    res.status(201).json({
      message: 'Promotion created successfully',
      promotion,
    });
  } catch (error: any) {
    console.error('Create promotion error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: error.errors,
      });
    }

    res.status(500).json({ message: 'Failed to create promotion' });
  }
});

// Update promotion
promotionRoutes.patch("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updatePromotionSchema.parse(req.body);

    const existingPromotion = await storage.getPromotion(id, req.user.tenantId);
    if (!existingPromotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    const updatedPromotion = await storage.updatePromotion(
      id,
      validatedData,
      req.user.tenantId
    );

    if (!updatedPromotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    res.json({
      message: 'Promotion updated successfully',
      promotion: updatedPromotion,
    });
  } catch (error: any) {
    console.error('Update promotion error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: error.errors,
      });
    }

    res.status(500).json({ message: 'Failed to update promotion' });
  }
});

// Delete promotion
promotionRoutes.delete("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const existingPromotion = await storage.getPromotion(id, req.user.tenantId);
    if (!existingPromotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    await storage.deletePromotion(id, req.user.tenantId);

    res.json({ message: 'Promotion deleted successfully' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ message: 'Failed to delete promotion' });
  }
});

// Increment promotion usage (called when promotion is used in campaigns)
promotionRoutes.post("/:id/use", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const existingPromotion = await storage.getPromotion(id, req.user.tenantId);
    if (!existingPromotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    if (!existingPromotion.isActive) {
      return res.status(400).json({ message: 'Promotion is not active' });
    }

    await storage.incrementPromotionUsage(id, req.user.tenantId);

    res.json({ message: 'Promotion usage recorded' });
  } catch (error) {
    console.error('Increment promotion usage error:', error);
    res.status(500).json({ message: 'Failed to record promotion usage' });
  }
});
