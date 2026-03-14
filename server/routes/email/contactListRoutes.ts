import { Router } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { emailContacts, emailLists, contactListMemberships } from '@shared/schema';
import { authenticateToken, requireTenant, requirePermission } from '../../middleware/auth-middleware';
import { sanitizeString } from '../../utils/sanitization';

export const contactListRoutes = Router();

// Get email lists
contactListRoutes.get("/email-lists", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const lists = await db.query.emailLists.findMany({
      where: sql`${emailLists.tenantId} = ${req.user.tenantId}`,
      orderBy: sql`${emailLists.createdAt} DESC`,
    });

    res.json(lists);
  } catch (error) {
    console.error('Get email lists error:', error);
    res.status(500).json({ message: 'Failed to get email lists' });
  }
});

// Create email list
contactListRoutes.post("/email-lists", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    // Additional validation after sanitization
    if (!sanitizedName) {
      return res.status(400).json({ message: 'Name cannot be empty or contain only whitespace' });
    }

    const newList = await db.insert(emailLists).values({
      tenantId: req.user!.tenantId,
      name: sanitizedName!,
      description: sanitizedDescription,
    }).returning();

    res.status(201).json(newList[0]);
  } catch (error) {
    console.error('Create email list error:', error);
    res.status(500).json({ message: 'Failed to create email list' });
  }
});

// Update email list
contactListRoutes.put("/email-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const list = await db.query.emailLists.findFirst({
      where: sql`${emailLists.id} = ${id} AND ${emailLists.tenantId} = ${req.user.tenantId}`,
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
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

    const updatedList = await db.update(emailLists)
      .set(updateData)
      .where(sql`${emailLists.id} = ${id} AND ${emailLists.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json(updatedList[0]);
  } catch (error) {
    console.error('Update email list error:', error);
    res.status(500).json({ message: 'Failed to update email list' });
  }
});

// Delete email list
contactListRoutes.delete("/email-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const list = await db.query.emailLists.findFirst({
      where: sql`${emailLists.id} = ${id} AND ${emailLists.tenantId} = ${req.user.tenantId}`,
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Delete list (this will cascade to contact-list relationships)
    await db.delete(emailLists)
      .where(sql`${emailLists.id} = ${id} AND ${emailLists.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Delete email list error:', error);
    res.status(500).json({ message: 'Failed to delete email list' });
  }
});

// Add contact to list
contactListRoutes.post("/email-contacts/:contactId/lists/:listId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactId, listId } = req.params;

    const [contact, list] = await Promise.all([
      db.query.emailContacts.findFirst({
        where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
      db.query.emailLists.findFirst({
        where: sql`${emailLists.id} = ${listId} AND ${emailLists.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
    ]);

    if (!contact || !list) {
      return res.status(404).json({ message: 'Contact or list not found' });
    }

    // Check if relationship already exists
    const existingRelationship = await db.query.contactListMemberships.findFirst({
      where: sql`${contactListMemberships.contactId} = ${contactId} AND ${contactListMemberships.listId} = ${listId} AND ${contactListMemberships.tenantId} = ${req.user.tenantId}`,
    });

    if (existingRelationship) {
      return res.status(400).json({ message: 'Contact is already in this list' });
    }

    await db.insert(contactListMemberships).values({
      tenantId: req.user.tenantId,
      contactId,
      listId,
      addedAt: new Date(),
    });

    res.json({ message: 'Contact added to list successfully' });
  } catch (error) {
    console.error('Add contact to list error:', error);
    res.status(500).json({ message: 'Failed to add contact to list' });
  }
});

// Remove contact from list
contactListRoutes.delete("/email-contacts/:contactId/lists/:listId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactId, listId } = req.params;

    const [contact, list] = await Promise.all([
      db.query.emailContacts.findFirst({
        where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
      db.query.emailLists.findFirst({
        where: sql`${emailLists.id} = ${listId} AND ${emailLists.tenantId} = ${req.user.tenantId}`,
        columns: { id: true },
      }),
    ]);

    if (!contact || !list) {
      return res.status(404).json({ message: 'Contact or list not found' });
    }

    const deletedRelationship = await db.delete(contactListMemberships)
      .where(sql`${contactListMemberships.contactId} = ${contactId} AND ${contactListMemberships.listId} = ${listId} AND ${contactListMemberships.tenantId} = ${req.user.tenantId}`)
      .returning();

    if (deletedRelationship.length === 0) {
      return res.status(404).json({ message: 'Contact is not in this list' });
    }

    res.json({ message: 'Contact removed from list successfully' });
  } catch (error) {
    console.error('Remove contact from list error:', error);
    res.status(500).json({ message: 'Failed to remove contact from list' });
  }
});

// Add contacts to list (bulk)
contactListRoutes.post("/email-lists/:listId/contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { listId } = req.params;
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'Contact IDs array is required' });
    }

    const list = await db.query.emailLists.findFirst({
      where: sql`${emailLists.id} = ${listId} AND ${emailLists.tenantId} = ${req.user.tenantId}`,
      columns: { id: true },
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
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
      listId,
      addedAt: new Date(),
    }));

    await db.insert(contactListMemberships).values(relationships);

    res.json({ message: `${contactIds.length} contacts added to list successfully` });
  } catch (error) {
    console.error('Bulk add contacts to list error:', error);
    res.status(500).json({ message: 'Failed to add contacts to list' });
  }
});
