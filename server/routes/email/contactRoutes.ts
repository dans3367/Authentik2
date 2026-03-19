import { Router } from 'express';
import { db } from '../../db';
import { sql, eq, and } from 'drizzle-orm';
import { emailContacts, emailLists, bouncedEmails, contactListMemberships, contactTagAssignments, betterAuthUser, emailActivity, tenants, emailSends, emailContent, companies, masterEmailDesign, triggerTasks, birthdaySettings, unsubscribeTokens } from '@shared/schema';
import { authenticateToken, requireTenant, requirePermission } from '../../middleware/auth-middleware';
import { sanitizeString, sanitizeEmail, escapeLikePattern } from '../../utils/sanitization';
import { storage } from '../../storage';
import crypto from 'crypto';
import { logActivity, computeChanges } from '../../utils/activityLogger';
import { emailAttachmentUpload, validateAttachmentSize, filesToBase64Attachments, handleEmailAttachmentError } from '../../middleware/emailAttachmentUpload';
import { fromZonedTime } from 'date-fns-tz';
import { wrapNewsletterContent } from '../../utils/newsletterEmailWrapper';
import { replaceEmailPlaceholders } from '../../utils/emailPlaceholders';
import { sanitizeEmailHtml, sanitizeFontFamily, escapeHtml, isValidHttpUrl, maskEmail, renderBirthdayTemplate, enqueuePromotionalEmailJob } from './emailUtils';

export const contactRoutes = Router();

// Get email contacts
contactRoutes.get("/email-contacts", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
  try {
    const { page = 1, limit = 10, search, tags, lists, status, statsOnly } = req.query;

    // If statsOnly is requested, return only statistics
    if (statsOnly === 'true') {
      const stats = await storage.getEmailContactStats(req.user.tenantId);
      return res.json({ stats });
    }

    const parsedPage = Math.max(1, Math.floor(Number(page)) || 1);
    const parsedLimit = Math.min(200, Math.max(1, Math.floor(Number(limit)) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    let whereClause = sql`${emailContacts.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = escapeLikePattern(sanitizeString(search as string) || '');
      whereClause = sql`${whereClause} AND (
        ${emailContacts.email} ILIKE ${`%${sanitizedSearch}%`} OR
        ${emailContacts.firstName} ILIKE ${`%${sanitizedSearch}%`} OR
        ${emailContacts.lastName} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (status) {
      const allowedStatuses = ['active', 'unsubscribed', 'bounced', 'pending', 'suppressed'];
      if (!allowedStatuses.includes(status as string)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
      }
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
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        phoneNumber: true,
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
      limit: parsedLimit,
      offset,
    });

    const [totalCountResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(emailContacts).where(whereClause);

    // Transform the data to match frontend expectations
    const transformedContacts = contactsData.map((contact: any) => {
      // Extract and transform the relationship data
      const tags = contact.tagAssignments?.map((assignment: any) => assignment.tag).filter(Boolean) || [];
      const lists = contact.listMemberships?.map((membership: any) => membership.list).filter(Boolean) || [];

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
        page: parsedPage,
        limit: parsedLimit,
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get email contacts error:', error);
    res.status(500).json({ message: 'Failed to get email contacts' });
  }
});

// List all upcoming scheduled emails for the tenant (dashboard widget)
contactRoutes.get("/scheduled-emails/upcoming", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Query trigger_tasks for all pending/triggered scheduled emails for this tenant
    const tasks = await db.query.triggerTasks.findMany({
      where: sql`${triggerTasks.tenantId} = ${tenantId}
        AND ${triggerTasks.relatedType} = 'scheduled_email'
        AND ${triggerTasks.status} IN ('pending', 'triggered', 'running')
        AND ${triggerTasks.scheduledFor} > NOW()`,
      orderBy: sql`${triggerTasks.scheduledFor} ASC`,
      limit,
    });

    // Collect unique contact IDs for batch lookup
    const contactIds = tasks.map((t: any) => t.relatedId).filter((id: any, i: number, arr: any[]) => id && arr.indexOf(id) === i);
    let contactMap: Record<string, { firstName: string | null; lastName: string | null; email: string }> = {};

    if (contactIds.length > 0) {
      const contacts = await db.query.emailContacts.findMany({
        where: sql`${emailContacts.id} IN ${contactIds} AND ${emailContacts.tenantId} = ${tenantId}`,
        columns: { id: true, firstName: true, lastName: true, email: true },
      });
      for (const c of contacts) {
        contactMap[c.id] = { firstName: c.firstName, lastName: c.lastName, email: c.email };
      }
    }

    const scheduled = tasks.map((t: any) => {
      let payload: any = {};
      try {
        payload = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload || {};
      } catch { /* ignore parse errors */ }

      const contact = t.relatedId ? contactMap[t.relatedId] : null;

      return {
        id: t.runId || t.id,
        to: payload.to ? [payload.to] : [],
        subject: payload.subject || '',
        status: t.status,
        scheduledAt: t.scheduledFor?.toISOString() || payload.scheduledForUTC || '',
        createdAt: t.createdAt?.toISOString() || '',
        contactId: t.relatedId || null,
        contact: contact ? {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
        } : null,
        metadata: {
          timezone: payload.timezone,
          scheduledBy: payload.scheduledBy,
          taskLogId: t.id,
        },
      };
    });

    res.json({ scheduled, total: scheduled.length });
  } catch (error) {
    console.error('❌ [ScheduledEmails] Failed to list upcoming scheduled emails:', error);
    res.status(500).json({ message: 'Failed to list upcoming scheduled emails' });
  }
});

// List scheduled emails for a specific contact (timeline)
contactRoutes.get("/email-contacts/:id/scheduled", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    // Query trigger_tasks for scheduled emails related to this contact
    const tasks = await db.query.triggerTasks.findMany({
      where: sql`${triggerTasks.tenantId} = ${tenantId}
        AND ${triggerTasks.relatedId} = ${id}
        AND ${triggerTasks.relatedType} = 'scheduled_email'
        AND ${triggerTasks.status} IN ('pending', 'triggered', 'running')`,
      orderBy: sql`${triggerTasks.scheduledFor} ASC`,
    });

    const scheduled = tasks.map((t: any) => {
      let payload: any = {};
      try {
        payload = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload || {};
      } catch { /* ignore parse errors */ }

      return {
        id: t.runId || t.id,
        to: payload.to ? [payload.to] : [],
        subject: payload.subject || '',
        status: t.status,
        scheduledAt: t.scheduledFor?.toISOString() || payload.scheduledForUTC || '',
        createdAt: t.createdAt?.toISOString() || '',
        providerId: t.runId,
        metadata: {
          timezone: payload.timezone,
          scheduledBy: payload.scheduledBy,
          taskLogId: t.id,
        },
        html: payload.html,
      };
    });

    res.json({ scheduled });
  } catch (error) {
    console.error('❌ [ScheduledEmails] Failed to list scheduled emails:', error);
    res.status(500).json({ message: 'Failed to list scheduled emails' });
  }
});

