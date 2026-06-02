import { Router } from 'express';
import { db } from '../../db';
import { sql, eq, and } from 'drizzle-orm';
import { emailContacts, contactTags, contactTagAssignments, shops } from '@shared/schema';
import { authenticateToken, requireTenant, requirePermission } from '../../middleware/auth-middleware';
import { sanitizeString } from '../../utils/sanitization';
import { resolveShopId } from '../../utils/defaultShop';

export const contactTagRoutes = Router();

// Get contact tags (filtered by shop when x-shop-id header is present)
contactTagRoutes.get("/contact-tags", authenticateToken, requireTenant, requirePermission('tags.view'), async (req: any, res) => {
  try {
    const whereClause = req.shopId
      ? sql`${contactTags.tenantId} = ${req.user.tenantId} AND ${contactTags.shopId} = ${req.shopId}`
      : sql`${contactTags.tenantId} = ${req.user.tenantId}`;

    const tags = await db.query.contactTags.findMany({
      where: whereClause,
      orderBy: sql`${contactTags.name} ASC`,
      with: {
        assignments: true,
      },
    });

    // Add contact count and shop name to each tag
    const tagsWithCount = await Promise.all(tags.map(async (tag: any) => {
      let shopName: string | null = null;
      if (tag.shopId) {
        const shop = await db.query.shops.findFirst({
          where: and(
            eq(shops.id, tag.shopId),
            eq(shops.tenantId, req.user.tenantId)
          ),
          columns: { name: true },
        });
        shopName = shop?.name ?? null;
      }
      return {
        ...tag,
        shopName,
        contactCount: tag.assignments?.length || 0,
        assignments: undefined,
      };
    }));

    res.json({ tags: tagsWithCount });
  } catch (error) {
    console.error('Get contact tags error:', error);
    res.status(500).json({ message: 'Failed to get contact tags' });
  }
});

// Create contact tag
contactTagRoutes.post("/contact-tags", authenticateToken, requireTenant, requirePermission('tags.create'), async (req: any, res) => {
  try {
    const { name, color, description, shopId: bodyShopId } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    if (!sanitizedName) {
      return res.status(400).json({ message: 'Name cannot be empty or contain only whitespace' });
    }

    const hexColorRegex = /^#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?$/;
    const sanitizedColor = color && hexColorRegex.test(color) ? color : '#3B82F6';

    // Resolve shopId: prefer explicit body shopId, then header, then tenant default
    const tagShopId = await resolveShopId(bodyShopId || req.shopId, req.user.tenantId);

    // Check for duplicate name within tenant + shop
    const dupWhere = tagShopId
      ? sql`${contactTags.tenantId} = ${req.user.tenantId} AND ${contactTags.shopId} = ${tagShopId} AND lower(${contactTags.name}) = lower(${sanitizedName})`
      : sql`${contactTags.tenantId} = ${req.user.tenantId} AND lower(${contactTags.name}) = lower(${sanitizedName})`;
    const existingTag = await db.query.contactTags.findFirst({
      where: dupWhere,
      columns: { id: true },
    });
    if (existingTag) {
      return res.status(400).json({ message: 'A tag with this name already exists' });
    }

    const newTag = await db.insert(contactTags).values({
      tenantId: req.user!.tenantId,
      shopId: tagShopId,
      name: sanitizedName!,
      color: sanitizedColor,
      description: sanitizedDescription,
    }).returning();

    res.status(201).json(newTag[0]);
  } catch (error) {
    console.error('Create contact tag error:', error);
    res.status(500).json({ message: 'Failed to create contact tag' });
  }
});

