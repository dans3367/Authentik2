import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { segmentLists, emailContacts, contactTags, contactTagAssignments } from '@shared/schema';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { sanitizeString } from '../utils/sanitization';
import type { CreateSegmentListData, UpdateSegmentListData } from '@shared/schema';

export const segmentListRoutes = Router();

/**
 * Build shop-scoping conditions for contact count queries.
 * For universal segments: use the segment's selectedShopIds.
 * For regular segments: use req.shopId from the header/query.
 */
function shopConditions(list: { isUniversal: boolean | null; selectedShopIds: string[] | null }, reqShopId: string | null) {
  if (list.isUniversal && list.selectedShopIds && list.selectedShopIds.length > 0) {
    return [inArray(emailContacts.shopId, list.selectedShopIds)];
  }
  if (reqShopId) {
    return [eq(emailContacts.shopId, reqShopId)];
  }
  return [];
}

/** Calculate contact count for a single segment list. */
async function getSegmentContactCount(
  list: { type: string; selectedContactIds: string[] | null; selectedTagIds: string[] | null; isUniversal: boolean | null; selectedShopIds: string[] | null },
  tenantId: string,
  reqShopId: string | null,
): Promise<number> {
  const baseConditions = [
    eq(emailContacts.tenantId, tenantId),
    eq(emailContacts.status, 'active'),
    ...shopConditions(list, reqShopId),
  ];

  if (list.type === 'all') {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailContacts)
      .where(and(...baseConditions));
    return Number(result[0]?.count || 0);
  }

  if (list.type === 'selected' && list.selectedContactIds && list.selectedContactIds.length > 0) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailContacts)
      .where(and(...baseConditions, inArray(emailContacts.id, list.selectedContactIds)));
    return Number(result[0]?.count || 0);
  }

  if (list.type === 'tags' && list.selectedTagIds && list.selectedTagIds.length > 0) {
    const result = await db
      .select({ count: sql<number>`count(DISTINCT ${emailContacts.id})` })
      .from(emailContacts)
      .innerJoin(contactTagAssignments, eq(contactTagAssignments.contactId, emailContacts.id))
      .where(and(...baseConditions, inArray(contactTagAssignments.tagId, list.selectedTagIds)));
    return Number(result[0]?.count || 0);
  }

  return 0;
}

// Get all segment lists
segmentListRoutes.get("/segment-lists", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const shopId = req.shopId as string | null;

    // When a shop is selected, show: segments belonging to that shop +
    // universal segments whose selectedShopIds include this shop.
    // When no shop is selected, show all segments.
    let whereClause;
    if (shopId) {
      whereClause = sql`${segmentLists.tenantId} = ${req.user.tenantId} AND (
        ${segmentLists.shopId} = ${shopId}
        OR (${segmentLists.isUniversal} = true AND ${shopId} = ANY(${segmentLists.selectedShopIds}))
      )`;
    } else {
      whereClause = eq(segmentLists.tenantId, req.user.tenantId);
    }

    const lists = await db.query.segmentLists.findMany({
      where: whereClause,
      orderBy: sql`${segmentLists.createdAt} DESC`,
    });

    const listsWithCounts = await Promise.all(
      lists.map(async (list) => ({
        ...list,
        contactCount: await getSegmentContactCount(list, req.user.tenantId, shopId),
      }))
    );

    res.json({ lists: listsWithCounts });
  } catch (error: any) {
    console.error('Error fetching segment lists:', error);
    res.status(500).json({ error: 'Failed to fetch segment lists' });
  }
});

// Get segment list stats
segmentListRoutes.get("/segment-lists/stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const listsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(segmentLists)
      .where(eq(segmentLists.tenantId, req.user.tenantId));
    const totalLists = Number(listsResult[0]?.count || 0);

    const contactsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailContacts)
      .where(and(eq(emailContacts.tenantId, req.user.tenantId), eq(emailContacts.status, 'active')));
    const totalContacts = Number(contactsResult[0]?.count || 0);

    const averageListSize = totalLists > 0 ? totalContacts / totalLists : 0;

    res.json({ stats: { totalLists, totalContacts, averageListSize } });
  } catch (error: any) {
    console.error('Error fetching segment list stats:', error);
    res.status(500).json({ error: 'Failed to fetch segment list stats' });
  }
});