// Update a scheduled email for a specific contact (cancel old + create new)
contactRoutes.put("/email-contacts/:id/scheduled/:queueId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { queueId, id: contactId } = req.params;
    const tenantId = req.user.tenantId;
    const { subject, html, scheduleAt } = req.body;

    if (!subject && !html && !scheduleAt) {
      return res.status(400).json({ message: 'At least one of subject, html, or scheduleAt is required' });
    }

    const { cancelReminderRun, updateTriggerTaskStatus, triggerScheduleContactEmail } = await import('../../lib/trigger');

    // 1. Find the existing task
    const existingTask = await db.query.triggerTasks.findFirst({
      where: sql`(${triggerTasks.runId} = ${queueId} OR ${triggerTasks.id} = ${queueId})
        AND ${triggerTasks.tenantId} = ${tenantId}
        AND ${triggerTasks.relatedId} = ${contactId}`,
    });

    if (!existingTask) {
      return res.status(404).json({ message: 'Scheduled email not found for this contact' });
    }

    if (existingTask.status === 'running' || existingTask.status === 'triggered') {
      return res.status(409).json({ message: 'Cannot reschedule an email that is already being sent' });
    }

    // 2. Verify contact exists and belongs to tenant
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // 3. Parse existing payload to merge with updates
    let existingPayload: any = {};
    try {
      existingPayload = typeof existingTask.payload === 'string' ? JSON.parse(existingTask.payload) : existingTask.payload || {};
    } catch { /* ignore */ }

    // Determine the new schedule date
    let scheduleDate: Date;
    if (scheduleAt) {
      scheduleDate = new Date(scheduleAt);
      if (isNaN(scheduleDate.getTime())) {
        return res.status(400).json({ message: 'Invalid schedule date' });
      }
      if (scheduleDate.getTime() < Date.now() + 30 * 1000) {
        return res.status(400).json({ message: 'Schedule time must be at least 30 seconds in the future' });
      }
    } else {
      // Keep original schedule time
      scheduleDate = existingTask.scheduledFor ? new Date(existingTask.scheduledFor) : new Date(existingPayload.scheduledForUTC);
      if (!scheduleDate || isNaN(scheduleDate.getTime())) {
        return res.status(400).json({ message: 'Cannot determine original schedule time; please provide scheduleAt' });
      }
      // Ensure it's still in the future
      if (scheduleDate.getTime() < Date.now() + 30 * 1000) {
        return res.status(400).json({ message: 'Original schedule time has passed; please provide a new scheduleAt' });
      }
    }

    const newSubject = subject || existingPayload.subject || 'No Subject';
    const newHtml = sanitizeEmailHtml(html || existingPayload.html || '');
    const timezone = existingPayload.timezone;

    // 4. Cancel the old Trigger.dev run
    if (queueId.startsWith('run_') || existingTask.runId) {
      const runIdToCancel = existingTask.runId || queueId;
      const cancelResult = await cancelReminderRun(runIdToCancel);
      if (!cancelResult.success) {
        console.error(`❌ [ScheduledEmails] Failed to cancel old run ${runIdToCancel}: ${cancelResult.error}`);
        return res.status(409).json({ message: 'Failed to cancel the existing scheduled email. Please try again.' });
      }
    }

    await updateTriggerTaskStatus({
      id: existingTask.id,
      status: 'cancelled',
    });

    console.log(`📅 [ScheduleEmail] Cancelled old scheduled email ${existingTask.id} for rescheduling`);

    // 5. Create a new scheduled email via Trigger.dev
    const emailTrackingId = crypto.randomUUID();

    const result = await triggerScheduleContactEmail({
      to: String(contact.email),
      subject: sanitizeString(newSubject) || 'No Subject',
      html: newHtml,
      text: existingPayload.text,
      scheduledForUTC: scheduleDate.toISOString(),
      timezone: timezone,
      contactId,
      tenantId,
      scheduledBy: req.user.id,
      emailTrackingId,
    });

    if (!result.success) {
      console.error(`❌ [ScheduleEmail] Failed to trigger rescheduled task: ${result.error}`);
      return res.status(503).json({ message: 'Email scheduling service unavailable', error: result.error });
    }

    console.log(`✅ [ScheduleEmail] Email rescheduled successfully, new runId: ${result.runId}`);

    // 6. Create tracking records
    try {
      await db.insert(emailSends).values({
        id: emailTrackingId,
        tenantId,
        recipientEmail: String(contact.email),
        recipientName: contact.firstName && contact.lastName
          ? `${contact.firstName} ${contact.lastName}`
          : contact.firstName || contact.lastName || null,
        senderEmail: 'admin@zendwise.com',
        subject: sanitizeString(newSubject) || 'No Subject',
        emailType: 'scheduled',
        provider: 'resend',
        status: 'pending',
        contactId,
        sentAt: null,
      });

      await db.insert(emailActivity).values({
        tenantId,
        contactId,
        activityType: 'scheduled',
        activityData: JSON.stringify({
          subject: sanitizeString(newSubject) || 'No Subject',
          scheduledFor: scheduleDate.toISOString(),
          timezone,
          scheduledBy: req.user.id,
          runId: result.runId,
          taskLogId: result.taskLogId,
          rescheduledFrom: existingTask.id,
        }),
        occurredAt: new Date(),
      });
    } catch (trackingError) {
      console.error(`⚠️ [ScheduleEmail] Failed to create tracking records for rescheduled email:`, trackingError);
    }

    return res.json({
      message: 'Scheduled email updated',
      runId: result.runId,
      scheduledAt: scheduleDate.toISOString(),
    });
  } catch (error) {
    console.error('❌ [ScheduledEmails] Failed to update scheduled email:', error);
    res.status(500).json({ message: 'Failed to update scheduled email' });
  }
});

// Delete (cancel) a scheduled email for a specific contact
contactRoutes.delete("/email-contacts/:id/scheduled/:queueId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { queueId, id: relatedId } = req.params;
    const tenantId = req.user.tenantId;

    // queueId could be a runId (run_xxx) or a trigger_tasks id
    const { cancelReminderRun, updateTriggerTaskStatus } = await import('../../lib/trigger');

    // Find the trigger_tasks record, ensuring it belongs to both the tenant AND the contact
    // Try by runId first, then by id
    const task = await db.query.triggerTasks.findFirst({
      where: sql`(${triggerTasks.runId} = ${queueId} OR ${triggerTasks.id} = ${queueId})
        AND ${triggerTasks.tenantId} = ${tenantId}
        AND ${triggerTasks.relatedId} = ${relatedId}`,
    });

    if (!task) {
      return res.status(404).json({
        message: 'Scheduled email not found for this contact'
      });
    }

    // After finding the task, verify contact ownership
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${relatedId} AND ${emailContacts.tenantId} = ${tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found or access denied' });
    }

    // Verify scheduled email ownership (not contact ownership)
    // Fail closed: if we can't determine who scheduled the email, only admins/owners may cancel
    const isAdminOrOwner = ['Administrator', 'Owner'].includes(req.user.role || '');
    let scheduledByUserId: string | null = null;
    try {
      const taskPayload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
      // Try primary field first, then fall back to legacy fields
      scheduledByUserId = taskPayload?.scheduledBy
        ?? taskPayload?.owner
        ?? taskPayload?.createdBy
        ?? null;
    } catch {
      scheduledByUserId = null;
    }

    // Fail-closed: non-admin/non-owner users are blocked when scheduledBy is
    // missing (legacy task) or when it doesn't match the requesting user.
    if (!isAdminOrOwner) {
      if (!scheduledByUserId) {
        return res.status(403).json({
          message: 'Cannot determine the original scheduler — admin or owner approval is required to cancel this email',
        });
      }
      if (scheduledByUserId !== req.user.id) {
        return res.status(403).json({
          message: 'You can only cancel scheduled emails you created',
        });
      }
    }

    // Try to cancel the Trigger.dev run if it's a run ID
    if (queueId.startsWith('run_') || task.runId) {
      const runIdToCancel = task.runId || queueId;
      const cancelResult = await cancelReminderRun(runIdToCancel);
      if (!cancelResult.success) {
        console.warn(`⚠️ [ScheduledEmails] Could not cancel run ${runIdToCancel}: ${cancelResult.error}`);
      }
    }

    // Update the trigger_tasks record to cancelled status
    await updateTriggerTaskStatus({
      id: task.id,
      status: 'cancelled',
    });

    res.json({ message: 'Scheduled email cancelled', id: queueId });
  } catch (error) {
    console.error('❌ [ScheduledEmails] Failed to cancel scheduled email:', error);
    res.status(500).json({ message: 'Failed to cancel scheduled email' });
  }
});

