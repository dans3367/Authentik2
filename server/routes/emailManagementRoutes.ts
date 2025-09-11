import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { emailContacts, emailLists, bouncedEmails, contactTags, contactListMemberships, contactTagAssignments, betterAuthUser, birthdaySettings, emailActivity } from '@shared/schema';
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
      columns: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        addedDate: true,
        lastActivity: true,
        emailsSent: true,
        emailsOpened: true,
        birthday: true,
        birthdayEmailEnabled: true,
        consentGiven: true,
        consentDate: true,
        consentMethod: true,
        consentIpAddress: true,
        consentUserAgent: true,
        addedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
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

// Create email contact with batch operations
emailManagementRoutes.post("/email-contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email, firstName, lastName, tags, lists, status, consentGiven, consentMethod, consentIpAddress, consentUserAgent } = req.body;

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

    const now = new Date();

    // Use a transaction for batch operations
    const result = await db.transaction(async (tx) => {
      // Ensure the user exists in betterAuthUser table before setting addedByUserId
      let userExists = false;
      try {
        const existingUser = await tx.query.betterAuthUser.findFirst({
          where: sql`${betterAuthUser.id} = ${req.user.id}`,
        });
        
        if (!existingUser) {
          // User doesn't exist in betterAuthUser table, create a basic record
          console.log('🔧 Creating missing betterAuthUser record for:', req.user.email);
          try {
            await tx.insert(betterAuthUser).values({
              id: req.user.id,
              email: req.user.email,
              name: req.user.name || req.user.email,
              emailVerified: true, // Assume verified since they can authenticate
              role: req.user.role || 'Employee',
              tenantId: req.user.tenantId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            userExists = true;
            console.log('✅ Created betterAuthUser record successfully');
          } catch (insertError) {
            console.error('❌ Failed to create betterAuthUser record:', insertError);
            userExists = false;
          }
        } else {
          userExists = true;
        }
      } catch (error) {
        console.warn('Could not verify user existence:', error);
        userExists = false;
      }

      // Create the contact
      const newContact = await tx.insert(emailContacts).values({
        tenantId: req.user.tenantId,
        email: sanitizedEmail,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        status: status || 'active',
        consentGiven: consentGiven || false,
        consentMethod: consentMethod || null,
        consentDate: consentGiven ? now : null,
        consentIpAddress: consentIpAddress || null,
        consentUserAgent: consentUserAgent || null,
        addedByUserId: userExists ? req.user.id : null,
        createdAt: now,
        updatedAt: now,
      }).returning();

      const contact = newContact[0];

      // Batch insert tags if provided
      if (tags && Array.isArray(tags) && tags.length > 0) {
        const tagAssignments = tags.map(tagId => ({
          tenantId: req.user.tenantId,
          contactId: contact.id,
          tagId,
          assignedAt: now,
        }));
        await tx.insert(contactTagAssignments).values(tagAssignments);
      }

      // Batch insert list memberships if provided
      if (lists && Array.isArray(lists) && lists.length > 0) {
        const listMemberships = lists.map(listId => ({
          tenantId: req.user.tenantId,
          contactId: contact.id,
          listId,
          addedAt: now,
        }));
        await tx.insert(contactListMemberships).values(listMemberships);
      }

      return contact;
    });

    res.status(201).json(result);
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
      where: sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Delete contact (this will cascade to related records)
    await db.delete(emailContacts)
      .where(sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete email contact error:', error);
    res.status(500).json({ message: 'Failed to delete email contact' });
  }
});

// Bulk delete email contacts
emailManagementRoutes.delete("/email-contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactIds, ids } = req.body;

    // Handle both formats for backward compatibility
    const contactIdsArray = contactIds || ids;

    if (!Array.isArray(contactIdsArray) || contactIdsArray.length === 0) {
      return res.status(400).json({ message: 'Contact IDs array is required' });
    }

    // First verify all contacts belong to the current tenant
    const contactsToDelete = await db.query.emailContacts.findMany({
      where: sql`${emailContacts.id} IN (${sql.join(contactIdsArray, sql`, `)}) AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
      columns: {
        id: true,
      },
    });

    if (contactsToDelete.length === 0) {
      return res.status(404).json({ message: 'No contacts found to delete' });
    }

    // Check if all requested contacts were found (to ensure no cross-tenant access)
    if (contactsToDelete.length !== contactIdsArray.length) {
      return res.status(400).json({ message: 'Some contacts not found or access denied' });
    }

    const deletedContacts = await db.delete(emailContacts)
      .where(sql`${emailContacts.id} IN (${sql.join(contactIdsArray, sql`, `)}) AND ${emailContacts.tenantId} = ${req.user.tenantId}`)
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
      whereClause = sql`${whereClause} AND ${bouncedEmails.bounceReason} = ${reason}`;
    }

    if (startDate) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.firstBouncedAt} >= ${new Date(startDate as string)}`;
    }

    if (endDate) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.lastBouncedAt} <= ${new Date(endDate as string)}`;
    }

    const bouncedEmailsData = await db.query.bouncedEmails.findMany({
      where: whereClause,
      orderBy: sql`${bouncedEmails.lastBouncedAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(bouncedEmails).where(whereClause);

    res.json({
      bouncedEmails: bouncedEmailsData,
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
    const { page = 1, limit = 50, from, to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Verify contact belongs to this tenant
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
      columns: { id: true }
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Build the where clause for activity filtering
    let whereClause = sql`${emailActivity.contactId} = ${contactId} AND ${emailActivity.tenantId} = ${req.user.tenantId}`;

    // Add date range filtering if provided
    if (from) {
      const fromDate = new Date(from as string);
      if (!isNaN(fromDate.getTime())) {
        whereClause = sql`${whereClause} AND ${emailActivity.occurredAt} >= ${fromDate.toISOString()}`;
      }
    }

    if (to) {
      const toDate = new Date(to as string);
      if (!isNaN(toDate.getTime())) {
        whereClause = sql`${whereClause} AND ${emailActivity.occurredAt} <= ${toDate.toISOString()}`;
      }
    }

    // Get the activity records with related data
    const activities = await db.query.emailActivity.findMany({
      where: whereClause,
      columns: {
        id: true,
        activityType: true,
        activityData: true,
        userAgent: true,
        ipAddress: true,
        webhookId: true,
        webhookData: true,
        occurredAt: true,
        createdAt: true,
      },
      with: {
        campaign: {
          columns: {
            id: true,
            name: true,
          }
        },
        newsletter: {
          columns: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: sql`${emailActivity.occurredAt} DESC`,
      limit: Number(limit),
      offset,
    });

    // Get total count for pagination
    const [totalCountResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(emailActivity).where(whereClause);

    // Transform activities for frontend consumption
    const transformedActivities = activities.map(activity => ({
      id: activity.id,
      activityType: activity.activityType,
      occurredAt: activity.occurredAt,
      activityData: activity.activityData,
      userAgent: activity.userAgent,
      ipAddress: activity.ipAddress,
      webhookId: activity.webhookId,
      webhookData: activity.webhookData,
      campaign: activity.campaign,
      newsletter: activity.newsletter,
      createdAt: activity.createdAt,
    }));

    res.json({
      activities: transformedActivities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get contact activity error:', error);
    res.status(500).json({ message: 'Failed to get contact activity' });
  }
});

// Update contact's birthday email preference
emailManagementRoutes.patch("/email-contacts/:contactId/birthday-email", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Verify contact exists and belongs to tenant
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Update birthday email preference
    const updatedContact = await db.update(emailContacts)
      .set({ 
        birthdayEmailEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(sql`${emailContacts.id} = ${contactId}`)
      .returning();

    res.json({ 
      message: `Birthday email preference ${enabled ? 'enabled' : 'disabled'} successfully`,
      contact: updatedContact[0]
    });
  } catch (error) {
    console.error('Update birthday email preference error:', error);
    res.status(500).json({ message: 'Failed to update birthday email preference' });
  }
});

// Bulk update birthday email preferences
emailManagementRoutes.patch("/email-contacts/birthday-email/bulk", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactIds, enabled } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'contactIds array is required' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Verify all contacts exist and belong to tenant
    const contacts = await db.query.emailContacts.findMany({
      where: sql`${emailContacts.tenantId} = ${req.user.tenantId} AND ${emailContacts.id} = ANY(${contactIds})`,
    });

    if (contacts.length !== contactIds.length) {
      return res.status(400).json({ message: 'Some contacts were not found or do not belong to your tenant' });
    }

    // Update birthday email preferences for all specified contacts
    const updatedContacts = await db.update(emailContacts)
      .set({ 
        birthdayEmailEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(sql`${emailContacts.id} = ANY(${contactIds})`)
      .returning();

    res.json({ 
      message: `Birthday email preference ${enabled ? 'enabled' : 'disabled'} for ${updatedContacts.length} contacts`,
      updatedContacts: updatedContacts.length
    });
  } catch (error) {
    console.error('Bulk update birthday email preferences error:', error);
    res.status(500).json({ message: 'Failed to update birthday email preferences' });
  }
});

// Get contacts with birthdays
emailManagementRoutes.get("/birthday-contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, upcomingOnly = 'false' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${emailContacts.tenantId} = ${req.user.tenantId} AND ${emailContacts.birthday} IS NOT NULL`;

    // If upcomingOnly is true, filter for birthdays in the next 30 days
    if (upcomingOnly === 'true') {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      // This is a simplified approach - you might need more complex logic for year-agnostic birthday matching
      whereClause = sql`${whereClause} AND ${emailContacts.birthday} IS NOT NULL`;
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
              },
            },
          },
        },
      },
      limit: Number(limit),
      offset: offset,
      orderBy: [emailContacts.birthday],
    });

    // Transform the data to match the expected frontend format
    const contacts = contactsData.map(contact => ({
      ...contact,
      tags: contact.tagAssignments.map(ta => ta.tag),
      lists: contact.listMemberships.map(lm => lm.list),
    }));

    // Get total count
    const totalResult = await db.select({
      count: sql<number>`count(*)`,
    }).from(emailContacts).where(whereClause);
    const total = totalResult[0].count;

    res.json({
      contacts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get birthday contacts error:', error);
    res.status(500).json({ message: 'Failed to get birthday contacts' });
  }
});

// Get birthday settings
emailManagementRoutes.get("/birthday-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const settings = await db.query.birthdaySettings.findFirst({
      where: sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`,
    });

    // If no settings exist, return default settings
    if (!settings) {
      const defaultSettings = {
        id: '',
        enabled: false,
        sendDaysBefore: 0,
        emailTemplate: 'default',
        segmentFilter: 'all',
        customMessage: '',
        senderName: '',
        senderEmail: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return res.json(defaultSettings);
    }

    res.json(settings);
  } catch (error) {
    console.error('Get birthday settings error:', error);
    res.status(500).json({ message: 'Failed to get birthday settings' });
  }
});

// Update birthday settings
emailManagementRoutes.put("/birthday-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { 
      enabled, 
      sendDaysBefore, 
      emailTemplate, 
      segmentFilter, 
      customMessage, 
      senderName, 
      senderEmail 
    } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    if (sendDaysBefore !== undefined && (!Number.isInteger(sendDaysBefore) || sendDaysBefore < 0 || sendDaysBefore > 30)) {
      return res.status(400).json({ message: 'sendDaysBefore must be an integer between 0 and 30' });
    }

    if (senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      return res.status(400).json({ message: 'Please enter a valid sender email address' });
    }

    // Check if settings already exist
    const existingSettings = await db.query.birthdaySettings.findFirst({
      where: sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`,
    });

    let updatedSettings;
    
    if (existingSettings) {
      // Update existing settings
      updatedSettings = await db.update(birthdaySettings)
        .set({
          enabled,
          sendDaysBefore,
          emailTemplate,
          segmentFilter,
          customMessage,
          senderName,
          senderEmail,
          updatedAt: new Date(),
        })
        .where(sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`)
        .returning();
    } else {
      // Create new settings
      updatedSettings = await db.insert(birthdaySettings)
        .values({
          tenantId: req.user.tenantId,
          enabled,
          sendDaysBefore,
          emailTemplate,
          segmentFilter,
          customMessage,
          senderName,
          senderEmail,
        })
        .returning();
    }

    res.json({
      message: 'Birthday settings updated successfully',
      settings: updatedSettings[0],
    });
  } catch (error) {
    console.error('Update birthday settings error:', error);
    res.status(500).json({ message: 'Failed to update birthday settings' });
  }
});