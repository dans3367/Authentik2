import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and } from 'drizzle-orm';
import { emailContacts, emailLists, bouncedEmails, contactTags, contactListMemberships, contactTagAssignments, betterAuthUser, birthdaySettings, emailActivity, tenants, emailSends, emailContent, companies } from '@shared/schema';
import { deleteImageFromR2 } from '../config/r2';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { type ContactFilters, type BouncedEmailFilters } from '@shared/schema';
import { sanitizeString, sanitizeEmail } from '../utils/sanitization';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';

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
        birthdayUnsubscribedAt: true,
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
    const { email, firstName, lastName, status, birthday } = req.body;

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

    // Optional birthday update in YYYY-MM-DD format
    if (birthday !== undefined) {
      // Minimal validation: YYYY-MM-DD
      const isValid = typeof birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthday);
      if (!isValid) {
        return res.status(400).json({ message: 'Birthday must be in YYYY-MM-DD format' });
      }
      updateData.birthday = birthday || null;
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

    // Check if contact has unsubscribed from birthday emails
    if (enabled && contact.birthdayUnsubscribedAt) {
      return res.status(403).json({
        message: 'Cannot re-enable birthday emails for a contact who has unsubscribed. The customer must opt-in again through the unsubscribe link.',
        reason: 'unsubscribed'
      });
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

    // Check if any contacts have unsubscribed from birthday emails when enabling
    if (enabled) {
      const unsubscribedContacts = contacts.filter(c => c.birthdayUnsubscribedAt);
      if (unsubscribedContacts.length > 0) {
        return res.status(403).json({
          message: `Cannot re-enable birthday emails for ${unsubscribedContacts.length} contact(s) who have unsubscribed. These customers must opt-in again through the unsubscribe link.`,
          reason: 'unsubscribed',
          unsubscribedContactIds: unsubscribedContacts.map(c => c.id)
        });
      }
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
      with: {
        promotion: true,
      },
    });

    // Get company information to get company name
    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId} AND ${companies.isActive} = true`,
    });

    // If no settings exist, return default settings
    if (!settings) {
      console.log('🎨 [Birthday Settings GET] No settings found, returning defaults');
      const defaultSettings = {
        id: '',
        enabled: false,
        emailTemplate: 'default',
        segmentFilter: 'all',
        customMessage: '',
        senderName: company?.name || 'Your Company',
        promotionId: null,
        promotion: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return res.json(defaultSettings);
    }

    // Ensure senderName is always present with a default value
    const settingsWithDefaults = {
      ...settings,
      senderName: settings.senderName || company?.name || 'Your Company'
    };

    console.log('🎨 [Birthday Settings GET] Returning settings:', {
      id: settingsWithDefaults.id,
      emailTemplate: settingsWithDefaults.emailTemplate,
      enabled: settingsWithDefaults.enabled,
      customThemeData: settingsWithDefaults.customThemeData ? 'present' : 'null'
    });

    res.json(settingsWithDefaults);
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
      emailTemplate,
      segmentFilter,
      customMessage,
      customThemeData,
      senderName,
      promotionId,
      splitPromotionalEmail
    } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Validate required string fields
    if (emailTemplate === undefined || emailTemplate === null || typeof emailTemplate !== 'string') {
      return res.status(400).json({ message: 'emailTemplate is required and must be a string' });
    }

    if (segmentFilter === undefined || segmentFilter === null || typeof segmentFilter !== 'string') {
      return res.status(400).json({ message: 'segmentFilter is required and must be a string' });
    }

    if (customMessage === undefined || customMessage === null || typeof customMessage !== 'string') {
      return res.status(400).json({ message: 'customMessage is required and must be a string' });
    }

    // Handle senderName - use default if not provided, null, or empty
    let finalSenderName: string;
    if (senderName && typeof senderName === 'string' && senderName.trim() !== '') {
      finalSenderName = senderName.trim();
    } else {
      // Get company name as fallback
      const company = await db.query.companies.findFirst({
        where: sql`${companies.tenantId} = ${req.user.tenantId} AND ${companies.isActive} = true`,
      });
      finalSenderName = company?.name || 'Your Company';
    }

    // Validate promotionId if provided
    if (promotionId !== null && promotionId !== undefined && typeof promotionId !== 'string') {
      return res.status(400).json({ message: 'promotionId must be a string or null' });
    }





    // Validate custom theme data if provided
    if (customThemeData !== undefined) {
      try {
        if (typeof customThemeData === 'string') {
          JSON.parse(customThemeData);
        } else if (typeof customThemeData === 'object' && customThemeData !== null) {
          // Allow any valid object structure for customThemeData
          // The frontend sends nested theme data which is valid
        } else {
          return res.status(400).json({ message: 'customThemeData must be a valid JSON string or object' });
        }
      } catch (error) {
        return res.status(400).json({ message: 'customThemeData must be valid JSON' });
      }
    }

    // Check if settings already exist
    const existingSettings = await db.query.birthdaySettings.findFirst({
      where: sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`,
    });

    // Handle old image cleanup if custom theme data is being updated
    let oldImageUrl: string | null = null;
    if (customThemeData && existingSettings?.customThemeData) {
      try {
        const existingCustomData = JSON.parse(existingSettings.customThemeData);
        oldImageUrl = existingCustomData?.imageUrl || null;
      } catch (error) {
        console.warn('Failed to parse existing custom theme data:', error);
      }
    }

    let updatedSettings;

    // Prepare custom theme data for storage
    const customThemeDataStr = customThemeData ?
      (typeof customThemeData === 'string' ? customThemeData : JSON.stringify(customThemeData))
      : undefined;

    if (existingSettings) {
      // Update existing settings
      const updateData: any = {
        enabled,
        emailTemplate,
        segmentFilter,
        customMessage,
        senderName: finalSenderName,
        promotionId: promotionId || null,
        splitPromotionalEmail: splitPromotionalEmail !== undefined ? splitPromotionalEmail : false,
        updatedAt: new Date(),
      };

      if (customThemeDataStr !== undefined) {
        updateData.customThemeData = customThemeDataStr;
      }

      updatedSettings = await db.update(birthdaySettings)
        .set(updateData)
        .where(sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`)
        .returning();
    } else {
      // Create new settings
      const insertData: any = {
        tenantId: req.user.tenantId,
        enabled,
        emailTemplate,
        segmentFilter,
        customMessage,
        senderName: finalSenderName,
        promotionId: promotionId || null,
        splitPromotionalEmail: splitPromotionalEmail !== undefined ? splitPromotionalEmail : false,
      };

      if (customThemeDataStr !== undefined) {
        insertData.customThemeData = customThemeDataStr;
      }

      updatedSettings = await db.insert(birthdaySettings)
        .values(insertData)
        .returning();
    }

    // Clean up old image after successful database update
    if (oldImageUrl && customThemeDataStr) {
      try {
        const newCustomData = typeof customThemeData === 'string' ? JSON.parse(customThemeData) : customThemeData;
        const newImageUrl = newCustomData?.imageUrl || null;

        // Only delete old image if a new different image is being set or image is being removed
        if (newImageUrl !== oldImageUrl) {
          console.log('📸 [Birthday Settings] Cleaning up old image:', oldImageUrl);
          // Delete old image asynchronously (don't wait for it to complete)
          deleteImageFromR2(oldImageUrl).catch(error => {
            console.error('📸 [Birthday Settings] Failed to delete old image:', oldImageUrl, error);
          });
        }
      } catch (error) {
        console.warn('Failed to compare image URLs for cleanup:', error);
      }
    }

    // Log what we're about to return
    console.log('🎨 [Birthday Settings PUT] Returning updated settings:', {
      id: updatedSettings[0]?.id,
      emailTemplate: updatedSettings[0]?.emailTemplate,
      enabled: updatedSettings[0]?.enabled,
      customThemeData: updatedSettings[0]?.customThemeData ? 'present' : 'null'
    });

    // Return just the settings object to match GET endpoint structure
    res.json(updatedSettings[0]);
  } catch (error) {
    console.error('Update birthday settings error:', error);
    res.status(500).json({ message: 'Failed to update birthday settings' });
  }
});

// Send birthday invitation email to a contact
emailManagementRoutes.post("/birthday-invitation/:contactId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId } = req.params;

    // Find the contact
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Check if contact already has a birthday
    if (contact.birthday) {
      return res.status(400).json({ message: 'Contact already has a birthday set' });
    }

    // Get tenant information for the email
    const tenant = await db.query.tenants.findFirst({
      where: sql`${tenants.id} = ${req.user.tenantId}`,
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Create profile update URL with token
    const profileUpdateToken = jwt.sign(
      { contactId, action: 'update_birthday' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    const profileUpdateUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/update-profile?token=${profileUpdateToken}`;
    console.log('🔗 [Birthday Invitation] Generated URL:', profileUpdateUrl, '| BASE_URL env:', process.env.BASE_URL);

    // Create email content
    const contactName = contact.firstName ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}` : 'Valued Customer';
    const subject = `🎂 Help us celebrate your special day!`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Birthday Information Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #e91e63; margin: 0;">🎂 Birthday Celebration!</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0; font-size: 16px;">Hi ${contactName},</p>
          
          <p style="margin: 0 0 15px 0;">We'd love to make your birthday extra special! To ensure you don't miss out on exclusive birthday promotions, special offers, and personalized birthday surprises, we'd like to add your birthday to our records.</p>
          
          <p style="margin: 0 0 20px 0;">By sharing your birthday with us, you'll receive:</p>
          
          <ul style="margin: 0 0 20px 20px; padding: 0;">
            <li>🎁 Exclusive birthday discounts and offers</li>
            <li>🎉 Special birthday promotions</li>
            <li>📧 Personalized birthday messages</li>
            <li>🌟 Early access to birthday-themed content</li>
          </ul>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${profileUpdateUrl}" 
               style="background: linear-gradient(135deg, #e91e63, #f06292); 
                      color: white; 
                      padding: 12px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      display: inline-block; 
                      box-shadow: 0 4px 8px rgba(233, 30, 99, 0.3);">
              🎂 Add My Birthday
            </a>
          </div>
          
          <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">This link will expire in 30 days. Your privacy is important to us - we'll only use your birthday to send you special offers and birthday wishes.</p>
          
          <div style="margin-top: 20px; padding: 15px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: bold;">If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="margin: 0; word-break: break-all;">
              <a href="${profileUpdateUrl}" style="color: #e91e63; text-decoration: none; font-size: 12px;">${profileUpdateUrl}</a>
            </p>
          </div>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
          <p style="margin: 0;">Best regards,<br>${tenant.name || 'The Team'}</p>
          <p style="margin: 10px 0 0 0;">This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    // Send the email using the email service
    const { enhancedEmailService } = await import('../emailService');

    const result = await enhancedEmailService.sendCustomEmail(
      contact.email,
      subject,
      htmlContent,
      {
        metadata: {
          type: 'birthday_invitation',
          contactId: contact.id,
          tenantId: req.user.tenantId
        }
      }
    );

    if (result.success) {
      res.json({
        message: 'Birthday invitation sent successfully',
        messageId: result.messageId
      });
    } else {
      throw new Error('Failed to send email');
    }

  } catch (error) {
    console.error('Send birthday invitation error:', error);
    res.status(500).json({ message: 'Failed to send birthday invitation' });
  }
});

// Update contact profile via token (for customers)
emailManagementRoutes.post("/update-profile", async (req: any, res) => {
  try {
    const { token, birthday } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Verify the token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (decoded.action !== 'update_birthday') {
      return res.status(401).json({ message: 'Invalid token action' });
    }

    const { contactId } = decoded;

    if (!birthday) {
      return res.status(400).json({ message: 'Birthday is required' });
    }

    // Validate birthday format (YYYY-MM-DD)
    const birthdayRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthdayRegex.test(birthday)) {
      return res.status(400).json({ message: 'Invalid birthday format. Use YYYY-MM-DD' });
    }

    // Update the contact's birthday
    const updatedContact = await db.update(emailContacts)
      .set({
        birthday,
        birthdayEmailEnabled: true, // Enable birthday emails by default when they add their birthday
        updatedAt: new Date()
      })
      .where(sql`${emailContacts.id} = ${contactId}`)
      .returning();

    if (updatedContact.length === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({
      message: 'Birthday updated successfully',
      contact: {
        id: updatedContact[0].id,
        birthday: updatedContact[0].birthday,
        birthdayEmailEnabled: updatedContact[0].birthdayEmailEnabled
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Get profile update form (for customers)
emailManagementRoutes.get("/profile-form", async (req: any, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Verify the token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (decoded.action !== 'update_birthday') {
      return res.status(401).json({ message: 'Invalid token action' });
    }

    const { contactId } = decoded;

    // Get contact information
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId}`,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        birthday: true
      }
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({
      contact: {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        birthday: contact.birthday
      }
    });

  } catch (error) {
    console.error('Get profile form error:', error);
    res.status(500).json({ message: 'Failed to get profile information' });
  }
});

