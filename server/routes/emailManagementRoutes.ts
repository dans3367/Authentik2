import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { emailContacts, emailLists, bouncedEmails, contactTags, contactListMemberships, contactTagAssignments } from '@shared/schema';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { type ContactFilters, type BouncedEmailFilters } from '@shared/schema';
import { sanitizeString, sanitizeEmail } from '../utils/sanitization';
import { storage } from '../storage';

export const emailManagementRoutes = Router();

// Get email contacts
emailManagementRoutes.get("/email-contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, tags, lists, status, statsOnly } = req.query;

    // If statsOnly is requested, return only statistics
    if (statsOnly === 'true') {
      const stats = await storage.getEmailContactStats(req.user.tenantId);
      return res.json({ stats });
    }

    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${emailContacts.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${emailContacts.email} ILIKE ${`%${sanitizedSearch}%`} OR
        ${emailContacts.firstName} ILIKE ${`%${sanitizedSearch}%`} OR
        ${emailContacts.lastName} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (status) {
      whereClause = sql`${whereClause} AND ${emailContacts.status} = ${status}`;
    }

    const contactsData = await db.query.emailContacts.findMany({
      where: whereClause,
      with: {
        tagAssignments: {
          columns: {
            id: true,
          },
          with: {
            tag: {
              columns: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        listMemberships: {
          columns: {
            id: true,
          },
          with: {
            list: {
              columns: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: sql`${emailContacts.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const [totalCountResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(emailContacts).where(whereClause);

    // Transform the data to match frontend expectations
    const transformedContacts = contactsData.map(contact => {
      // Extract and transform the relationship data
      const tags = contact.tagAssignments?.map(assignment => assignment.tag).filter(Boolean) || [];
      const lists = contact.listMemberships?.map(membership => membership.list).filter(Boolean) || [];
      
      // Remove the backend-specific relationship fields and add frontend-compatible ones
      const { tagAssignments, listMemberships, ...contactData } = contact;
      
      return {
        ...contactData,
        tags,
        lists,
      };
    });

    res.json({
      contacts: transformedContacts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get email contacts error:', error);
    res.status(500).json({ message: 'Failed to get email contacts' });
  }
});

// Get specific email contact
emailManagementRoutes.get("/email-contacts/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
      with: {
        tagAssignments: {
          with: {
            tag: true,
          },
        },
        listMemberships: {
          with: {
            list: true,
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Transform the data to match frontend expectations
    const tags = contact.tagAssignments?.map(assignment => assignment.tag).filter(Boolean) || [];
    const lists = contact.listMemberships?.map(membership => membership.list).filter(Boolean) || [];
    
    const { tagAssignments, listMemberships, ...contactData } = contact;
    const transformedContact = {
      ...contactData,
      tags,
      lists,
    };

    res.json({ contact: transformedContact });
  } catch (error) {
    console.error('Get email contact error:', error);
    res.status(500).json({ message: 'Failed to get email contact' });
  }
});

// Get contact statistics
emailManagementRoutes.get("/email-contacts/:id/stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Get contact activity statistics
    const stats = {
      totalEmails: 0, // Placeholder - you might have email activity tracking
      lastEmailSent: null,
      lastEmailOpened: null,
      lastEmailClicked: null,
      bounceCount: 0,
      unsubscribeCount: 0,
    };

    res.json(stats);
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({ message: 'Failed to get contact statistics' });
  }
});

// Create email contact
emailManagementRoutes.post("/email-contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email, firstName, lastName, tags, lists, status } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedFirstName = firstName ? sanitizeString(firstName) : null;
    const sanitizedLastName = lastName ? sanitizeString(lastName) : null;

    // Check if contact already exists
    const existingContact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.email} = ${sanitizedEmail} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (existingContact) {
      return res.status(400).json({ message: 'Contact already exists' });
    }

    const newContact = await db.insert(emailContacts).values({
      tenantId: req.user.tenantId,
      email: sanitizedEmail,
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      status: status || 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        await db.insert(contactTagAssignments).values({
          tenantId: req.user.tenantId,
          contactId: newContact[0].id,
          tagId,
          assignedAt: new Date(),
        });
      }
    }

    // Add to lists if provided
    if (lists && Array.isArray(lists)) {
      for (const listId of lists) {
        await db.insert(contactListMemberships).values({
          tenantId: req.user.tenantId,
          contactId: newContact[0].id,
          listId,
          addedAt: new Date(),
        });
      }
    }

    res.status(201).json(newContact[0]);
  } catch (error) {
    console.error('Create email contact error:', error);
    res.status(500).json({ message: 'Failed to create email contact' });
  }
});

// Update email contact
emailManagementRoutes.put("/email-contacts/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, status } = req.body;

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (email !== undefined) {
      const sanitizedEmail = sanitizeEmail(email);
      
      // Check if new email is already taken by another contact
      const existingContact = await db.query.emailContacts.findFirst({
        where: sql`${emailContacts.email} = ${sanitizedEmail} AND ${emailContacts.id} != ${id}`,
      });

      if (existingContact) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      updateData.email = sanitizedEmail;
    }

    if (firstName !== undefined) {
      updateData.firstName = firstName ? sanitizeString(firstName) : null;
    }

    if (lastName !== undefined) {
      updateData.lastName = lastName ? sanitizeString(lastName) : null;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const updatedContact = await db.update(emailContacts)
      .set(updateData)
      .where(sql`${emailContacts.id} = ${id}`)
      .returning();

    res.json(updatedContact[0]);
  } catch (error) {
    console.error('Update email contact error:', error);
    res.status(500).json({ message: 'Failed to update email contact' });
  }
});

// Delete email contact
emailManagementRoutes.delete("/email-contacts/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Delete contact (this will cascade to related records)
    await db.delete(emailContacts)
      .where(sql`${emailContacts.id} = ${id}`);

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete email contact error:', error);
    res.status(500).json({ message: 'Failed to delete email contact' });
  }
});

// Bulk delete email contacts
emailManagementRoutes.delete("/email-contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'Contact IDs array is required' });
    }

    const deletedContacts = await db.delete(emailContacts)
      .where(sql`${emailContacts.id} = ANY(${contactIds})`)
      .returning();

    res.json({
      message: `${deletedContacts.length} contacts deleted successfully`,
      deletedCount: deletedContacts.length,
    });
  } catch (error) {
    console.error('Bulk delete email contacts error:', error);
    res.status(500).json({ message: 'Failed to delete contacts' });
  }
});

// Get email lists
emailManagementRoutes.get("/email-lists", authenticateToken, requireTenant, async (req: any, res) => {
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
emailManagementRoutes.post("/email-lists", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    const newList = await db.insert(emailLists).values({
      name: sanitizedName,
      description: sanitizedDescription,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newList[0]);
  } catch (error) {
    console.error('Create email list error:', error);
    res.status(500).json({ message: 'Failed to create email list' });
  }
});

// Update email list
emailManagementRoutes.put("/email-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const list = await db.query.emailLists.findFirst({
      where: sql`${emailLists.id} = ${id}`,
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
      .where(sql`${emailLists.id} = ${id}`)
      .returning();

    res.json(updatedList[0]);
  } catch (error) {
    console.error('Update email list error:', error);
    res.status(500).json({ message: 'Failed to update email list' });
  }
});

// Delete email list
emailManagementRoutes.delete("/email-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const list = await db.query.emailLists.findFirst({
      where: sql`${emailLists.id} = ${id}`,
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Delete list (this will cascade to contact-list relationships)
    await db.delete(emailLists)
      .where(sql`${emailLists.id} = ${id}`);

    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Delete email list error:', error);
    res.status(500).json({ message: 'Failed to delete email list' });
  }
});

// Get bounced emails
emailManagementRoutes.get("/bounced-emails", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, email, reason, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`1=1`;

    if (email) {
      const sanitizedEmail = sanitizeEmail(email as string);
      whereClause = sql`${whereClause} AND ${bouncedEmails.email} = ${sanitizedEmail}`;
    }

    if (reason) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.reason} = ${reason}`;
    }

    if (startDate) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.bouncedAt} >= ${new Date(startDate as string)}`;
    }

    if (endDate) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.bouncedAt} <= ${new Date(endDate as string)}`;
    }

    const bouncedEmails = await db.query.bouncedEmails.findMany({
      where: whereClause,
      orderBy: sql`${bouncedEmails.bouncedAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(db.bouncedEmails).where(whereClause);

    res.json({
      bouncedEmails,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get bounced emails error:', error);
    res.status(500).json({ message: 'Failed to get bounced emails' });
  }
});

// Check if email is bounced
emailManagementRoutes.get("/bounced-emails/check/:email", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);

    const bouncedEmail = await db.query.bouncedEmails.findFirst({
      where: sql`${bouncedEmails.email} = ${sanitizedEmail}`,
    });

    res.json({
      isBounced: !!bouncedEmail,
      bouncedEmail: bouncedEmail || null,
    });
  } catch (error) {
    console.error('Check bounced email error:', error);
    res.status(500).json({ message: 'Failed to check bounced email' });
  }
});

// Delete bounced email record
emailManagementRoutes.delete("/bounced-emails/:email", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);

    const deletedBounce = await db.delete(bouncedEmails)
      .where(sql`${bouncedEmails.email} = ${sanitizedEmail}`)
      .returning();

    if (deletedBounce.length === 0) {
      return res.status(404).json({ message: 'Bounced email record not found' });
    }

    res.json({ message: 'Bounced email record deleted successfully' });
  } catch (error) {
    console.error('Delete bounced email error:', error);
    res.status(500).json({ message: 'Failed to delete bounced email record' });
  }
});

// Add bounced email record
emailManagementRoutes.post("/bounced-emails", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email, reason, description } = req.body;

    if (!email || !reason) {
      return res.status(400).json({ message: 'Email and reason are required' });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedReason = sanitizeString(reason);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    // Check if already exists
    const existingBounce = await db.query.bouncedEmails.findFirst({
      where: sql`${bouncedEmails.email} = ${sanitizedEmail}`,
    });

    if (existingBounce) {
      return res.status(400).json({ message: 'Bounced email record already exists' });
    }

    const newBouncedEmail = await db.insert(bouncedEmails).values({
      email: sanitizedEmail,
      reason: sanitizedReason,
      description: sanitizedDescription,
      bouncedAt: new Date(),
    }).returning();

    res.status(201).json(newBouncedEmail[0]);
  } catch (error) {
    console.error('Add bounced email error:', error);
    res.status(500).json({ message: 'Failed to add bounced email record' });
  }
});

// Get bounced email statistics
emailManagementRoutes.get("/bounced-emails/stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const stats = await db.select({
      totalBounces: sql<number>`count(*)`,
      bouncesToday: sql<number>`count(*) filter (where bounced_at >= current_date)`,
      bouncesThisWeek: sql<number>`count(*) filter (where bounced_at >= current_date - interval '7 days')`,
      bouncesThisMonth: sql<number>`count(*) filter (where bounced_at >= current_date - interval '30 days')`,
      hardBounces: sql<number>`count(*) filter (where reason = 'hard_bounce')`,
      softBounces: sql<number>`count(*) filter (where reason = 'soft_bounce')`,
      spamComplaints: sql<number>`count(*) filter (where reason = 'spam_complaint')`,
    }).from(db.bouncedEmails);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get bounced email stats error:', error);
    res.status(500).json({ message: 'Failed to get bounced email statistics' });
  }
});

// Get contact tags
emailManagementRoutes.get("/contact-tags", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const tags = await db.query.contactTags.findMany({
      orderBy: sql`${contactTags.name} ASC`,
    });

    res.json(tags);
  } catch (error) {
    console.error('Get contact tags error:', error);
    res.status(500).json({ message: 'Failed to get contact tags' });
  }
});

// Create contact tag
emailManagementRoutes.post("/contact-tags", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { name, color, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const sanitizedName = sanitizeString(name);
    const sanitizedColor = color ? sanitizeString(color) : '#3B82F6';
    const sanitizedDescription = description ? sanitizeString(description) : null;

    const newTag = await db.insert(contactTags).values({
      name: sanitizedName,
      color: sanitizedColor,
      description: sanitizedDescription,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newTag[0]);
  } catch (error) {
    console.error('Create contact tag error:', error);
    res.status(500).json({ message: 'Failed to create contact tag' });
  }
});

// Update contact tag
emailManagementRoutes.put("/contact-tags/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;

    const tag = await db.query.contactTags.findFirst({
      where: sql`${contactTags.id} = ${id}`,
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
      updateData.color = sanitizeString(color);
    }

    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : null;
    }

    const updatedTag = await db.update(contactTags)
      .set(updateData)
      .where(sql`${contactTags.id} = ${id}`)
      .returning();

    res.json(updatedTag[0]);
  } catch (error) {
    console.error('Update contact tag error:', error);
    res.status(500).json({ message: 'Failed to update contact tag' });
  }
});

// Delete contact tag
emailManagementRoutes.delete("/contact-tags/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const tag = await db.query.contactTags.findFirst({
      where: sql`${contactTags.id} = ${id}`,
    });

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Delete tag (this will cascade to contact-tag relationships)
    await db.delete(contactTags)
      .where(sql`${contactTags.id} = ${id}`);

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete contact tag error:', error);
    res.status(500).json({ message: 'Failed to delete contact tag' });
  }
});

// Add contact to list
emailManagementRoutes.post("/email-contacts/:contactId/lists/:listId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId, listId } = req.params;

    // Check if relationship already exists
    const existingRelationship = await db.query.contactListMemberships.findFirst({
      where: sql`${contactListMemberships.contactId} = ${contactId} AND ${contactListMemberships.listId} = ${listId}`,
    });

    if (existingRelationship) {
      return res.status(400).json({ message: 'Contact is already in this list' });
    }

    await db.insert(contactListMemberships).values({
      contactId,
      listId,
    });

    res.json({ message: 'Contact added to list successfully' });
  } catch (error) {
    console.error('Add contact to list error:', error);
    res.status(500).json({ message: 'Failed to add contact to list' });
  }
});

// Remove contact from list
emailManagementRoutes.delete("/email-contacts/:contactId/lists/:listId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId, listId } = req.params;

    const deletedRelationship = await db.delete(contactListMemberships)
      .where(sql`${contactListMemberships.contactId} = ${contactId} AND ${contactListMemberships.listId} = ${listId}`)
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
emailManagementRoutes.post("/email-lists/:listId/contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { listId } = req.params;
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'Contact IDs array is required' });
    }

    const relationships = contactIds.map(contactId => ({
      contactId,
      listId,
    }));

    await db.insert(contactListMemberships).values(relationships);

    res.json({ message: `${contactIds.length} contacts added to list successfully` });
  } catch (error) {
    console.error('Bulk add contacts to list error:', error);
    res.status(500).json({ message: 'Failed to add contacts to list' });
  }
});

// Add tag to contact
emailManagementRoutes.post("/email-contacts/:contactId/tags/:tagId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId, tagId } = req.params;

    // Check if relationship already exists
    const existingRelationship = await db.query.contactTagAssignments.findFirst({
      where: sql`${contactTagAssignments.contactId} = ${contactId} AND ${contactTagAssignments.tagId} = ${tagId}`,
    });

    if (existingRelationship) {
      return res.status(400).json({ message: 'Contact already has this tag' });
    }

    await db.insert(contactTagAssignments).values({
      contactId,
      tagId,
    });

    res.json({ message: 'Tag added to contact successfully' });
  } catch (error) {
    console.error('Add tag to contact error:', error);
    res.status(500).json({ message: 'Failed to add tag to contact' });
  }
});

// Remove tag from contact
emailManagementRoutes.delete("/email-contacts/:contactId/tags/:tagId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId, tagId } = req.params;

    const deletedRelationship = await db.delete(contactTagAssignments)
      .where(sql`${contactTagAssignments.contactId} = ${contactId} AND ${contactTagAssignments.tagId} = ${tagId}`)
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
emailManagementRoutes.post("/contact-tags/:tagId/contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { tagId } = req.params;
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'Contact IDs array is required' });
    }

    const relationships = contactIds.map(contactId => ({
      contactId,
      tagId,
    }));

    await db.insert(contactTagAssignments).values(relationships);

    res.json({ message: `${contactIds.length} contacts tagged successfully` });
  } catch (error) {
    console.error('Bulk tag contacts error:', error);
    res.status(500).json({ message: 'Failed to tag contacts' });
  }
});

// Get contact activity
emailManagementRoutes.get("/email-contacts/:contactId/activity", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // This is a placeholder - you might have an activity log table
    // For now, we'll return empty activity
    const activity = [];

    res.json({
      activity,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: 0,
        pages: 0,
      },
    });
  } catch (error) {
    console.error('Get contact activity error:', error);
    res.status(500).json({ message: 'Failed to get contact activity' });
  }
});