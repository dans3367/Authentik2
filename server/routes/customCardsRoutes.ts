import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { customCards, promotions } from '@shared/schema';
import type { 
  CreateCustomCardData, 
  UpdateCustomCardData, 
  CustomCard 
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { authenticateToken, requireTenant, requirePermission } from '../middleware/auth-middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireTenant);

// Helper function to get tenant ID and user ID from request
function getTenantAndUserIds(req: Request): { tenantId: string; userId: string } {
  const user = (req as any).user;
  if (!user || !user.id || !user.tenantId) {
    throw new Error('Unauthorized: User not authenticated');
  }
  return {
    tenantId: user.tenantId,
    userId: user.id,
  };
}

// GET /api/custom-cards - Get all custom cards for the tenant
router.get('/', requirePermission('cards.view'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = getTenantAndUserIds(req);

    const cards = await db
      .select()
      .from(customCards)
      .where(eq(customCards.tenantId, tenantId))
      .orderBy(customCards.sendDate);

    res.json(cards);
  } catch (error) {
    console.error('Error fetching custom cards:', error);
    res.status(500).json({ 
      error: 'Failed to fetch custom cards'
    });
  }
});

// GET /api/custom-cards/:id - Get a specific custom card
router.get('/:id', requirePermission('cards.view'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = getTenantAndUserIds(req);
    const { id } = req.params;

    const [card] = await db
      .select()
      .from(customCards)
      .where(
        and(
          eq(customCards.id, id),
          eq(customCards.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!card) {
      return res.status(404).json({ error: 'Custom card not found' });
    }

    res.json(card);
  } catch (error) {
    console.error('Error fetching custom card:', error);
    res.status(500).json({ 
      error: 'Failed to fetch custom card'
    });
  }
});

// POST /api/custom-cards - Create a new custom card
router.post('/', requirePermission('cards.create'), async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = getTenantAndUserIds(req);
    
    // Validate request body
    const bodySchema = z.object({
      name: z.string().min(1),
      occasionType: z.string().optional(),
      sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      active: z.boolean().default(true),
      cardData: z.string().max(500000, 'Card data exceeds maximum allowed size'),
      promotionIds: z.array(z.string()).optional(),
    });

    const validatedData = bodySchema.parse(req.body);

    // Validate that promotionIds reference existing promotions owned by this tenant
    if (validatedData.promotionIds && validatedData.promotionIds.length > 0) {
      const existingPromos = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(
          and(
            inArray(promotions.id, validatedData.promotionIds),
            eq(promotions.tenantId, tenantId)
          )
        );
      const existingIds = new Set(existingPromos.map(p => p.id));
      const invalidIds = validatedData.promotionIds.filter(id => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: 'Invalid promotion IDs',
          details: `The following promotion IDs do not exist or do not belong to your tenant: ${invalidIds.join(', ')}`
        });
      }
    }

    const [newCard] = await db
      .insert(customCards)
      .values({
        ...validatedData,
        tenantId,
        userId,
      })
      .returning();

    res.status(201).json(newCard);
  } catch (error) {
    console.error('Error creating custom card:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors
      });
    }
    res.status(500).json({ 
      error: 'Failed to create custom card'
    });
  }
});

// PUT /api/custom-cards/:id - Update a custom card
router.put('/:id', requirePermission('cards.edit'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = getTenantAndUserIds(req);
    const { id } = req.params;

    // Validate request body
    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      occasionType: z.string().optional(),
      sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      active: z.boolean().optional(),
      cardData: z.string().max(500000, 'Card data exceeds maximum allowed size').optional(),
      promotionIds: z.array(z.string()).optional(),
    });

    const validatedData = bodySchema.parse(req.body);

    // Reject empty update bodies
    const updateFields = Object.keys(validatedData).filter(
      key => validatedData[key as keyof typeof validatedData] !== undefined
    );
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Validate that promotionIds reference existing promotions owned by this tenant
    if (validatedData.promotionIds && validatedData.promotionIds.length > 0) {
      const existingPromos = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(
          and(
            inArray(promotions.id, validatedData.promotionIds),
            eq(promotions.tenantId, tenantId)
          )
        );
      const existingIds = new Set(existingPromos.map(p => p.id));
      const invalidIds = validatedData.promotionIds.filter(id => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: 'Invalid promotion IDs',
          details: `The following promotion IDs do not exist or do not belong to your tenant: ${invalidIds.join(', ')}`
        });
      }
    }

    // Use transaction to prevent TOCTOU race condition
    const updatedCard = await db.transaction(async (tx: any) => {
      const [existingCard] = await tx
        .select()
        .from(customCards)
        .where(
          and(
            eq(customCards.id, id),
            eq(customCards.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingCard) {
        return null;
      }

      const [updated] = await tx
        .update(customCards)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customCards.id, id),
            eq(customCards.tenantId, tenantId)
          )
        )
        .returning();

      return updated;
    });

    if (!updatedCard) {
      return res.status(404).json({ error: 'Custom card not found' });
    }

    res.json(updatedCard);
  } catch (error) {
    console.error('Error updating custom card:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors
      });
    }
    res.status(500).json({ 
      error: 'Failed to update custom card'
    });
  }
});

// DELETE /api/custom-cards/:id - Delete a custom card
router.delete('/:id', requirePermission('cards.edit'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = getTenantAndUserIds(req);
    const { id } = req.params;

    // Use transaction to prevent TOCTOU race condition
    const deleted = await db.transaction(async (tx: any) => {
      const [existingCard] = await tx
        .select()
        .from(customCards)
        .where(
          and(
            eq(customCards.id, id),
            eq(customCards.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingCard) {
        return false;
      }

      await tx
        .delete(customCards)
        .where(
          and(
            eq(customCards.id, id),
            eq(customCards.tenantId, tenantId)
          )
        );

      return true;
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Custom card not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting custom card:', error);
    res.status(500).json({ 
      error: 'Failed to delete custom card'
    });
  }
});

export default router;