// Get specific email contact
contactRoutes.get("/email-contacts/:id", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
      columns: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        phoneNumber: true,
        addedDate: true,
        lastActivity: true,
        emailsSent: true,
        emailsOpened: true,
        birthday: true,
        birthdayEmailEnabled: true,
        dateOfBirth: true,
        birthdayUnsubscribedAt: true,
        consentGiven: true,
        consentDate: true,
        consentMethod: true,
        consentIpAddress: true,
        consentUserAgent: true,
        addedByUserId: true,
        prefMarketing: true,
        prefCustomerEngagement: true,
        prefNewsletters: true,
        prefSurveysForms: true,
        createdAt: true,
        updatedAt: true,
      },
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
    const tags = contact.tagAssignments?.map((assignment: any) => assignment.tag).filter(Boolean) || [];
    const lists = contact.listMemberships?.map((membership: any) => membership.list).filter(Boolean) || [];

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
contactRoutes.get("/email-contacts/:id/stats", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Compute primary metrics from existing counters updated by webhooks
    const emailsSent = Number(contact.emailsSent || 0);
    const emailsOpened = Number(contact.emailsOpened || 0);

    // Derive rates
    const openRate = emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : 0;

    // Optional: clicks from emailActivity table
    let emailsClicked = 0;
    try {
      const clickedResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(emailActivity)
        .where(and(eq(emailActivity.contactId, id), eq(emailActivity.activityType, 'clicked')));
      emailsClicked = clickedResult?.[0]?.count ?? 0;
    } catch (e) {
      // Fallback silently if emailActivity is unavailable
      emailsClicked = 0;
    }
    const clickRate = emailsSent > 0 ? Math.round((emailsClicked / emailsSent) * 100) : 0;

    // Optional: basic bounce indicator from bouncedEmails table (by email)
    let emailsBounced = 0;
    try {
      if (contact.email) {
        const bounceCheck = await db
          .select()
          .from(bouncedEmails)
          .where(eq(bouncedEmails.email, contact.email))
          .limit(1);
        const bounceRecord = bounceCheck[0] || null;
        emailsBounced = bounceRecord ? 1 : 0;
      }
    } catch (e) {
      emailsBounced = 0;
    }
    const bounceRate = emailsSent > 0 ? Math.round((emailsBounced / emailsSent) * 100) : 0;

    const stats = {
      emailsSent,
      emailsOpened,
      openRate,
      emailsClicked,
      clickRate,
      emailsBounced,
      bounceRate,
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({ message: 'Failed to get contact statistics' });
  }
});

// Create email contact with batch operations
contactRoutes.post("/email-contacts", authenticateToken, requireTenant, requirePermission('contacts.create'), async (req: any, res) => {
  try {
    const { email, firstName, lastName, tags, lists, status, consentGiven, consentMethod, consentIpAddress, consentUserAgent, address, city, state, zipCode, country, phoneNumber, dateOfBirth } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedFirstName = firstName ? sanitizeString(firstName) : null;
    const sanitizedLastName = lastName ? sanitizeString(lastName) : null;
    const sanitizedAddress = address ? sanitizeString(address) : null;
    const sanitizedCity = city ? sanitizeString(city) : null;
    const sanitizedState = state ? sanitizeString(state) : null;
    const sanitizedZipCode = zipCode ? sanitizeString(zipCode) : null;
    const sanitizedCountry = country ? sanitizeString(country) : null;
    const sanitizedPhoneNumber = phoneNumber ? sanitizeString(phoneNumber) : null;

    // Validate dateOfBirth format if provided
    let validatedDateOfBirth = null;
    if (dateOfBirth) {
      const isValidDob = typeof dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);
      if (!isValidDob) {
        return res.status(400).json({ message: 'Date of birth must be in YYYY-MM-DD format' });
      }
      // Verify it's a valid date
      const parsedDate = new Date(dateOfBirth);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Date of birth is not a valid date' });
      }
      validatedDateOfBirth = dateOfBirth;
    }

    // Check if contact already exists
    const existingContact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.email} = ${sanitizedEmail} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (existingContact) {
      return res.status(400).json({ message: 'Contact already exists' });
    }

    const now = new Date();

    // Use a transaction for batch operations
    const result = await db.transaction(async (tx: any) => {
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

      // Validate status if provided
      const contactStatus = status || 'active';
      const allowedStatuses = ['active', 'unsubscribed', 'bounced', 'pending', 'suppressed'];
      if (!allowedStatuses.includes(contactStatus)) {
        throw new Error(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
      }

      // Create the contact
      const newContact = await tx.insert(emailContacts).values({
        tenantId: req.user.tenantId,
        email: sanitizedEmail,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        status: contactStatus,
        consentGiven: consentGiven || false,
        consentMethod: consentMethod || null,
        consentDate: consentGiven ? now : null,
        consentIpAddress: consentGiven ? (req.ip || req.headers['x-forwarded-for']?.split(',')[0] || null) : null,
        consentUserAgent: consentGiven ? (req.headers['user-agent'] || null) : null,
        addedByUserId: userExists ? req.user.id : null,
        address: sanitizedAddress,
        city: sanitizedCity,
        state: sanitizedState,
        zipCode: sanitizedZipCode,
        country: sanitizedCountry,
        phoneNumber: sanitizedPhoneNumber,
        dateOfBirth: validatedDateOfBirth,
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

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'contact',
      entityId: result.id,
      entityName: `${result.firstName || ''} ${result.lastName || ''}`.trim() || '[Contact]',
      activityType: 'created',
      description: `Contact was created`,
      metadata: {
        // PII redacted for GDPR/CCPA compliance
        contactId: result.id,
        status: result.status,
        consentGiven: result.consentGiven,
        tagsCount: tags?.length || 0,
        listsCount: lists?.length || 0,
      },
      req,
    });

    res.status(201).json(result);

    // Auto-send birthday card if DOB matches today or yesterday
    if (validatedDateOfBirth && result.status === 'active') {
      autoSendBirthdayCard(result, req.user.tenantId).catch(err => {
        console.error(`[AutoBirthday] Error auto-sending birthday card:`, err);
      });
    }
  } catch (error) {
    console.error('Create email contact error:', error);
    res.status(500).json({ message: 'Failed to create email contact' });
  }
});

/**
 * Auto-send birthday card when a new contact is added with a DOB matching today or 1 day prior.
 * Uses the tenant's birthday settings from /cards?tab=themes&type=birthday including
 * promo, split promo config, theme, custom message, etc.
 * Fire-and-forget — does not block the contact creation response.
 */
