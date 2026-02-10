import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { contactTags } from '@shared/schema';
import { authenticateToken, requirePermission } from '../middleware/auth-middleware';
import { sanitizeString } from '../utils/sanitization';

export const formTagsRoutes = Router();

// Get all form tags for the user's tenant
formTagsRoutes.get("/", authenticateToken, requirePermission('tags.view'), async (req: any, res) => {
  try {
    console.log('Fetching form tags for tenant:', req.user.tenantId);
    
const tagsList = await db.select()
      .from(contactTags)
      .where(sql`${contactTags.tenantId} = ${req.user.tenantId}`)
      .orderBy(sql`${contactTags.name} ASC`);

    console.log('Found tags:', tagsList.length);
    res.json({ tags: tagsList });
  } catch (error) {
    console.error('Get form tags error:', error);
    res.status(500).json({ message: 'Failed to get form tags' });
  }
});

// Create new form tag
formTagsRoutes.post("/", authenticateToken, requirePermission('tags.create'), async (req: any, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tag name is required' });
    }

    const sanitizedName = sanitizeString(name);

    // Check if tag with same name already exists for this tenant
const existingTag = await db.query.contactTags.findFirst({
      where: sql`${contactTags.tenantId} = ${req.user.tenantId} AND ${contactTags.name} = ${sanitizedName}`,
    });

    if (existingTag) {
      return res.status(400).json({ message: 'A tag with this name already exists' });
    }

const newTag = await db.insert(contactTags).values({
      name: sanitizedName,
      color: color || '#3B82F6',
      tenantId: req.user.tenantId,
    }).returning();

    res.status(201).json(newTag[0]);
  } catch (error) {
    console.error('Create form tag error:', error);
    res.status(500).json({ message: 'Failed to create form tag' });
  }
});

// Delete form tag
formTagsRoutes.delete("/:id", authenticateToken, requirePermission('tags.delete'), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if tag exists and belongs to user's tenant
const existingTag = await db.query.contactTags.findFirst({
      where: sql`${contactTags.id} = ${id} AND ${contactTags.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingTag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

await db.delete(contactTags)
      .where(sql`${contactTags.id} = ${id}`);

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete form tag error:', error);
    res.status(500).json({ message: 'Failed to delete form tag' });
  }
});