// Update contact tag
contactTagRoutes.put("/contact-tags/:id", authenticateToken, requireTenant, requirePermission('tags.edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;

    const tag = await db.query.contactTags.findFirst({
      where: sql`${contactTags.id} = ${id} AND ${contactTags.tenantId} = ${req.user.tenantId}`,
    });

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = sanitizeString(name);
    }

    if (color !== undefined) {
      const hexColorRegex = /^#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?$/;
      updateData.color = color && hexColorRegex.test(color) ? color : '#3B82F6';
    }

    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : null;
    }

    const updatedTag = await db.update(contactTags)
      .set(updateData)
      .where(sql`${contactTags.id} = ${id} AND ${contactTags.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json(updatedTag[0]);
  } catch (error) {
    console.error('Update contact tag error:', error);
    res.status(500).json({ message: 'Failed to update contact tag' });
  }
});

// Delete contact tag
contactTagRoutes.delete("/contact-tags/:id", authenticateToken, requireTenant, requirePermission('tags.delete'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const tag = await db.query.contactTags.findFirst({
      where: sql`${contactTags.id} = ${id} AND ${contactTags.tenantId} = ${req.user.tenantId}`,
    });

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Delete tag (this will cascade to contact-tag relationships)
    await db.delete(contactTags)
      .where(sql`${contactTags.id} = ${id} AND ${contactTags.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete contact tag error:', error);
    res.status(500).json({ message: 'Failed to delete contact tag' });
  }
});

// Add tag to contact
contactTagRoutes.post("/email-contacts/:contactId/tags/:tagId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactId, tagId } = req.params;

    const [contact, tag] = await Promise.all([
      db.query.emailContacts.findFirst({
        where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
      db.query.contactTags.findFirst({
        where: sql`${contactTags.id} = ${tagId} AND ${contactTags.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
    ]);

    if (!contact || !tag) {
      return res.status(404).json({ message: 'Contact or tag not found' });
    }

    // Check if relationship already exists
    const existingRelationship = await db.query.contactTagAssignments.findFirst({
      where: sql`${contactTagAssignments.contactId} = ${contactId} AND ${contactTagAssignments.tagId} = ${tagId} AND ${contactTagAssignments.tenantId} = ${req.user.tenantId}`,
    });

    if (existingRelationship) {
      return res.status(400).json({ message: 'Contact already has this tag' });
    }

    await db.insert(contactTagAssignments).values({
      tenantId: req.user.tenantId,
      contactId,
      tagId,
      assignedAt: new Date(),
    });

    res.json({ message: 'Tag added to contact successfully' });
  } catch (error) {
    console.error('Add tag to contact error:', error);
    res.status(500).json({ message: 'Failed to add tag to contact' });
  }
});

// Remove tag from contact
contactTagRoutes.delete("/email-contacts/:contactId/tags/:tagId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactId, tagId } = req.params;

    const [contact, tag] = await Promise.all([
      db.query.emailContacts.findFirst({
        where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
      db.query.contactTags.findFirst({
        where: sql`${contactTags.id} = ${tagId} AND ${contactTags.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
    ]);

    if (!contact || !tag) {
      return res.status(404).json({ message: 'Contact or tag not found' });
    }

    const deletedRelationship = await db.delete(contactTagAssignments)
      .where(sql`${contactTagAssignments.contactId} = ${contactId} AND ${contactTagAssignments.tagId} = ${tagId} AND ${contactTagAssignments.tenantId} = ${req.user.tenantId}`)
      .returning();

    if (deletedRelationship.length === 0) {
      return res.status(404).json({ message: 'Contact does not have this tag' });
    }

    res.json({ message: 'Tag removed from contact successfully' });
  } catch (error) {
    console.error('Remove tag from contact error:', error);
    res.status(500).json({ message: 'Failed to remove tag from contact' });
  }
});

// Add contacts to tag (bulk)
contactTagRoutes.post("/contact-tags/:tagId/contacts", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { tagId } = req.params;
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'Contact IDs array is required' });
    }

    const tag = await db.query.contactTags.findFirst({
      where: sql`${contactTags.id} = ${tagId} AND ${contactTags.tenantId} = ${req.user.tenantId}`,
      columns: { id: true },
    });

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    const contacts = await db.query.emailContacts.findMany({
      where: sql`${emailContacts.id} IN (${sql.join(contactIds, sql`, `)}) AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
      columns: { id: true },
    });

    if (contacts.length !== contactIds.length) {
      return res.status(404).json({ message: 'One or more contacts not found' });
    }

    const relationships = contactIds.map(contactId => ({
      tenantId: req.user.tenantId,
      contactId,
      tagId,
      assignedAt: new Date(),
    }));

    await db.insert(contactTagAssignments).values(relationships);

    res.json({ message: `${contactIds.length} contacts tagged successfully` });
  } catch (error) {
    console.error('Bulk tag contacts error:', error);
    res.status(500).json({ message: 'Failed to tag contacts' });
  }
});