// Internal birthday invitation endpoint for server-node (no auth required)
emailManagementRoutes.post("/internal/birthday-invitation", async (req: any, res) => {
  try {
    const {
      contactId,
      contactEmail,
      contactFirstName,
      contactLastName,
      tenantName,
      htmlContent,
      fromEmail
    } = req.body;

    if (!contactId || !contactEmail || !htmlContent) {
      return res.status(400).json({ message: 'contactId, contactEmail, and htmlContent are required' });
    }

    // Send the email using the email service
    const { enhancedEmailService } = await import('../emailService');

    const result = await enhancedEmailService.sendCustomEmail(
      contactEmail,
      '🎂 Help us celebrate your special day!',
      htmlContent,
      {
        from: fromEmail || 'admin@zendwise.work',
        metadata: {
          type: 'birthday_invitation',
          contactId: contactId,
          source: 'server-node-workflow'
        }
      }
    );

    if (result.success) {
      res.json({
        message: 'Birthday invitation sent successfully',
        messageId: result.messageId,
        success: true
      });
    } else {
      throw new Error('Failed to send email');
    }

  } catch (error) {
    console.error('Send internal birthday invitation error:', error);
    res.status(500).json({ message: 'Failed to send birthday invitation' });
  }
});

// Birthday unsubscribe page
emailManagementRoutes.get("/api/unsubscribe/birthday", async (req: any, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Unsubscribe Link</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Invalid Unsubscribe Link</h1>
            <p>This unsubscribe link is invalid or has expired.</p>
          </body>
        </html>
      `);
    }

    // TODO: Validate token and get contact info
    // For now, show a simple unsubscribe form
    res.send(`
      <html>
        <head>
          <title>Unsubscribe from Birthday Cards</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: #f9f9f9; padding: 30px; border-radius: 8px; text-align: center; }
            .button { background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            .button:hover { background: #c82333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎂 Unsubscribe from Birthday Cards</h1>
            <p>We're sorry to see you go! You can unsubscribe from receiving birthday card notifications below.</p>
            <form method="POST" action="/api/api/unsubscribe/birthday">
              <input type="hidden" name="token" value="${token}" />
              <button type="submit" class="button">Unsubscribe</button>
            </form>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Birthday unsubscribe page error:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error</h1>
          <p>An error occurred while processing your request.</p>
        </body>
      </html>
    `);
  }
});

// Process birthday unsubscribe
emailManagementRoutes.post("/api/unsubscribe/birthday", async (req: any, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Request</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Invalid Request</h1>
            <p>Token is required.</p>
          </body>
        </html>
      `);
    }

    // TODO: Process unsubscribe token and update contact
    // For now, show success message
    res.send(`
      <html>
        <head>
          <title>Unsubscribed Successfully</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: #d4edda; padding: 30px; border-radius: 8px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from birthday card notifications.</p>
            <p>You can always contact us if you change your mind.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Birthday unsubscribe processing error:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error</h1>
          <p>An error occurred while processing your unsubscribe request.</p>
        </body>
      </html>
    `);
  }
});
// Send manual birthday cards to selected contacts
emailManagementRoutes.post("/email-contacts/send-birthday-card", authenticateToken, async (req: any, res) => {
  try {
    const { contactIds } = req.body;
    const tenantId = req.user.tenantId;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required',
      });
    }

    console.log(`🎂 [ManualBirthdayCard] Sending birthday cards to ${contactIds.length} contact(s)`);

    // Get birthday settings for this tenant with promotion data
    const settings = await db.query.birthdaySettings.findFirst({
      where: eq(birthdaySettings.tenantId, tenantId),
      with: {
        promotion: true,
      },
    });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Birthday settings not found. Please configure birthday settings first.',
      });
    }

    // Fetch the selected contacts
    const contacts = await db.query.emailContacts.findMany({
      where: and(
        eq(emailContacts.tenantId, tenantId),
        sql`${emailContacts.id} IN (${sql.join(contactIds.map((id: string) => sql`${id}`), sql`, `)})`
      ),
    });

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid contacts found',
      });
    }

    const results = [];
    const cardprocessorUrl = process.env.CARDPROCESSOR_URL || 'http://localhost:5004';

    // Import email service
    const { enhancedEmailService } = await import('../emailService');

    // Send birthday cards to each contact
    for (const contact of contacts) {
      try {
        // Prepare recipient name (needed for both split and combined flows)
        const recipientName = contact.firstName || contact.lastName
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
          : contact.email.split('@')[0];

        // Generate unsubscribe token (needed for both split and combined flows)
        let unsubscribeToken: string | undefined;
        try {
          // Generate a JWT token for internal API call to cardprocessor
          const internalToken = jwt.sign(
            {
              sub: req.user.id,
              tenant: tenantId,
              type: 'internal',
            },
            process.env.JWT_SECRET || '',
            { expiresIn: '5m' }
          );

          const tokenResponse = await fetch(`${cardprocessorUrl}/api/birthday-unsubscribe-token/${contact.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${internalToken}`,
            },
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            unsubscribeToken = tokenData.token;
            console.log(`🔗 [ManualBirthdayCard] Generated unsubscribe token for ${contact.email}`);
          } else {
            console.warn(`⚠️ [ManualBirthdayCard] Failed to generate unsubscribe token for ${contact.email}`);
          }
        } catch (error) {
          console.warn(`⚠️ [ManualBirthdayCard] Error generating unsubscribe token for ${contact.email}:`, error);
        }

        // --- SPLIT EMAIL LOGIC PATCH ---
        // Check if split promotional email is enabled
        const shouldSplitEmail = settings.splitPromotionalEmail && settings.promotion;
        
        console.log(`📧 [ManualBirthdayCard] Split email enabled: ${settings.splitPromotionalEmail}, Has promotion: ${!!settings.promotion}`);
        
        if (shouldSplitEmail) {
          console.log(`✅ [SPLIT FLOW] Sending birthday and promo as SEPARATE emails to ${contact.email}`);
          
          // Send birthday card WITHOUT promotion
          const htmlBirthday = renderBirthdayTemplate(settings.emailTemplate as any, {
            recipientName,
            message: settings.customMessage || 'Wishing you a wonderful birthday!',
            brandName: req.user.tenantName || 'Your Company',
            customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
            senderName: settings.senderName || 'Your Team',
            // NO promotion fields - these are intentionally omitted
            unsubscribeToken,
          });

          const birthdayResult = await enhancedEmailService.sendCustomEmail(
            contact.email,
            `🎉 Happy Birthday ${recipientName}!`,
            htmlBirthday,
            {
              text: htmlBirthday.replace(/<[^>]*>/g, ''),
              from: 'admin@zendwise.work',
              metadata: {
                type: 'birthday-card',
                contactId: contact.id,
                tenantId: tenantId,
                manual: true,
                tags: ['birthday', 'manual', `tenant-${tenantId}`],
                unsubscribeToken: unsubscribeToken || 'none',
              },
            }
          );

          console.log(`✅ [SPLIT FLOW] Birthday card sent to ${contact.email}`);
          
          // Log birthday card to database
          try {
            await db.insert(emailActivity).values({
              tenantId: tenantId,
              contactId: contact.id,
              activityType: 'sent',
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, split: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.work' }),
              occurredAt: new Date(),
            });
            console.log(`📝 [SPLIT FLOW] Logged birthday card activity for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [SPLIT FLOW] Failed to log birthday card activity:`, logError);
          }
          
          // Log to email_sends table
          try {
            const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
            await db.insert(emailSends).values({
              id: emailSendId,
              tenantId: tenantId,
              recipientEmail: contact.email,
              recipientName: recipientName,
              senderEmail: 'admin@zendwise.work',
              senderName: settings.senderName || 'Your Team',
              subject: `🎉 Happy Birthday ${recipientName}!`,
              emailType: 'birthday_card',
              provider: 'resend',
              providerMessageId: typeof birthdayResult === 'string' ? birthdayResult : birthdayResult?.messageId,
              status: 'sent',
              contactId: contact.id,
              promotionId: null,
              sentAt: new Date(),
            });
            
            // Also store the content
            await db.insert(emailContent).values({
              emailSendId: emailSendId,
              htmlContent: htmlBirthday,
              textContent: htmlBirthday.replace(/<[^>]*>/g, ''),
              metadata: JSON.stringify({
                split: true,
                manual: true,
                birthdayCard: true,
                promotional: false
              })
            });
            console.log(`📧 [EmailSends] Logged birthday email to email_sends for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [EmailSends] Failed to log to email_sends table:`, logError);
          }
          
          // Wait 20 seconds before sending promotional email
          console.log(`⏳ [SPLIT FLOW] Waiting 20 seconds before sending promo...`);
          await new Promise(resolve => setTimeout(resolve, 20000));

          // Send promotional email separately
          const promoSubject = settings.promotion.title || 'Special Birthday Offer!';
          const htmlPromo = `
            <html>
              <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 600px; margin: 20px auto; padding: 32px 24px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px;">
                  <h2 style="font-size: 1.5rem; font-weight: bold; margin: 0 0 16px 0; color: #2d3748;">${settings.promotion.title || 'Special Birthday Offer!'}</h2>
                  ${settings.promotion.description ? `<p style="margin: 0 0 20px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${settings.promotion.description}</p>` : ''}
                  <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${settings.promotion.content || ''}</div>
                  <hr style="margin: 32px 0 16px 0; border: none; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-size: 0.85rem; color: #a0aec0; text-align: center;">
                    This is a special birthday promotion for valued subscribers.
                  </p>
                </div>
              </body>
            </html>
          `;

          const promoResult = await enhancedEmailService.sendCustomEmail(
            contact.email,
            `🎁 ${promoSubject}`,
            htmlPromo,
            {
              text: htmlPromo.replace(/<[^>]*>/g, ''),
              from: 'admin@zendwise.work',
              metadata: {
                type: 'birthday-promotion',
                contactId: contact.id,
                tenantId: tenantId,
                manual: true,
                tags: ['birthday', 'manual', 'promotion', `tenant-${tenantId}`],
                unsubscribeToken: unsubscribeToken || 'none',
              },
            }
          );

          console.log(`✅ [SPLIT FLOW] Promotional email sent to ${contact.email}`);
          
          // Log promotional email to database
          try {
            await db.insert(emailActivity).values({
              tenantId: tenantId,
              contactId: contact.id,
              activityType: 'sent',
              activityData: JSON.stringify({ type: 'birthday-promotion', manual: true, split: true, subject: `🎁 ${promoSubject}`, recipient: contact.email, from: 'admin@zendwise.work' }),
              occurredAt: new Date(),
            });
            console.log(`📝 [SPLIT FLOW] Logged promotional email activity for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [SPLIT FLOW] Failed to log promotional email activity:`, logError);
          }
          
          // Log to email_sends table
          try {
            const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
            await db.insert(emailSends).values({
              id: emailSendId,
              tenantId: tenantId,
              recipientEmail: contact.email,
              recipientName: recipientName,
              senderEmail: 'admin@zendwise.work',
              senderName: settings.senderName || 'Your Team',
              subject: `🎁 ${settings.promotion?.title || 'Special Birthday Offer!'}`,
              emailType: 'birthday_promotion',
              provider: 'resend',
              providerMessageId: typeof promoResult === 'string' ? promoResult : promoResult.messageId,
              status: 'sent',
              contactId: contact.id,
              promotionId: settings.promotion?.id || null,
              sentAt: new Date(),
            });
            
            // Also store the content
            await db.insert(emailContent).values({
              emailSendId: emailSendId,
              htmlContent: htmlPromo,
              textContent: htmlPromo.replace(/<[^>]*>/g, ''),
              metadata: JSON.stringify({
                split: true,
                manual: true,
                birthdayCard: false,
                promotional: true
              })
            });
            console.log(`📧 [EmailSends] Logged promotional email to email_sends for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [EmailSends] Failed to log to email_sends table:`, logError);
          }

          // Record both emails as success
          if (typeof birthdayResult === 'string' || (birthdayResult && birthdayResult.success)) {
            results.push({
              contactId: contact.id,
              email: contact.email,
              success: true,
              messageId: typeof birthdayResult === 'string' ? birthdayResult : birthdayResult.messageId,
              note: 'Split email: Birthday and promotion sent separately',
            });
          } else {
            results.push({
              contactId: contact.id,
              email: contact.email,
              success: false,
              error: birthdayResult.error || 'Unknown error',
            });
          }
          
          continue; // Skip to next contact
        }
        // --- END SPLIT EMAIL LOGIC ---

        // Render birthday template
        const htmlContent = renderBirthdayTemplate(settings.emailTemplate as any, {
          recipientName,
          message: settings.customMessage || 'Wishing you a wonderful birthday!',
          brandName: req.user.tenantName || 'Your Company',
          customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
          senderName: settings.senderName || 'Your Team',
          promotionContent: settings.promotion?.content,
          promotionTitle: settings.promotion?.title,
          promotionDescription: settings.promotion?.description,
          unsubscribeToken,
        });

        // Send the birthday email
        const result = await enhancedEmailService.sendCustomEmail(
          contact.email,
          `🎉 Happy Birthday ${recipientName}!`,
          htmlContent,
          {
            text: htmlContent.replace(/<[^>]*>/g, ''),
            from: 'admin@zendwise.work',
            metadata: {
              type: 'birthday-card',
              contactId: contact.id,
              tenantId: tenantId,
              manual: true,
              tags: ['birthday', 'manual', `tenant-${tenantId}`],
              unsubscribeToken: unsubscribeToken || 'none',
            },
          }
        );

        // Handle result - can be EmailSendResult or string (queue ID)
        if (typeof result === 'string') {
          // Queued
          // Log to database
          try {
            await db.insert(emailActivity).values({
              tenantId: tenantId,
              contactId: contact.id,
              activityType: 'sent',
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, queued: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.work' }),
              occurredAt: new Date(),
            });
            console.log(`📝 [ManualBirthdayCard] Logged queued birthday card activity for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [ManualBirthdayCard] Failed to log queued birthday card activity:`, logError);
          }
          
          // Log to email_sends table
          try {
            const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
            await db.insert(emailSends).values({
              id: emailSendId,
              tenantId: tenantId,
              recipientEmail: contact.email,
              recipientName: recipientName,
              senderEmail: 'admin@zendwise.work',
              senderName: settings.senderName || 'Your Team',
              subject: `🎉 Happy Birthday ${recipientName}!`,
              emailType: 'birthday_card',
              provider: 'resend',
              providerMessageId: typeof result === 'string' ? result : result.messageId,
              status: 'sent',
              contactId: contact.id,
              promotionId: null,
              sentAt: new Date(),
            });
            
            // Also store the content
            await db.insert(emailContent).values({
              emailSendId: emailSendId,
              htmlContent: htmlContent,
              textContent: htmlContent.replace(/<[^>]*>/g, ''),
              metadata: JSON.stringify({
                split: false,
                manual: true,
                birthdayCard: true,
                promotional: false
              })
            });
            console.log(`📧 [EmailSends] Logged birthday email to email_sends for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [EmailSends] Failed to log to email_sends table:`, logError);
          }
          
          console.log(`✅ [ManualBirthdayCard] Birthday card queued for ${contact.email}: ${result}`);
          results.push({
            contactId: contact.id,
            email: contact.email,
            success: true,
            messageId: result,
          });
        } else if (result.success) {
          console.log(`✅ [ManualBirthdayCard] Birthday card sent to ${contact.email}`);
          
          // Log to database
          try {
            await db.insert(emailActivity).values({
              tenantId: tenantId,
              contactId: contact.id,
              activityType: 'sent',
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.work' }),
              occurredAt: new Date(),
            });
            console.log(`📝 [ManualBirthdayCard] Logged birthday card activity for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [ManualBirthdayCard] Failed to log birthday card activity:`, logError);
          }
          
          // Log to email_sends table
          try {
            const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
            await db.insert(emailSends).values({
              id: emailSendId,
              tenantId: tenantId,
              recipientEmail: contact.email,
              recipientName: recipientName,
              senderEmail: 'admin@zendwise.work',
              senderName: settings.senderName || 'Your Team',
              subject: `🎉 Happy Birthday ${recipientName}!`,
              emailType: 'birthday_card',
              provider: 'resend',
              providerMessageId: result.messageId,
              status: 'sent',
              contactId: contact.id,
              promotionId: settings.promotion?.id || null,
              sentAt: new Date(),
            });
            
            // Also store the content
            await db.insert(emailContent).values({
              emailSendId: emailSendId,
              htmlContent: htmlContent,
              textContent: htmlContent.replace(/<[^>]*>/g, ''),
              metadata: JSON.stringify({
                split: false,
                manual: true,
                birthdayCard: true,
                promotional: !!settings.promotion
              })
            });
            console.log(`📧 [EmailSends] Logged birthday email to email_sends for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [EmailSends] Failed to log to email_sends table:`, logError);
          }
          results.push({
            contactId: contact.id,
            email: contact.email,
            success: true,
            messageId: result.messageId,
          });
        } else {
          console.error(`❌ [ManualBirthdayCard] Failed to send to ${contact.email}:`, result.error);
          results.push({
            contactId: contact.id,
            email: contact.email,
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.error(`❌ [ManualBirthdayCard] Error sending to ${contact.email}:`, error);
        results.push({
          contactId: contact.id,
          email: contact.email,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Birthday cards sent: ${successCount} successful, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    });

  } catch (error) {
    console.error('Send manual birthday card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send birthday cards',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Helper function to process placeholders in content
function processPlaceholders(content: string, params: { recipientName?: string }): string {
  if (!content) return content;

  let processed = content;

  // Handle {{firstName}} and {{lastName}} placeholders
  const nameParts = (params.recipientName || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  processed = processed.replace(/\{\{firstName\}\}/g, firstName);
  processed = processed.replace(/\{\{lastName\}\}/g, lastName);

  return processed;
}

// Helper function to render birthday template
function renderBirthdayTemplate(
  template: 'default' | 'confetti' | 'balloons' | 'custom',
  params: {
    recipientName?: string;
    message?: string;
    brandName?: string;
    customThemeData?: any;
    senderName?: string;
    promotionContent?: string;
    promotionTitle?: string;
    promotionDescription?: string;
    unsubscribeToken?: string;
  }
): string {
  // Handle custom theme with rich styling
  if (template === 'custom' && params.customThemeData) {
    let customData = null;

    try {
      const parsedData = typeof params.customThemeData === 'string'
        ? JSON.parse(params.customThemeData)
        : params.customThemeData;

      // Check if it's the new structure (has themes property)
      if (parsedData.themes && parsedData.themes.custom) {
        customData = parsedData.themes.custom;
      } else if (!parsedData.themes) {
        // Old structure - use directly if no themes property
        customData = parsedData;
      }
    } catch (e) {
      console.warn('Failed to parse customThemeData for custom template:', e);
      return `<html><body><p>Error loading custom theme</p></body></html>`;
    }

    if (!customData) {
      return `<html><body><p>No custom theme data found</p></body></html>`;
    }

    const title = customData.title || `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
    const message = processPlaceholders(customData.message || params.message || 'Wishing you a wonderful day!', params);
    const signature = customData.signature || '';
    const fromMessage = params.senderName || 'The Team';

    // Header image section
    const headerImageSection = customData.imageUrl
      ? `<div style="height: 200px; background-image: url('${customData.imageUrl}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;"></div>`
      : `<div style="background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%); height: 200px; border-radius: 12px 12px 0 0;"></div>`;

    // Build promotion section if promotion content exists
    let promotionSection = '';
    if (params.promotionContent) {
      promotionSection = `
        <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px; border-left: 4px solid #667eea;">
          ${params.promotionTitle ? `<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">${processPlaceholders(params.promotionTitle, params)}</h3>` : ''}
          ${params.promotionDescription ? `<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${processPlaceholders(params.promotionDescription, params)}</p>` : ''}
          <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${processPlaceholders(params.promotionContent, params)}</div>
        </div>
      `;
    }

    // Signature section
    const signatureSection = signature
      ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-style: italic; color: #718096;">${processPlaceholders(signature, params)}</div>`
      : '';

    // From message section (only if no signature)
    const fromMessageSection = !signature && fromMessage
      ? `<div style="padding: 20px 30px 10px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
           <div style="font-size: 0.9rem; color: #718096;">
             <p style="margin: 0; font-weight: 600; color: #4a5568;">${fromMessage}</p>
           </div>
         </div>`
      : '';

    // Build unsubscribe section if token exists
    let unsubscribeSection = '';
    if (params.unsubscribeToken) {
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const unsubscribeUrl = `${baseUrl}/api/unsubscribe/birthday?token=${params.unsubscribeToken}`;
      unsubscribeSection = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 0.8rem; color: #a0aec0; line-height: 1.4;">
            Don't want to receive birthday cards? 
            <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Unsubscribe here</a>
          </p>
        </div>
      `;
    }

    return `<html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <!-- 1. Header Image (standalone) -->
          ${headerImageSection}
          
          <!-- 2. Header Text (separate from image) -->
          <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
            <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${title}</h1>
          </div>
          
          <!-- 3. Content Area (message) -->
          <div style="padding: 30px;">
            <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">${message}</div>
            ${promotionSection}
            ${signatureSection}
          </div>
          
          ${fromMessageSection}
          ${unsubscribeSection ? `<div style="padding: 0 30px 30px 30px;">${unsubscribeSection}</div>` : ''}
        </div>
      </body>
    </html>`;
  }

  // Default theme header images
  const themeHeaders = {
    default: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    confetti: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    balloons: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  };

  const themeColors = {
    default: { primary: '#667eea', secondary: '#764ba2' },
    confetti: { primary: '#ff6b6b', secondary: '#feca57' },
    balloons: { primary: '#54a0ff', secondary: '#5f27cd' }
  };

  // Check if there's custom theme data with custom title/signature for this specific theme
  let headline = `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
  let signature = '';

  if (params.customThemeData) {
    try {
      const parsedData = typeof params.customThemeData === 'string'
        ? JSON.parse(params.customThemeData)
        : params.customThemeData;

      let themeSpecificData = null;

      // Check if it's the new structure (has themes property)
      if (parsedData.themes && parsedData.themes[template]) {
        themeSpecificData = parsedData.themes[template];
      } else if (!parsedData.themes) {
        // Old structure - use directly if no themes property
        themeSpecificData = parsedData;
      }

      if (themeSpecificData) {
        // Use custom title if provided, otherwise use default
        if (themeSpecificData.title) {
          headline = themeSpecificData.title;
        }

        // Use custom signature if provided
        if (themeSpecificData.signature) {
          signature = themeSpecificData.signature;
        }
      }
    } catch (e) {
      // If parsing fails, continue with defaults
      console.warn('Failed to parse customThemeData for template:', template, e);
    }
  }

  const headerImage = themeHeaders[template as keyof typeof themeHeaders] || themeHeaders.default;
  const colors = themeColors[template as keyof typeof themeColors] || themeColors.default;
  const fromMessage = params.senderName || 'The Team';

  // Build promotion section if promotion content exists
  let promotionSection = '';
  if (params.promotionContent) {
    promotionSection = `
      <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px; border-left: 4px solid ${colors.primary};">
        ${params.promotionTitle ? `<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">${processPlaceholders(params.promotionTitle, params)}</h3>` : ''}
        ${params.promotionDescription ? `<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${processPlaceholders(params.promotionDescription, params)}</p>` : ''}
        <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${processPlaceholders(params.promotionContent, params)}</div>
      </div>
    `;
  }

  // Signature section
  const signatureSection = signature
    ? `<div style="font-size: 1rem; line-height: 1.5; color: #718096; text-align: center; font-style: italic; margin-top: 20px;">${processPlaceholders(signature, params)}</div>`
    : '';

  // From message section (only if no signature)
  const fromMessageSection = !signature && fromMessage
    ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #718096; font-size: 0.9rem; font-weight: 600;">${fromMessage}</div>`
    : '';

  // Build unsubscribe section if token exists
  let unsubscribeSection = '';
  if (params.unsubscribeToken) {
    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const unsubscribeUrl = `${baseUrl}/api/unsubscribe/birthday?token=${params.unsubscribeToken}`;
    unsubscribeSection = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 0.8rem; color: #a0aec0; line-height: 1.4;">
          Don't want to receive birthday cards? 
          <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Unsubscribe here</a>
        </p>
      </div>
    `;
  }

  return `<html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
        <!-- 1. Header Image (standalone) -->
        <div style="height: 200px; background-image: url('${headerImage}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;"></div>
        
        <!-- 2. Header Text (separate from image) -->
        <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
          <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${headline}</h1>
        </div>
        
        <!-- 3. Content Area (message) -->
        <div style="padding: 30px;">
          <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">${processPlaceholders(params.message || 'Wishing you a wonderful day!', params)}</div>
          ${promotionSection}
          ${signatureSection}
          ${fromMessageSection}
          ${unsubscribeSection}
        </div>
      </div>
    </body>
  </html>`;
}

// Send individual email to a contact
emailManagementRoutes.post("/email-contacts/:id/send-email", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { subject, content } = req.body;
    const tenantId = req.user.tenantId;

    // Validate input
    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        message: "Subject and content are required"
      });
    }

    // Get contact details
    const contact = await db.query.emailContacts.findFirst({
      where: and(
        eq(emailContacts.id, id),
        eq(emailContacts.tenantId, tenantId)
      ),
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    // Check if contact can receive emails
    if (contact.status === 'unsubscribed') {
      return res.status(400).json({
        success: false,
        message: "Cannot send email to unsubscribed contact"
      });
    }

    if (contact.status === 'bounced') {
      return res.status(400).json({
        success: false,
        message: "Cannot send email to bounced contact"
      });
    }

    // Get tenant info for from email
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    // Format content as HTML
    const htmlContent = `
      <html>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f7fafc;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="padding: 30px;">
              <div style="font-size: 1rem; line-height: 1.6; color: #2d3748; white-space: pre-wrap;">${content.replace(/\n/g, '<br>')}</div>
            </div>
            <div style="padding: 20px 30px; background-color: #f7fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 0.875rem; color: #718096;">
                Sent from ${tenant?.name || 'Authentik'}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Import email service
    const { enhancedEmailService } = await import('../providers/enhancedEmailService');

    // Send email
    const result = await enhancedEmailService.sendCustomEmail(
      contact.email,
      subject,
      htmlContent,
      {
        text: content,
        metadata: {
          type: 'individual_contact_email',
          contactId: contact.id,
          tenantId: tenantId,
          sentBy: req.user.id
        }
      }
    );

    // Log email activity
    await db.insert(emailActivity).values({
      contactId: contact.id,
      tenantId: tenantId,
      eventType: 'sent',
      emailSubject: subject,
      timestamp: new Date(),
      metadata: {
        source: 'individual_send',
        sentBy: req.user.id
      }
    });

    // Update contact stats
    await db.update(emailContacts)
      .set({
        emailsSent: sql`${emailContacts.emailsSent} + 1`,
        lastActivity: new Date(),
        updatedAt: new Date()
      })
      .where(eq(emailContacts.id, contact.id));

    res.json({
      success: true,
      message: "Email sent successfully",
      result
    });
  } catch (error: any) {
    console.error('[EmailManagementRoutes] Send individual email error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send email"
    });
  }
});