// Get active contact counts grouped by shop (for universal segment creation)
segmentListRoutes.get("/segment-lists/shop-contact-counts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const rows = await db
      .select({
        shopId: emailContacts.shopId,
        count: sql<number>`count(*)`,
      })
      .from(emailContacts)
      .where(and(eq(emailContacts.tenantId, req.user.tenantId), eq(emailContacts.status, 'active')))
      .groupBy(emailContacts.shopId);

    // Convert to a map { shopId: count }
    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row.shopId) counts[row.shopId] = Number(row.count);
    }
    res.json({ counts });
  } catch (error: any) {
    console.error('Error fetching shop contact counts:', error);
    res.status(500).json({ error: 'Failed to fetch shop contact counts' });
  }
});

// Get single segment list
segmentListRoutes.get("/segment-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const list = await db.query.segmentLists.findFirst({
      where: and(eq(segmentLists.id, id), eq(segmentLists.tenantId, req.user.tenantId)),
    });

    if (!list) {
      return res.status(404).json({ error: 'Segment list not found' });
    }

    const contactCount = await getSegmentContactCount(list, req.user.tenantId, req.shopId);

    res.json({ list: { ...list, contactCount } });
  } catch (error: any) {
    console.error('Error fetching segment list:', error);
    res.status(500).json({ error: 'Failed to fetch segment list' });
  }
});

// Create segment list
segmentListRoutes.post("/segment-lists", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const data: CreateSegmentListData = req.body;

    if (!data.name || !data.type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (data.isUniversal && (!data.selectedShopIds || data.selectedShopIds.length === 0)) {
      return res.status(400).json({ error: 'Cross-store segments must include at least one store' });
    }

    const sanitizedName = sanitizeString(data.name);
    const sanitizedDescription = data.description ? sanitizeString(data.description) : null;

    const [newList] = await db
      .insert(segmentLists)
      .values({
        tenantId: req.user.tenantId,
        shopId: data.isUniversal ? null : (req.shopId || null),
        name: sanitizedName,
        description: sanitizedDescription,
        type: data.type,
        selectedContactIds: data.selectedContactIds || [],
        selectedTagIds: data.selectedTagIds || [],
        isUniversal: data.isUniversal || false,
        selectedShopIds: data.isUniversal ? (data.selectedShopIds || []) : [],
      })
      .returning();

    res.status(201).json({ list: newList });
  } catch (error: any) {
    console.error('Error creating segment list:', error);
    res.status(500).json({ error: 'Failed to create segment list' });
  }
});

// Update segment list
segmentListRoutes.patch("/segment-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const data: UpdateSegmentListData = req.body;

    const existingList = await db.query.segmentLists.findFirst({
      where: and(eq(segmentLists.id, id), eq(segmentLists.tenantId, req.user.tenantId)),
    });

    if (!existingList) {
      return res.status(404).json({ error: 'Segment list not found' });
    }

    const updateData: any = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = sanitizeString(data.name);
    if (data.description !== undefined) updateData.description = data.description ? sanitizeString(data.description) : null;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.selectedContactIds !== undefined) updateData.selectedContactIds = data.selectedContactIds;
    if (data.selectedTagIds !== undefined) updateData.selectedTagIds = data.selectedTagIds;
    if (data.isUniversal !== undefined) updateData.isUniversal = data.isUniversal;
    if (data.selectedShopIds !== undefined) updateData.selectedShopIds = data.selectedShopIds;

    const [updatedList] = await db
      .update(segmentLists)
      .set(updateData)
      .where(and(eq(segmentLists.id, id), eq(segmentLists.tenantId, req.user.tenantId)))
      .returning();

    res.json({ list: updatedList });
  } catch (error: any) {
    console.error('Error updating segment list:', error);
    res.status(500).json({ error: 'Failed to update segment list' });
  }
});

// Delete segment list
segmentListRoutes.delete("/segment-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const existingList = await db.query.segmentLists.findFirst({
      where: and(eq(segmentLists.id, id), eq(segmentLists.tenantId, req.user.tenantId)),
    });

    if (!existingList) {
      return res.status(404).json({ error: 'Segment list not found' });
    }

    await db
      .delete(segmentLists)
      .where(and(eq(segmentLists.id, id), eq(segmentLists.tenantId, req.user.tenantId)));

    res.json({ message: 'Segment list deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting segment list:', error);
    res.status(500).json({ error: 'Failed to delete segment list' });
  }
});
