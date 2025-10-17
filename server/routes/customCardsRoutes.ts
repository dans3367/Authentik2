import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { customCards } from '@shared/schema';
import type { 
  CreateCustomCardData, 
  UpdateCustomCardData, 
  CustomCard 
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';

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
router.get('/', async (req: Request, res: Response) => {
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
      error: 'Failed to fetch custom cards',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/custom-cards/:id - Get a specific custom card
router.get('/:id', async (req: Request, res: Response) => {
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
      error: 'Failed to fetch custom card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/custom-cards - Create a new custom card
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = getTenantAndUserIds(req);
    
    // Validate request body
    const bodySchema = z.object({
      name: z.string().min(1),
      occasionType: z.string().optional(),
      sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      active: z.boolean().default(true),
      cardData: z.string(),
      promotionIds: z.array(z.string()).optional(),
    });

    const validatedData = bodySchema.parse(req.body);

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
      error: 'Failed to create custom card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/custom-cards/:id - Update a custom card
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = getTenantAndUserIds(req);
    const { id } = req.params;

    // Check if card exists and belongs to tenant
    const [existingCard] = await db
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
      return res.status(404).json({ error: 'Custom card not found' });
    }

    // Validate request body
    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      occasionType: z.string().optional(),
      sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      active: z.boolean().optional(),
      cardData: z.string().optional(),
      promotionIds: z.array(z.string()).optional(),
    });

    const validatedData = bodySchema.parse(req.body);

    const [updatedCard] = await db
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
      error: 'Failed to update custom card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/custom-cards/:id - Delete a custom card
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = getTenantAndUserIds(req);
    const { id } = req.params;

    // Check if card exists and belongs to tenant
    const [existingCard] = await db
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
      return res.status(404).json({ error: 'Custom card not found' });
    }

    await db
      .delete(customCards)
      .where(
        and(
          eq(customCards.id, id),
          eq(customCards.tenantId, tenantId)
        )
      );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting custom card:', error);
    res.status(500).json({ 
      error: 'Failed to delete custom card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