async function autoSendBirthdayCard(contact: any, tenantId: string) {
  try {
    const dob = contact.dateOfBirth;
    if (!dob) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Parse DOB month/day (ignore year)
    const [, dobMonth, dobDay] = dob.split('-').map(Number);
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const yesterdayMonth = yesterday.getMonth() + 1;
    const yesterdayDay = yesterday.getDate();

    const isToday = dobMonth === todayMonth && dobDay === todayDay;
    const isYesterday = dobMonth === yesterdayMonth && dobDay === yesterdayDay;

    if (!isToday && !isYesterday) return;

    console.log(`[AutoBirthday] DOB match for ${contact.email} (${isToday ? 'today' : 'yesterday'}) — sending birthday card`);

    // Get birthday settings for this tenant
    const settings = await db.query.birthdaySettings.findFirst({
      where: eq(birthdaySettings.tenantId, tenantId),
      with: { promotion: true },
    });

    if (!settings || !settings.enabled) {
      console.log(`[AutoBirthday] Birthday settings not found or disabled for tenant ${tenantId}`);
      return;
    }

    // Fetch company info for branding
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.tenantId, tenantId), eq(companies.isActive, true)),
    });

    const companyName = company?.name || settings.senderName || 'Your Company';
    const resolvedSenderName = settings.senderName || companyName || 'Your Team';

    // Skip if contact is suppressed/bounced/unsubscribed or opted out
    if (['suppressed', 'bounced', 'unsubscribed'].includes(contact.status)) {
      console.log(`[AutoBirthday] Skipping ${contact.email} — status: ${contact.status}`);
      return;
    }
    if (contact.prefCustomerEngagement === false) {
      console.log(`[AutoBirthday] Skipping ${contact.email} — opted out of Customer Engagement`);
      return;
    }

    const recipientName = contact.firstName || contact.lastName
      ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      : contact.email.split('@')[0];

    // Generate unsubscribe token
    let unsubscribeToken: string | undefined;
    try {
      const token = crypto.randomBytes(24).toString('base64url');
      const created = await db.insert(unsubscribeTokens).values({
        tenantId,
        contactId: contact.id,
        token,
      }).returning();
      unsubscribeToken = created[0]?.token;
    } catch (error) {
      console.warn(`[AutoBirthday] Error generating unsubscribe token:`, error);
    }

    const { enhancedEmailService } = await import('../../emailService');
    const shouldSplitEmail = settings.splitPromotionalEmail && settings.promotion;

    const unsubUrl = unsubscribeToken
      ? `${process.env.APP_URL || 'http://localhost:5002'}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&type=customer_engagement`
      : undefined;

    const emailHeaders = unsubUrl ? {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    } : undefined;

    const emailMetadata = {
      type: 'birthday-card',
      contactId: contact.id,
      tenantId,
      auto: true,
      tags: ['birthday', 'auto', `tenant-${tenantId}`],
      unsubscribeToken: unsubscribeToken || 'none',
    };

    if (shouldSplitEmail) {
      // SPLIT FLOW: birthday card without promo, then promo email after 20s delay
      const htmlBirthday = renderBirthdayTemplate(settings.emailTemplate as any, {
        recipientName,
        message: settings.customMessage || 'Wishing you a wonderful birthday!',
        brandName: companyName,
        customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
        senderName: resolvedSenderName,
        unsubscribeToken,
      });

      const birthdayResult = await enhancedEmailService.sendCustomEmail(
        contact.email,
        `🎉 Happy Birthday ${recipientName}!`,
        htmlBirthday,
        { text: htmlBirthday.replace(/<[^>]*>/g, ''), from: 'admin@zendwise.com', headers: emailHeaders, metadata: emailMetadata }
      );

      // Log birthday card
      try {
        const emailSendId = crypto.randomUUID();
        await db.insert(emailActivity).values({
          tenantId, contactId: contact.id, activityType: 'sent',
          activityData: JSON.stringify({ type: 'birthday-card', auto: true, split: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
          occurredAt: new Date(),
        });
        await db.insert(emailSends).values({
          id: emailSendId, tenantId, recipientEmail: contact.email, recipientName, senderEmail: 'admin@zendwise.com', senderName: resolvedSenderName,
          subject: `🎉 Happy Birthday ${recipientName}!`, emailType: 'birthday_card', provider: 'resend',
          providerMessageId: typeof birthdayResult === 'string' ? birthdayResult : birthdayResult?.messageId,
          status: 'sent', contactId: contact.id, sentAt: new Date(),
        });
        await db.insert(emailContent).values({
          emailSendId, htmlContent: htmlBirthday, textContent: htmlBirthday.replace(/<[^>]*>/g, ''),
          metadata: JSON.stringify({ split: true, auto: true, birthdayCard: true, promotional: false }),
        });
      } catch (logError) {
        console.error(`[AutoBirthday] Failed to log birthday card:`, logError);
      }

      // Queue promotional email with 20s delay
      const safePromoTitle = sanitizeEmailHtml(settings.promotion?.title || 'Special Birthday Offer!');
      const safePromoDescription = settings.promotion?.description ? sanitizeEmailHtml(settings.promotion.description) : '';
      const safePromoContent = sanitizeEmailHtml(settings.promotion?.content || '');

      const htmlPromo = `
        <html><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
          <div style="max-width:600px;margin:20px auto;padding:32px 24px;background:linear-gradient(135deg,#f7fafc 0%,#edf2f7 100%);border-radius:8px;">
            <h2 style="font-size:1.5rem;font-weight:bold;margin:0 0 16px;color:#2d3748;">${safePromoTitle}</h2>
            ${safePromoDescription ? `<p style="margin:0 0 20px;color:#4a5568;font-size:1rem;line-height:1.5;">${safePromoDescription}</p>` : ''}
            <div style="color:#2d3748;font-size:1rem;line-height:1.6;">${safePromoContent}</div>
            <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:0.85rem;color:#a0aec0;text-align:center;">This is a special birthday promotion for valued subscribers.</p>
          </div>
        </body></html>`;

      await enqueuePromotionalEmailJob({
        tenantId, contactId: contact.id, recipientEmail: contact.email, recipientName,
        senderName: resolvedSenderName, promoSubject: safePromoTitle, htmlPromo,
        unsubscribeToken, promotionId: settings.promotion?.id || null, manual: false,
      }, 20000);

      console.log(`[AutoBirthday] Split flow complete for ${contact.email} — birthday card sent, promo queued`);
    } else {
      // COMBINED FLOW: birthday card with promo embedded
      const htmlContent = renderBirthdayTemplate(settings.emailTemplate as any, {
        recipientName,
        message: settings.customMessage || 'Wishing you a wonderful birthday!',
        brandName: companyName,
        customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
        senderName: resolvedSenderName,
        promotionContent: settings.promotion?.content,
        promotionTitle: settings.promotion?.title,
        promotionDescription: settings.promotion?.description || undefined,
        unsubscribeToken,
      });

      const result = await enhancedEmailService.sendCustomEmail(
        contact.email,
        `🎉 Happy Birthday ${recipientName}!`,
        htmlContent,
        { text: htmlContent.replace(/<[^>]*>/g, ''), from: 'admin@zendwise.com', headers: emailHeaders, metadata: emailMetadata }
      );

      // Log combined card
      try {
        const emailSendId = crypto.randomUUID();
        await db.insert(emailActivity).values({
          tenantId, contactId: contact.id, activityType: 'sent',
          activityData: JSON.stringify({ type: 'birthday-card', auto: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
          occurredAt: new Date(),
        });
        await db.insert(emailSends).values({
          id: emailSendId, tenantId, recipientEmail: contact.email, recipientName, senderEmail: 'admin@zendwise.com', senderName: resolvedSenderName,
          subject: `🎉 Happy Birthday ${recipientName}!`, emailType: 'birthday_card', provider: 'resend',
          providerMessageId: typeof result === 'string' ? result : result?.messageId,
          status: 'sent', contactId: contact.id, promotionId: settings.promotion?.id || null, sentAt: new Date(),
        });
        await db.insert(emailContent).values({
          emailSendId, htmlContent: htmlContent, textContent: htmlContent.replace(/<[^>]*>/g, ''),
          metadata: JSON.stringify({ split: false, auto: true, birthdayCard: true, promotional: !!settings.promotion }),
        });
      } catch (logError) {
        console.error(`[AutoBirthday] Failed to log birthday card:`, logError);
      }

      console.log(`[AutoBirthday] Combined flow complete for ${contact.email} — birthday card sent`);
    }

    // Update contact metrics
    try {
      await db.update(emailContacts)
        .set({ emailsSent: sql`${emailContacts.emailsSent} + 1`, lastActivity: new Date(), updatedAt: new Date() })
        .where(eq(emailContacts.id, contact.id));
    } catch (err) {
      console.error(`[AutoBirthday] Failed to update contact metrics:`, err);
    }
  } catch (error) {
    console.error(`[AutoBirthday] Failed to auto-send birthday card:`, error);
  }
}

// Update email contact
contactRoutes.put("/email-contacts/:id", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, status, birthday, address, city, state, zipCode, country, phoneNumber, dateOfBirth } = req.body;

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
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
        where: sql`${emailContacts.email} = ${sanitizedEmail} AND ${emailContacts.id} != ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
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
      const allowedStatuses = ['active', 'unsubscribed', 'bounced', 'pending', 'suppressed'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
      }
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

    // Optional address fields
    if (address !== undefined) {
      updateData.address = address ? sanitizeString(address) : null;
    }

    if (city !== undefined) {
      updateData.city = city ? sanitizeString(city) : null;
    }

    if (state !== undefined) {
      updateData.state = state ? sanitizeString(state) : null;
    }

    if (zipCode !== undefined) {
      updateData.zipCode = zipCode ? sanitizeString(zipCode) : null;
    }

    if (country !== undefined) {
      updateData.country = country ? sanitizeString(country) : null;
    }

    // Optional phone number
    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber ? sanitizeString(phoneNumber) : null;
    }

    // Optional date of birth in YYYY-MM-DD format
    if (dateOfBirth !== undefined) {
      if (dateOfBirth) {
        const isValidDob = typeof dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);
        if (!isValidDob) {
          return res.status(400).json({ message: 'Date of birth must be in YYYY-MM-DD format' });
        }
        // Verify it's a valid date
        const parsedDate = new Date(dateOfBirth);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: 'Date of birth is not a valid date' });
        }
        updateData.dateOfBirth = dateOfBirth;
      } else {
        updateData.dateOfBirth = null;
      }
    }

    const updatedContact = await db.update(emailContacts)
      .set(updateData)
      .where(sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`)
      .returning();

    // Compute and log changes
    const changes = computeChanges(contact, updatedContact[0], [
      'email',
      'firstName',
      'lastName',
      'status',
      'birthday',
      'address',
      'city',
      'state',
      'zipCode',
      'country',
      'phoneNumber',
      'dateOfBirth',
    ]);

    if (changes) {
      await logActivity({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        entityType: 'contact',
        entityId: id,
        entityName: `${updatedContact[0].firstName || ''} ${updatedContact[0].lastName || ''}`.trim() || updatedContact[0].email,
        activityType: 'updated',
        description: `Contact "${updatedContact[0].email}" was updated`,
        changes,
        req,
      });
    }

    res.json(updatedContact[0]);
  } catch (error) {
    console.error('Update email contact error:', error);
    res.status(500).json({ message: 'Failed to update email contact' });
  }
});

