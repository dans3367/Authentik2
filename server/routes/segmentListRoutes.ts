import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { segmentLists, emailContacts, contactTags, contactTagAssignments } from '@shared/schema';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { sanitizeString } from '../utils/sanitization';
import type { CreateSegmentListData, UpdateSegmentListData } from '@shared/schema';

export const segmentListRoutes = Router();

// Get all segment lists
segmentListRoutes.get("/segment-lists", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const lists = await db.query.segmentLists.findMany({
      where: eq(segmentLists.tenantId, req.user.tenantId),
      orderBy: sql`${segmentLists.createdAt} DESC`,
    });

    // Calculate contact count for each list
    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        let contactCount = 0;

        if (list.type === 'all') {
          // Count all active contacts
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(emailContacts)
            .where(
              and(
                eq(emailContacts.tenantId, req.user.tenantId),
                eq(emailContacts.status, 'active')
              )
            );
          contactCount = Number(result[0]?.count || 0);
        } else if (list.type === 'selected' && list.selectedContactIds.length > 0) {
          // Count selected contacts
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(emailContacts)
            .where(
              and(
                eq(emailContacts.tenantId, req.user.tenantId),
                inArray(emailContacts.id, list.selectedContactIds),
                eq(emailContacts.status, 'active')
              )
            );
          contactCount = Number(result[0]?.count || 0);
        } else if (list.type === 'tags' && list.selectedTagIds.length > 0) {
          // Count contacts with selected tags
          const result = await db
            .select({ count: sql<number>`count(DISTINCT ${emailContacts.id})` })
            .from(emailContacts)
            .innerJoin(
              contactTagAssignments,
              eq(contactTagAssignments.contactId, emailContacts.id)
            )
            .where(
              and(
                eq(emailContacts.tenantId, req.user.tenantId),
                inArray(contactTagAssignments.tagId, list.selectedTagIds),
                eq(emailContacts.status, 'active')
              )
            );
          contactCount = Number(result[0]?.count || 0);
        }

        return {
          ...list,
          contactCount,
        };
      })
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
    // Get total lists count
    const listsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(segmentLists)
      .where(eq(segmentLists.tenantId, req.user.tenantId));
    const totalLists = Number(listsResult[0]?.count || 0);

    // Get total contacts count
    const contactsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailContacts)
      .where(
        and(
          eq(emailContacts.tenantId, req.user.tenantId),
          eq(emailContacts.status, 'active')
        )
      );
    const totalContacts = Number(contactsResult[0]?.count || 0);

    // Calculate average list size
    const averageListSize = totalLists > 0 ? totalContacts / totalLists : 0;

    res.json({
      stats: {
        totalLists,
        totalContacts,
        averageListSize,
      },
    });
  } catch (error: any) {
    console.error('Error fetching segment list stats:', error);
    res.status(500).json({ error: 'Failed to fetch segment list stats' });
  }
});

// Get single segment list
segmentListRoutes.get("/segment-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const list = await db.query.segmentLists.findFirst({
      where: and(
        eq(segmentLists.id, id),
        eq(segmentLists.tenantId, req.user.tenantId)
      ),
    });

    if (!list) {
      return res.status(404).json({ error: 'Segment list not found' });
    }

    // Calculate contact count
    let contactCount = 0;

    if (list.type === 'all') {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailContacts)
        .where(
          and(
            eq(emailContacts.tenantId, req.user.tenantId),
            eq(emailContacts.status, 'active')
          )
        );
      contactCount = Number(result[0]?.count || 0);
    } else if (list.type === 'selected' && list.selectedContactIds.length > 0) {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailContacts)
        .where(
          and(
            eq(emailContacts.tenantId, req.user.tenantId),
            inArray(emailContacts.id, list.selectedContactIds),
            eq(emailContacts.status, 'active')
          )
        );
      contactCount = Number(result[0]?.count || 0);
    } else if (list.type === 'tags' && list.selectedTagIds.length > 0) {
      const result = await db
        .select({ count: sql<number>`count(DISTINCT ${emailContacts.id})` })
        .from(emailContacts)
        .innerJoin(
          contactTagAssignments,
          eq(contactTagAssignments.contactId, emailContacts.id)
        )
        .where(
          and(
            eq(emailContacts.tenantId, req.user.tenantId),
            inArray(contactTagAssignments.tagId, list.selectedTagIds),
            eq(emailContacts.status, 'active')
          )
        );
      contactCount = Number(result[0]?.count || 0);
    }

    res.json({
      list: {
        ...list,
        contactCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching segment list:', error);
    res.status(500).json({ error: 'Failed to fetch segment list' });
  }
});

import { requireRole } from '../middleware/auth-middleware';

// Create segment list
segmentListRoutes.post("/segment-lists", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator', 'Manager']), async (req: any, res) => {
  try {
    const data: CreateSegmentListData = req.body;

    // Validate required fields
    if (!data.name || !data.type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Sanitize input
    const sanitizedName = sanitizeString(data.name);
    const sanitizedDescription = data.description ? sanitizeString(data.description) : null;

    // Create segment list
    const [newList] = await db
      .insert(segmentLists)
      .values({
        tenantId: req.user.tenantId,
        name: sanitizedName,
        description: sanitizedDescription,
        type: data.type,
        selectedContactIds: data.selectedContactIds || [],
        selectedTagIds: data.selectedTagIds || [],
      })
      .returning();

    res.status(201).json({ list: newList });
  } catch (error: any) {
    console.error('Error creating segment list:', error);
    res.status(500).json({ error: 'Failed to create segment list' });
  }
});

// Update segment list
segmentListRoutes.patch("/segment-lists/:id", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator', 'Manager']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const data: UpdateSegmentListData = req.body;

    // Check if list exists and belongs to tenant
    const existingList = await db.query.segmentLists.findFirst({
      where: and(
        eq(segmentLists.id, id),
        eq(segmentLists.tenantId, req.user.tenantId)
      ),
    });

    if (!existingList) {
      return res.status(404).json({ error: 'Segment list not found' });
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updateData.name = sanitizeString(data.name);
    }

    if (data.description !== undefined) {
      updateData.description = data.description ? sanitizeString(data.description) : null;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    if (data.selectedContactIds !== undefined) {
      updateData.selectedContactIds = data.selectedContactIds;
    }

    if (data.selectedTagIds !== undefined) {
      updateData.selectedTagIds = data.selectedTagIds;
    }

    // Update segment list
    const [updatedList] = await db
      .update(segmentLists)
      .set(updateData)
      .where(
        and(
          eq(segmentLists.id, id),
          eq(segmentLists.tenantId, req.user.tenantId)
        )
      )
      .returning();

    res.json({ list: updatedList });
  } catch (error: any) {
    console.error('Error updating segment list:', error);
    res.status(500).json({ error: 'Failed to update segment list' });
  }
});

// Delete segment list
segmentListRoutes.delete("/segment-lists/:id", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if list exists and belongs to tenant
    const existingList = await db.query.segmentLists.findFirst({
      where: and(
        eq(segmentLists.id, id),
        eq(segmentLists.tenantId, req.user.tenantId)
      ),
    });

    if (!existingList) {
      return res.status(404).json({ error: 'Segment list not found' });
    }

    // Delete segment list
    await db
      .delete(segmentLists)
      .where(
        and(
          eq(segmentLists.id, id),
          eq(segmentLists.tenantId, req.user.tenantId)
        )
      );

    res.json({ message: 'Segment list deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting segment list:', error);
    res.status(500).json({ error: 'Failed to delete segment list' });
  }
});