// Delete email contact
contactRoutes.delete("/email-contacts/:id", authenticateToken, requireTenant, requirePermission('contacts.delete'), async (req: any, res) => {
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

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'contact',
      entityId: id,
      entityName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '[Contact]',
      activityType: 'deleted',
      description: `Contact was deleted`,
      metadata: {
        deletedContactData: {
          // PII redacted for GDPR/CCPA compliance
          contactId: id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          status: contact.status,
        },
      },
      req,
    });

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete email contact error:', error);
    res.status(500).json({ message: 'Failed to delete email contact' });
  }
});

// Bulk delete email contacts
contactRoutes.delete("/email-contacts", authenticateToken, requireTenant, requirePermission('contacts.delete'), async (req: any, res) => {
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

    // Log activity for bulk delete
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'contact',
      activityType: 'deleted',
      description: `Bulk deleted ${deletedContacts.length} contacts`,
      metadata: {
        deletedCount: deletedContacts.length,
        deletedContactIds: deletedContacts.map((c: any) => c.id),
      },
      req,
    });

    res.json({
      message: `${deletedContacts.length} contacts deleted successfully`,
      deletedCount: deletedContacts.length,
    });
  } catch (error) {
    console.error('Bulk delete email contacts error:', error);
    res.status(500).json({ message: 'Failed to delete contacts' });
  }
});

// Get contact activity
contactRoutes.get("/email-contacts/:contactId/activity", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
  try {
    const { contactId } = req.params;
    const { page = 1, limit = 50, from, to } = req.query;
    const parsedPage = Math.max(1, Math.floor(Number(page)) || 1);
    const parsedLimit = Math.min(200, Math.max(1, Math.floor(Number(limit)) || 50));
    const offset = (parsedPage - 1) * parsedLimit;

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
            title: true,
          }
        }
      },
      orderBy: sql`${emailActivity.occurredAt} DESC`,
      limit: parsedLimit,
      offset,
    });

    // Get total count for pagination
    const [totalCountResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(emailActivity).where(whereClause);

    // Transform activities for frontend consumption
    const transformedActivities = activities.map((activity: any) => ({
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
        page: parsedPage,
        limit: parsedLimit,
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get contact activity error:', error);
    res.status(500).json({ message: 'Failed to get contact activity' });
  }
});

// Schedule a single B2C email for a contact (Send Later) - supports both JSON and multipart/form-data with attachments
contactRoutes.post("/email-contacts/:id/schedule", authenticateToken, requireTenant, requirePermission('contacts.edit'), (req: any, res: any, next: any) => {
  // Only run multer for multipart/form-data requests (when attachments are present)
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    emailAttachmentUpload(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: handleEmailAttachmentError(err) });
      }
      next();
    });
  } else {
    next();
  }
}, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { subject, html, text, date, time, timezone, scheduleAt } = req.body || {};
    const tenantId = req.user.tenantId;

    // Process attachments if present
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];
    const sizeCheck = validateAttachmentSize(uploadedFiles);
    if (!sizeCheck.valid) {
      return res.status(400).json({ message: sizeCheck.error });
    }
    const base64Attachments = filesToBase64Attachments(uploadedFiles);
    if (base64Attachments.length > 0) {
      console.log(`📎 [ScheduleEmail] ${base64Attachments.length} attachment(s) included, total raw size: ${uploadedFiles.reduce((s, f) => s + f.size, 0)} bytes`);
    }

    console.log(`📅 [ScheduleEmail] Starting email schedule request for contact ${id}, tenant ${tenantId}`);

    // Support both new format (date+time+timezone) and legacy format (scheduleAt)
    if (!subject || !html) {
      console.log(`📅 [ScheduleEmail] Validation failed: missing subject or html`);
      return res.status(400).json({ message: 'subject and html are required' });
    }

    if (!date && !scheduleAt) {
      console.log(`📅 [ScheduleEmail] Validation failed: missing date or scheduleAt`);
      return res.status(400).json({ message: 'date (with time and timezone) or scheduleAt is required' });
    }

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${id} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      console.log(`📅 [ScheduleEmail] Contact ${id} not found`);
      return res.status(404).json({ message: 'Contact not found' });
    }

    console.log(`📅 [ScheduleEmail] Found contact: ${maskEmail(String(contact.email))}, status: ${contact.status}`);

    if (!contact.email) {
      console.log(`📅 [ScheduleEmail] Contact ${id} has no email address`);
      return res.status(400).json({ message: 'Contact email is missing' });
    }

    // Hard block: check global suppression list (bounced_emails table) — cannot be overridden
    const suppressionRecord = await db.query.bouncedEmails.findFirst({
      where: and(
        sql`LOWER(${bouncedEmails.email}) = ${String(contact.email).toLowerCase().trim()}`,
        eq(bouncedEmails.isActive, true),
      ),
    });

    if (suppressionRecord) {
      const suppressedSince = suppressionRecord.firstBouncedAt
        ? new Date(suppressionRecord.firstBouncedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'an unknown date';
      const reason = suppressionRecord.suppressionReason || suppressionRecord.bounceReason || suppressionRecord.bounceType || 'provider suppression';

      console.log(`🚫 [ScheduleEmail] Hard-blocked: email ${maskEmail(String(contact.email))} is on suppression list (type=${suppressionRecord.bounceType}, since=${suppressedSince})`);

      return res.status(403).json({
        success: false,
        message: `This email address has been suppressed since ${suppressedSince} due to: ${reason}. No outgoing communication can be scheduled for this address. The email provider has flagged this address and further sending attempts may harm your sender reputation.`,
        contactStatus: 'suppressed',
        suppressionType: suppressionRecord.bounceType,
        suppressedSince: suppressionRecord.firstBouncedAt,
        suppressionReason: reason,
        email: maskEmail(String(contact.email)),
      });
    }

    // Block scheduling for unsubscribed/bounced contacts unless override flags are provided
    const { allowUnsubscribed, isTransactional } = req.body || {};
    const isUnsubscribedOrBounced = contact.status === 'unsubscribed' || contact.status === 'bounced';

    if (isUnsubscribedOrBounced) {
      // SECURITY: Only allow Administrators and Owners to override unsubscribe protection
      const isAdminOrOwner = ['Administrator', 'Owner'].includes(req.user.role || '');
      const userAttemptedOverride = allowUnsubscribed === true || isTransactional === true;
      const canOverride = isAdminOrOwner && userAttemptedOverride;

      if (canOverride) {
        // Audit log the override usage
        console.log(`🔓 [ScheduleEmail] Override used for ${contact.status} contact ${maskEmail(String(contact.email))} - allowUnsubscribed: ${allowUnsubscribed}, isTransactional: ${isTransactional}, userId: ${req.user.id}, role: ${req.user.role}, tenantId: ${tenantId}, timestamp: ${new Date().toISOString()}`);
      } else {
        console.log(`🚫 [ScheduleEmail] Blocked scheduling to ${contact.status} contact ${maskEmail(String(contact.email))} - override denied or not provided`);

        let errorMessage = `Cannot schedule email to ${contact.status} contact.`;
        if (userAttemptedOverride && !isAdminOrOwner) {
          errorMessage += " Insufficient permissions to override unsubscribe protection.";
        } else {
          errorMessage += " Use allowUnsubscribed or isTransactional flag to override (Requires Administrator role).";
        }

        return res.status(403).json({
          success: false,
          message: errorMessage,
          contactStatus: contact.status,
          email: maskEmail(String(contact.email)),
        });
      }
    }

    // Convert date + time + timezone to UTC
    // The frontend sends raw date (YYYY-MM-DD), time (HH:MM), and IANA timezone string
    let scheduleDate: Date;

    if (date) {
      // New format: date + time + timezone → convert to UTC
      // Validate timezone is present - do not silently default
      if (!timezone) {
        console.log(`📅 [ScheduleEmail] Validation failed: timezone required when using date+time format`);
        return res.status(400).json({
          message: 'Timezone required when scheduling via date+time. Please provide a valid IANA timezone (e.g., America/New_York)'
        });
      }

      // Convert local date + time + timezone to UTC
      try {
        scheduleDate = fromZonedTime(`${date}T${time || '00:00'}:00`, timezone);
        console.log(`📅 [ScheduleEmail] Timezone conversion: ${date} ${time || '00:00'} in ${timezone} → ${scheduleDate.toISOString()} UTC`);
      } catch (tzError) {
        console.error(`📅 [ScheduleEmail] Timezone conversion failed:`, tzError);
        return res.status(400).json({ message: `Invalid timezone: ${timezone}` });
      }
    } else {
      // Legacy format: scheduleAt is already an ISO string
      scheduleDate = new Date(scheduleAt);
    }

    if (isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ message: 'Invalid schedule date' });
    }
    if (scheduleDate.getTime() < Date.now() + 30 * 1000) {
      return res.status(400).json({ message: 'Schedule time must be at least 30 seconds in the future' });
    }

    // Get company info for footer label (no fallback if missing)
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, tenantId),
    });
    const companyName = (company?.name || '').trim();

    // Get master email design settings
    const emailDesign = await db.query.masterEmailDesign.findFirst({
      where: sql`${masterEmailDesign.tenantId} = ${tenantId}`,
    });
    console.log('📅 [ScheduleEmail] Master email design found:', emailDesign ? 'yes' : 'no (using defaults)');

    // Design settings with defaults
    const design = {
      primaryColor: emailDesign?.primaryColor || '#3B82F6',
      secondaryColor: emailDesign?.secondaryColor || '#1E40AF',
      accentColor: emailDesign?.accentColor || '#10B981',
      fontFamily: sanitizeFontFamily(emailDesign?.fontFamily),
      logoUrl: emailDesign?.logoUrl || null,
      headerText: emailDesign?.headerText || null,
      footerText: emailDesign?.footerText || (companyName ? `© ${new Date().getFullYear()} ${companyName}. All rights reserved.` : ''),
      socialLinks: null as null | {
        facebook?: string;
        twitter?: string;
        instagram?: string;
        linkedin?: string;
      },
      displayCompanyName: emailDesign?.companyName || companyName,
    };

    if (emailDesign?.socialLinks) {
      try {
        const parsed = JSON.parse(emailDesign.socialLinks);
        if (parsed && typeof parsed === 'object') {
          design.socialLinks = parsed;
        }
      } catch (e) {
        console.error('[ScheduleEmail] Failed to parse socialLinks:', e);
      }
    }

    // Build social links HTML if available
    let socialLinksHtml = '';
    if (design.socialLinks) {
      const links = [];
      const linkStyle = "color: #64748b; text-decoration: none; margin: 0 10px; font-weight: 500;";

      if (design.socialLinks.facebook && isValidHttpUrl(design.socialLinks.facebook)) {
        links.push(`<a href="${escapeHtml(design.socialLinks.facebook)}" style="${linkStyle}">Facebook</a>`);
      }
      if (design.socialLinks.twitter && isValidHttpUrl(design.socialLinks.twitter)) {
        links.push(`<a href="${escapeHtml(design.socialLinks.twitter)}" style="${linkStyle}">Twitter</a>`);
      }
      if (design.socialLinks.instagram && isValidHttpUrl(design.socialLinks.instagram)) {
        links.push(`<a href="${escapeHtml(design.socialLinks.instagram)}" style="${linkStyle}">Instagram</a>`);
      }
      if (design.socialLinks.linkedin && isValidHttpUrl(design.socialLinks.linkedin)) {
        links.push(`<a href="${escapeHtml(design.socialLinks.linkedin)}" style="${linkStyle}">LinkedIn</a>`);
      }

      if (links.length > 0) {
        socialLinksHtml = `<div style="margin-bottom: 24px;">${links.join(' | ')}</div>`;
      }
    }

    // Replace template placeholders (e.g. {{first_name}}, {{company_name}}) with actual contact data
    const resolvedHtml = replaceEmailPlaceholders(html, contact, companyName);
    const resolvedSubject = replaceEmailPlaceholders(String(subject), contact, companyName);

    // Format content as HTML using master email design (same as send-email route)
    // Sanitize user-provided HTML content to prevent XSS
    const sanitizedHtml = sanitizeEmailHtml(resolvedHtml);
    // Escape text fields to prevent XSS in display names and text content
    const safeDisplayCompanyName = escapeHtml(design.displayCompanyName || '');
    const safeHeaderText = design.headerText ? escapeHtml(design.headerText) : null;
    const safeFooterText = design.footerText ? escapeHtml(design.footerText) : null;

    const themedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: ${design.fontFamily}; margin: 0; padding: 0; background-color: #f7fafc; -webkit-font-smoothing: antialiased;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">

            <!-- Hero Header -->
            <div style="padding: 40px 32px; text-align: center; background-color: ${design.primaryColor}; color: #ffffff;">
              ${design.logoUrl ? `
                <img src="${escapeHtml(design.logoUrl)}" alt="${safeDisplayCompanyName}" style="height: 48px; width: auto; margin-bottom: 20px; object-fit: contain;" />
              ` : `
                <div style="height: 48px; width: 48px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px auto; line-height: 48px; font-size: 20px; font-weight: bold; color: #ffffff; text-align: center;">
                  ${escapeHtml((design.displayCompanyName || 'C').charAt(0))}
                </div>
              `}
              <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; letter-spacing: -0.025em; color: #ffffff;">
                ${safeDisplayCompanyName}
              </h1>
              ${safeHeaderText ? `
                <p style="margin: 0 auto; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">
                  ${safeHeaderText}
                </p>
              ` : ''}
            </div>

            <!-- Body Content -->
            <div style="padding: 64px 48px; min-height: 200px;">
              <div style="font-size: 16px; line-height: 1.625; color: #334155;">
                ${sanitizedHtml}
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b;">

              ${socialLinksHtml}

              ${safeFooterText ? `
                <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.5; color: #64748b;">${safeFooterText}</p>
              ` : ''}

              <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">
                <p style="margin: 0;">
                  Sent via ${safeDisplayCompanyName}
                </p>
              </div>
            </div>

          </div>
        </body>
      </html>`;

    // Schedule via Trigger.dev using the dedicated schedule-contact-email task
    try {
      const { triggerScheduleContactEmail } = await import('../../lib/trigger');
      const emailTrackingId = crypto.randomUUID();

      console.log(`📅 [ScheduleEmail] Scheduling email to ${maskEmail(String(contact.email))} for ${scheduleDate.toISOString()} (${timezone}), subject: "${resolvedSubject}"`);

      const result = await triggerScheduleContactEmail({
        to: String(contact.email),
        subject: sanitizeString(resolvedSubject) || 'No Subject',
        html: themedHtml,
        text: text ? replaceEmailPlaceholders(String(text), contact, companyName) : undefined,
        scheduledForUTC: scheduleDate.toISOString(),
        timezone: timezone,
        contactId: id,
        tenantId,
        scheduledBy: req.user.id,
        emailTrackingId,
        ...(base64Attachments.length > 0 && { attachments: base64Attachments }),
      });

      if (!result.success) {
        console.error(`❌ [ScheduleEmail] Failed to trigger schedule task: ${result.error}`);
        return res.status(503).json({ message: 'Email scheduling service unavailable', error: result.error });
      }

      console.log(`✅ [ScheduleEmail] Email scheduled successfully, runId: ${result.runId}`);

      // Create tracking records AFTER successful scheduling
      try {
        await db.insert(emailSends).values({
          id: emailTrackingId,
          tenantId,
          recipientEmail: String(contact.email),
          recipientName: contact.firstName && contact.lastName
            ? `${contact.firstName} ${contact.lastName}`
            : contact.firstName || contact.lastName || null,
          senderEmail: 'admin@zendwise.com',
          senderName: design.displayCompanyName || null,
          subject: sanitizeString(resolvedSubject) || 'No Subject',
          emailType: 'scheduled',
          provider: 'resend',
          status: 'pending',
          contactId: id,
          sentAt: null,
        });

        await db.insert(emailContent).values({
          emailSendId: emailTrackingId,
          htmlContent: themedHtml,
          textContent: text ? replaceEmailPlaceholders(String(text), contact, companyName) : null,
          metadata: JSON.stringify({
            scheduledFor: scheduleDate.toISOString(),
            timezone: timezone,
            scheduledBy: req.user.id,
            runId: result.runId,
            taskLogId: result.taskLogId,
          }),
        });

        await db.insert(emailActivity).values({
          tenantId,
          contactId: id,
          activityType: 'scheduled',
          activityData: JSON.stringify({
            subject: sanitizeString(resolvedSubject) || 'No Subject',
            scheduledFor: scheduleDate.toISOString(),
            timezone,
            scheduledBy: req.user.id,
            runId: result.runId,
            taskLogId: result.taskLogId,
          }),
          occurredAt: new Date(),
        });

        console.log(`📅 [ScheduleEmail] Created tracking records: ${emailTrackingId}`);
      } catch (trackingError) {
        console.error(`⚠️ [ScheduleEmail] Failed to create tracking records:`, trackingError);
        // Email is still scheduled, just without local tracking
      }

      return res.status(201).json({
        message: 'Email scheduled via Trigger.dev',
        runId: result.runId,
        taskLogId: result.taskLogId,
        contactId: id,
        scheduleAt: scheduleDate.toISOString(),
        timezone,
      });
    } catch (fatalError) {
      console.error(`❌ [ScheduleEmail] Fatal scheduling error:`, fatalError);
      return res.status(503).json({ message: 'Email scheduling service unavailable' });
    }
  } catch (error) {
    console.error('❌ [ScheduleEmail] Schedule single contact email error:', error);
    res.status(500).json({ message: 'Failed to schedule email' });
  }
});

// Send individual email to a contact (supports both JSON and multipart/form-data with attachments)
contactRoutes.post("/email-contacts/:id/send-email", authenticateToken, requireTenant, requirePermission('contacts.edit'), (req: any, res: any, next: any) => {
  // Only run multer for multipart/form-data requests (when attachments are present)
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    emailAttachmentUpload(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: handleEmailAttachmentError(err) });
      }
      next();
    });
  } else {
    next();
  }
}, async (req: any, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const { subject, content } = req.body;

    // Process attachments if present
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];
    const sizeCheck = validateAttachmentSize(uploadedFiles);
    if (!sizeCheck.valid) {
      return res.status(400).json({ message: sizeCheck.error });
    }
    const base64Attachments = filesToBase64Attachments(uploadedFiles);
    if (base64Attachments.length > 0) {
      console.log(`📎 [SendEmail] ${base64Attachments.length} attachment(s) included, total raw size: ${uploadedFiles.reduce((s, f) => s + f.size, 0)} bytes`);
    }

    console.log(`📧 [SendEmail] Starting individual email send for contact ${id}, tenant ${tenantId}`);

    // Validate input
    if (!subject || !content) {
      console.log(`📧 [SendEmail] Validation failed: missing subject or content`);
      return res.status(400).json({
        message: 'Subject and content are required'
      });
    }

    // Check email sending limits
    await storage.validateEmailSending(tenantId, 1);

    // Get contact
    const contact = await db.query.emailContacts.findFirst({
      where: and(
        eq(emailContacts.id, id),
        eq(emailContacts.tenantId, tenantId)
      ),
    });

    if (!contact) {
      console.log(`📧 [SendEmail] Contact ${id} not found`);
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    console.log(`📧 [SendEmail] Found contact: ${maskEmail(String(contact.email))}, status: ${contact.status}`);

    // Hard block: check global suppression list (bounced_emails table) — cannot be overridden
    const suppressionRecord = await db.query.bouncedEmails.findFirst({
      where: and(
        sql`LOWER(${bouncedEmails.email}) = ${String(contact.email).toLowerCase().trim()}`,
        eq(bouncedEmails.isActive, true),
      ),
    });

    if (suppressionRecord) {
      const suppressedSince = suppressionRecord.firstBouncedAt
        ? new Date(suppressionRecord.firstBouncedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'an unknown date';
      const reason = suppressionRecord.suppressionReason || suppressionRecord.bounceReason || suppressionRecord.bounceType || 'provider suppression';

      console.log(`🚫 [SendEmail] Hard-blocked: email ${maskEmail(String(contact.email))} is on suppression list (type=${suppressionRecord.bounceType}, since=${suppressedSince})`);

      return res.status(403).json({
        success: false,
        message: `This email address has been suppressed since ${suppressedSince} due to: ${reason}. No outgoing communication can be sent to this address. The email provider has flagged this address and further sending attempts may harm your sender reputation.`,
        contactStatus: 'suppressed',
        suppressionType: suppressionRecord.bounceType,
        suppressedSince: suppressionRecord.firstBouncedAt,
        suppressionReason: reason,
        email: maskEmail(String(contact.email)),
      });
    }

    // Block sending for unsubscribed/bounced contacts unless override flags are provided
    const { allowUnsubscribed, isTransactional } = req.body || {};
    const isUnsubscribedOrBounced = contact.status === 'unsubscribed' || contact.status === 'bounced';

    if (isUnsubscribedOrBounced) {
      // SECURITY: Only allow Administrators and Owners to override unsubscribe protection
      const isAdminOrOwner = ['Administrator', 'Owner'].includes(req.user.role || '');
      const userAttemptedOverride = allowUnsubscribed === true || isTransactional === true;
      const canOverride = isAdminOrOwner && userAttemptedOverride;

      if (canOverride) {
        // Audit log the override usage
        console.log(`🔓 [SendEmail] Override used for ${contact.status} contact ${maskEmail(String(contact.email))} - allowUnsubscribed: ${allowUnsubscribed}, isTransactional: ${isTransactional}, userId: ${req.user.id}, role: ${req.user.role}, tenantId: ${tenantId}, timestamp: ${new Date().toISOString()}`);
      } else {
        console.log(`🚫 [SendEmail] Blocked sending to ${contact.status} contact ${maskEmail(String(contact.email))} - override denied or not provided`);

        let errorMessage = `Cannot send email to ${contact.status} contact.`;
        if (userAttemptedOverride && !isAdminOrOwner) {
          errorMessage += " Insufficient permissions to override unsubscribe protection.";
        } else {
          errorMessage += " Use allowUnsubscribed or isTransactional flag to override (Requires Administrator role).";
        }

        return res.status(403).json({
          success: false,
          message: errorMessage,
          contactStatus: contact.status,
          email: maskEmail(String(contact.email)),
        });
      }
    }

    // Get tenant info for from email
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    // Get company info for footer label (no fallback if missing)
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, tenantId),
    });
    const companyName = (company?.name || '').trim();

    // Get master email design settings (for display name metadata/logging)
    const emailDesign = await db.query.masterEmailDesign.findFirst({
      where: sql`${masterEmailDesign.tenantId} = ${tenantId}`,
    });
    const displayCompanyName = (emailDesign?.companyName || companyName || '').trim();

    // Replace template placeholders (e.g. {{first_name}}, {{company_name}}) with actual contact data
    const resolvedContent = replaceEmailPlaceholders(content, contact, companyName);
    const resolvedSubject = replaceEmailPlaceholders(subject, contact, companyName);

    // Sanitize user-provided HTML content to prevent XSS before wrapping
    const sanitizedContent = sanitizeEmailHtml(resolvedContent.replace(/\n/g, '<br>'));

    // Match the send modal preview body block exactly
    const wrappedBodyContent = `
      <div style="padding:64px 48px;min-height:200px;">
        <div style="font-size:16px;line-height:1.625;color:#334155;">
          ${sanitizedContent}
        </div>
      </div>
    `;

    // Use shared wrapper so sent output matches preview and active email design
    const htmlContent = await wrapNewsletterContent(tenantId, wrappedBodyContent);

    // Send email via Trigger.dev queue
    // Generate a unique ID to track this email send - will be stored in email_sends and passed to Trigger task
    const emailTrackingId = crypto.randomUUID();
    let emailActivityId: string | null = null;

    let result: { success: boolean; runId?: string; error?: string };
    try {
      const { sendEmailTask } = await import('../../../src/trigger/email');
      const handle = await sendEmailTask.trigger({
        to: contact.email,
        subject: resolvedSubject,
        html: htmlContent,
        text: resolvedContent,
        metadata: {
          type: 'individual_contact_email',
          contactId: contact.id,
          tenantId: tenantId,
          sentBy: req.user.id,
          emailTrackingId: emailTrackingId, // Pass tracking ID so task can update email_sends with actual Resend ID
        },
        ...(base64Attachments.length > 0 && { attachments: base64Attachments }),
      });
      console.log(`📧 [SendEmail] Triggered send-email task, runId: ${handle.id}, trackingId: ${emailTrackingId}`);
      result = { success: true, runId: handle.id };

      // Log email activity as 'sent' now that the task system accepted it
      try {
        const [insertedActivity] = await db.insert(emailActivity).values({
          contactId: contact.id,
          tenantId: tenantId,
          activityType: 'sent',
          activityData: JSON.stringify({
            source: 'individual_send',
            sentBy: req.user.id,
            subject: resolvedSubject,
            recipient: contact.email,
            recipientName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || undefined,
            from: displayCompanyName || 'Manager',
          }),
          occurredAt: new Date(),
        }).returning();
        emailActivityId = insertedActivity.id;
        console.log(`📝 [SendEmail] Logged email activity as sent for ${contact.email}, id: ${emailActivityId}`);
      } catch (activityLogError) {
        console.error(`⚠️ [SendEmail] Failed to log email activity:`, activityLogError);
      }

    } catch (triggerError: any) {
      console.error('[SendEmail] Failed to trigger email task:', triggerError);

      return res.status(503).json({
        success: false,
        message: 'Email server is not available. Please try again later.'
      });
    }

    // Log to activity_logs table for user activity tracking
    try {
      await logActivity({
        tenantId: tenantId,
        userId: req.user.id,
        entityType: 'email',
        entityId: emailActivityId || undefined,
        entityName: `Email to ${contact.email}`,
        activityType: 'sent',
        description: `Sent direct email "${resolvedSubject}" to ${contact.firstName || ''} ${contact.lastName || ''} (${contact.email})`.trim(),
        metadata: {
          emailActivityId: emailActivityId,
          contactId: contact.id,
          contactEmail: contact.email,
          emailSubject: resolvedSubject,
          triggerRunId: result?.runId
        },
        req
      });
      console.log(`📝 [SendEmail] Logged to activity_logs for user ${req.user.id}`);
    } catch (activityLogError) {
      console.error(`⚠️ [SendEmail] Failed to log to activity_logs:`, activityLogError);
    }

    // Log to email_sends table for limit tracking - use emailTrackingId as the record ID
    // so the Trigger task can update it with the actual Resend email ID after sending
    try {
      await db.insert(emailSends).values({
        id: emailTrackingId,
        tenantId: tenantId,
        recipientEmail: contact.email,
        recipientName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
        senderEmail: 'admin@zendwise.com', // Default sender or configured one
        senderName: displayCompanyName || 'Manager',
        subject: resolvedSubject,
        emailType: 'individual',
        provider: 'resend',
        providerMessageId: null, // Will be updated by Trigger task with actual Resend email ID
        status: 'pending',
        contactId: contact.id,
        promotionId: null,
        sentAt: null, // Not sent yet
      });
      console.log(`📧 [SendEmail] Logged to email_sends table for ${contact.email}, trackingId: ${emailTrackingId}`);
    } catch (logError) {
      console.error(`⚠️ [SendEmail] Failed to log to email_sends table:`, logError);
    }

    // Update contact stats - update lastActivity (emailsSent increment is handled by internal callback)
    await db.update(emailContacts)
      .set({
        lastActivity: new Date(),
        updatedAt: new Date()
      })
      .where(eq(emailContacts.id, contact.id));

    console.log(`✅ [SendEmail] Email queued successfully for ${contact.email}, subject: "${subject}", runId: ${result?.runId}`);

    res.json({
      success: true,
      message: "Email sent successfully",
      result
    });
  } catch (error: any) {
    console.error(`❌ [SendEmail] Send individual email error:`, error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send email"
    });
  }
});

