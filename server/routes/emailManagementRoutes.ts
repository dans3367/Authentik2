import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and } from 'drizzle-orm';
import { emailContacts, emailLists, bouncedEmails, contactTags, contactListMemberships, contactTagAssignments, betterAuthUser, birthdaySettings, eCardSettings, emailActivity, tenants, emailSends, emailContent, companies, unsubscribeTokens, masterEmailDesign, triggerTasks } from '@shared/schema';
import { deleteImageFromR2 } from '../config/r2';
import { authenticateToken, requireTenant, requirePermission } from '../middleware/auth-middleware';
import { authenticateInternalService, InternalServiceRequest } from '../middleware/internal-service-auth';
import { type ContactFilters, type BouncedEmailFilters } from '@shared/schema';
import { sanitizeString, sanitizeEmail } from '../utils/sanitization';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';
import { enhancedEmailService } from '../emailService';
import crypto from 'crypto';
import { logActivity, computeChanges, allowedActivityTypes } from '../utils/activityLogger';
import xss from 'xss';
import { emailAttachmentUpload, validateAttachmentSize, filesToBase64Attachments, handleEmailAttachmentError } from '../middleware/emailAttachmentUpload';
import { fromZonedTime } from 'date-fns-tz';

// Sanitize HTML content for emails - allows safe formatting tags, strips scripts and event handlers
export function sanitizeEmailHtml(html: string): string {
  return xss(html, {
    whiteList: {
      // Text formatting
      p: ['style', 'class'],
      br: [],
      strong: ['style'],
      b: ['style'],
      em: ['style'],
      i: ['style'],
      u: ['style'],
      s: ['style'],
      strike: ['style'],
      // Headings
      h1: ['style', 'class'],
      h2: ['style', 'class'],
      h3: ['style', 'class'],
      h4: ['style', 'class'],
      h5: ['style', 'class'],
      h6: ['style', 'class'],
      // Links and images
      a: ['href', 'title', 'target', 'style', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style', 'class'],
      // Lists
      ul: ['style', 'class'],
      ol: ['style', 'class'],
      li: ['style', 'class'],
      // Layout
      div: ['style', 'class'],
      span: ['style', 'class'],
      blockquote: ['style', 'class'],
      pre: ['style', 'class'],
      code: ['style', 'class'],
      // Tables (common in emails)
      table: ['style', 'class', 'width', 'border', 'cellpadding', 'cellspacing'],
      thead: ['style', 'class'],
      tbody: ['style', 'class'],
      tr: ['style', 'class'],
      th: ['style', 'class', 'colspan', 'rowspan', 'width'],
      td: ['style', 'class', 'colspan', 'rowspan', 'width', 'valign', 'align'],
      // Misc
      hr: ['style'],
      center: ['style'],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'noscript', 'iframe', 'object', 'embed'],
    onTagAttr: (tag, name, value) => {
      // Allow data URIs for images only (base64 encoded images)
      if (tag === 'img' && name === 'src') {
        if (value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://')) {
          return `${name}="${(xss as any).escapeAttrValue(value)}"`;
        }
        return ''; // Strip invalid src
      }
      // Validate href attributes to prevent javascript: URLs
      if (name === 'href') {
        const lowerValue = value.toLowerCase().trim();
        if (lowerValue.startsWith('javascript:') || lowerValue.startsWith('vbscript:') || lowerValue.startsWith('data:')) {
          return ''; // Strip dangerous href
        }
      }
      // Strip event handlers (onclick, onerror, etc.)
      if (name.startsWith('on')) {
        return '';
      }
      return undefined; // Use default processing
    },
  });
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c: string) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

/**
 * Replace template placeholders (e.g. {{first_name}}, {{company_name}}) with actual contact/company data.
 * Handles both HTML body and subject lines.
 * All substituted values are HTML-escaped to prevent injection attacks.
 */
function replaceEmailPlaceholders(
  text: string,
  contact: { firstName?: string | null; lastName?: string | null; email?: string | null },
  companyName?: string,
): string {
  // HTML-escape all values before substitution to prevent injection
  const escapedFirstName = escapeHtml(contact.firstName || '');
  const escapedLastName = escapeHtml(contact.lastName || '');
  const escapedFullName = escapeHtml(`${contact.firstName || ''} ${contact.lastName || ''}`.trim());
  const escapedEmail = escapeHtml(contact.email || '');
  const escapedCompanyName = escapeHtml(companyName || '');

  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, escapedFirstName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, escapedLastName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, escapedFullName)
    .replace(/\{\{\s*email\s*\}\}/gi, escapedEmail)
    .replace(/\{\{\s*company_name\s*\}\}/gi, escapedCompanyName);
}

function sanitizeFontFamily(fontFamily: string | undefined | null): string {
  if (!fontFamily) return 'Arial, sans-serif';

  // Strict allowlist of safe font stacks
  // This prevents CSS injection by rejecting any input containing dangerous characters
  // (quotes, semicolons, parentheses, URL-like patterns) that wouldn't match these exact strings.
  const allowedFonts = [
    'Arial, Helvetica, sans-serif',
    'Georgia, serif',
    'Tahoma, Geneva, sans-serif',
    'Verdana, Geneva, sans-serif',
    'Times New Roman, Times, serif',
    'Courier New, Courier, monospace',
    'Trebuchet MS, Helvetica, sans-serif',
    'Impact, Charcoal, sans-serif',
    'Lucida Console, Monaco, monospace'
  ];

  const normalized = fontFamily.trim();

  // Case-insensitive match against allowlist
  const match = allowedFonts.find(f => f.toLowerCase() === normalized.toLowerCase());

  return match || 'Arial, sans-serif';
}

function maskEmail(email: string): string {
  const trimmed = String(email || '').trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return '***';
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  return `${local[0]}***@${domain}`;
}

type PromotionalEmailJobPayload = {
  tenantId: string;
  contactId: string;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  promoSubject: string;
  htmlPromo: string;
  unsubscribeToken?: string;
  promotionId?: string | null;
  manual?: boolean;
};

/**
 * Enqueue a promotional email job using Trigger.dev for durable scheduling
 * Replaces the volatile setTimeout approach with a persistent task
 * Returns immediately without blocking the route handler
 */
async function enqueuePromotionalEmailJob(
  payload: PromotionalEmailJobPayload,
  delayMs: number
): Promise<{ success: boolean; runId?: string; error?: string }> {
  try {
    const { tasks } = await import('@trigger.dev/sdk/v3');
    const { logTriggerTask } = await import('../lib/trigger');
    const taskId = 'schedule-promotional-email';

    // Trigger the durable task with the payload and delay
    const handle = await tasks.trigger(taskId, {
      ...payload,
      delayMs,
    });

    console.log(`✅ [PromotionalEmailJob] Scheduled via Trigger.dev (ID: ${handle.id}) with ${delayMs}ms delay for ${maskEmail(payload.recipientEmail)}`);

    // Log to trigger_tasks table for tracking
    await logTriggerTask({
      taskId,
      runId: handle.id,
      payload: { ...payload, delayMs },
      status: 'triggered',
      tenantId: payload.tenantId,
      relatedType: 'email',
      relatedId: payload.contactId,
    });

    return {
      success: true,
      runId: handle.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ [PromotionalEmailJob] Failed to schedule via Trigger.dev:', errorMessage);

    // Fallback to direct execution if Trigger.dev is unavailable
    console.log('⚠️ [PromotionalEmailJob] Falling back to direct execution');
    void sendPromotionalEmailJob(payload).catch((fallbackErr) => {
      console.error('❌ [PromotionalEmailJob] Fallback execution failed:', fallbackErr);
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function sendPromotionalEmailJob(payload: PromotionalEmailJobPayload): Promise<void> {
  const { enhancedEmailService } = await import('../emailService');

  const promoResult = await enhancedEmailService.sendCustomEmail(
    payload.recipientEmail,
    `🎁 ${payload.promoSubject}`,
    payload.htmlPromo,
    {
      text: payload.htmlPromo.replace(/<[^>]*>/g, ''),
      from: 'admin@zendwise.com',
      metadata: {
        type: 'birthday-promotion',
        contactId: payload.contactId,
        tenantId: payload.tenantId,
        manual: !!payload.manual,
        tags: ['birthday', ...(payload.manual ? ['manual'] : []), 'promotion', `tenant-${payload.tenantId}`],
        unsubscribeToken: payload.unsubscribeToken || 'none',
      },
    }
  );

  // Check if email send was successful
  if (!promoResult.success) {
    console.error(`❌ [PromotionalEmailJob] Failed to send promotional email:`, {
      recipient: payload.recipientEmail,
      contactId: payload.contactId,
      tenantId: payload.tenantId,
      error: promoResult.error,
      providerId: promoResult.providerId,
    });

    // Log failed activity
    try {
      await db.insert(emailActivity).values({
        tenantId: payload.tenantId,
        contactId: payload.contactId,
        activityType: 'failed',
        activityData: JSON.stringify({
          type: 'birthday-promotion',
          manual: !!payload.manual,
          split: true,
          subject: `🎁 ${payload.promoSubject}`,
          recipient: payload.recipientEmail,
          from: 'admin@zendwise.com',
          error: promoResult.error,
          providerId: promoResult.providerId,
        }),
        occurredAt: new Date(),
      });
    } catch (logError) {
      console.error(`⚠️ [PromotionalEmailJob] Failed to log failed email activity:`, logError);
    }

    // Log failed send to email_sends table
    try {
      const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
      await db.insert(emailSends).values({
        id: emailSendId,
        tenantId: payload.tenantId,
        recipientEmail: payload.recipientEmail,
        recipientName: payload.recipientName,
        senderEmail: 'admin@zendwise.com',
        senderName: payload.senderName,
        subject: `🎁 ${payload.promoSubject}`,
        emailType: 'promotional',
        provider: promoResult.providerId || 'resend',
        providerMessageId: promoResult.messageId || null,
        status: 'failed',
        contactId: payload.contactId,
        promotionId: payload.promotionId || null,
        sentAt: null,
      });
    } catch (logError) {
      console.error(`⚠️ [PromotionalEmailJob] Failed to log failed send to email_sends table:`, logError);
    }

    return;
  }

  // Email sent successfully - extract provider message ID safely
  const providerMessageId = promoResult.messageId || null;

  console.log(`✅ [PromotionalEmailJob] Successfully sent promotional email:`, {
    recipient: payload.recipientEmail,
    contactId: payload.contactId,
    messageId: providerMessageId,
    providerId: promoResult.providerId,
  });

  // Log successful activity
  try {
    await db.insert(emailActivity).values({
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      activityType: 'sent',
      activityData: JSON.stringify({
        type: 'birthday-promotion',
        manual: !!payload.manual,
        split: true,
        subject: `🎁 ${payload.promoSubject}`,
        recipient: payload.recipientEmail,
        from: 'admin@zendwise.com',
        messageId: providerMessageId,
        providerId: promoResult.providerId,
      }),
      occurredAt: new Date(),
    });
  } catch (logError) {
    console.error(`⚠️ [PromotionalEmailJob] Failed to log promotional email activity:`, logError);
  }

  // Log successful send to email_sends and email_content tables
  try {
    const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
    await db.insert(emailSends).values({
      id: emailSendId,
      tenantId: payload.tenantId,
      recipientEmail: payload.recipientEmail,
      recipientName: payload.recipientName,
      senderEmail: 'admin@zendwise.com',
      senderName: payload.senderName,
      subject: `🎁 ${payload.promoSubject}`,
      emailType: 'promotional',
      provider: promoResult.providerId || 'resend',
      providerMessageId: providerMessageId,
      status: 'sent',
      contactId: payload.contactId,
      promotionId: payload.promotionId || null,
      sentAt: new Date(),
    });

    await db.insert(emailContent).values({
      emailSendId: emailSendId,
      htmlContent: payload.htmlPromo,
      textContent: payload.htmlPromo.replace(/<[^>]*>/g, ''),
      metadata: JSON.stringify({
        split: true,
        manual: !!payload.manual,
        birthdayCard: false,
        promotional: true,
        messageId: providerMessageId,
        providerId: promoResult.providerId,
      }),
    });
  } catch (logError) {
    console.error(`⚠️ [PromotionalEmailJob] Failed to log to email_sends/email_content table:`, logError);
  }
}

export const emailManagementRoutes = Router();

// Get email contacts
emailManagementRoutes.get("/email-contacts", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
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
      limit: Number(limit),
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

// List scheduled emails for a specific contact (timeline)
emailManagementRoutes.get("/email-contacts/:id/scheduled", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
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

// Update a scheduled email for a specific contact
emailManagementRoutes.put("/email-contacts/:id/scheduled/:queueId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  // Scheduled email updates require cancelling the existing run and creating a new one
  res.status(501).json({ message: 'To update a scheduled email, cancel it and create a new one' });
});

// Delete (cancel) a scheduled email for a specific contact
emailManagementRoutes.delete("/email-contacts/:id/scheduled/:queueId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { queueId, id: relatedId } = req.params;
    const tenantId = req.user.tenantId;

    // queueId could be a runId (run_xxx) or a trigger_tasks id
    const { cancelReminderRun, updateTriggerTaskStatus } = await import('../lib/trigger');

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

    // Verify contact ownership - prevent same-tenant users from canceling each other's scheduled emails
    const isAdminOrOwner = ['Administrator', 'Owner'].includes(req.user.role || '');
    if (contact.addedByUserId && contact.addedByUserId !== req.user.id && !isAdminOrOwner) {
      return res.status(403).json({ message: 'You can only cancel scheduled emails for contacts you added' });
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
emailManagementRoutes.get("/email-contacts/:id", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
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
emailManagementRoutes.get("/email-contacts/:id/stats", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
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
        .from(db.emailActivity)
        .where(sql`${db.emailActivity.contactId} = ${id} AND ${db.emailActivity.activityType} = 'clicked'`);
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
        const bounceCheck = await db.query.bouncedEmails?.findFirst?.({
          where: sql`${db.bouncedEmails.email} = ${contact.email}`,
        });
        emailsBounced = bounceCheck ? 1 : 0;
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
emailManagementRoutes.post("/email-contacts", authenticateToken, requireTenant, requirePermission('contacts.create'), async (req: any, res) => {
  try {
    const { email, firstName, lastName, tags, lists, status, consentGiven, consentMethod, consentIpAddress, consentUserAgent, address, city, state, zipCode, country, phoneNumber } = req.body;

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
        address: sanitizedAddress,
        city: sanitizedCity,
        state: sanitizedState,
        zipCode: sanitizedZipCode,
        country: sanitizedCountry,
        phoneNumber: sanitizedPhoneNumber,
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
  } catch (error) {
    console.error('Create email contact error:', error);
    res.status(500).json({ message: 'Failed to create email contact' });
  }
});

// Update email contact
emailManagementRoutes.put("/email-contacts/:id", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, status, birthday, address, city, state, zipCode, country, phoneNumber } = req.body;

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
emailManagementRoutes.delete("/email-contacts/:id", authenticateToken, requireTenant, requirePermission('contacts.delete'), async (req: any, res) => {
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
emailManagementRoutes.delete("/email-contacts", authenticateToken, requireTenant, requirePermission('contacts.delete'), async (req: any, res) => {
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
      tenantId: req.user.tenantId,
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
emailManagementRoutes.delete("/email-lists/:id", authenticateToken, requireTenant, async (req: any, res) => {
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
emailManagementRoutes.get("/contact-tags", authenticateToken, requireTenant, requirePermission('tags.view'), async (req: any, res) => {
  try {
    const tags = await db.query.contactTags.findMany({
      where: sql`${contactTags.tenantId} = ${req.user.tenantId}`,
      orderBy: sql`${contactTags.name} ASC`,
      with: {
        assignments: true,
      },
    });

    // Add contact count to each tag
    const tagsWithCount = tags.map((tag: any) => ({
      ...tag,
      contactCount: tag.assignments?.length || 0,
      assignments: undefined, // Remove assignments from response
    }));

    res.json({ tags: tagsWithCount });
  } catch (error) {
    console.error('Get contact tags error:', error);
    res.status(500).json({ message: 'Failed to get contact tags' });
  }
});

// Create contact tag
emailManagementRoutes.post("/contact-tags", authenticateToken, requireTenant, requirePermission('tags.create'), async (req: any, res) => {
  try {
    const { name, color, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const sanitizedName = sanitizeString(name);
    const sanitizedColor = color ? sanitizeString(color) : '#3B82F6';
    const sanitizedDescription = description ? sanitizeString(description) : null;

    const newTag = await db.insert(contactTags).values({
      tenantId: req.user.tenantId,
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
emailManagementRoutes.put("/contact-tags/:id", authenticateToken, requireTenant, requirePermission('tags.edit'), async (req: any, res) => {
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
      updateData.color = sanitizeString(color);
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
emailManagementRoutes.delete("/contact-tags/:id", authenticateToken, requireTenant, requirePermission('tags.delete'), async (req: any, res) => {
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

// Add contact to list
emailManagementRoutes.post("/email-contacts/:contactId/lists/:listId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
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
emailManagementRoutes.delete("/email-contacts/:contactId/lists/:listId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
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

// Schedule a single B2C email for a contact (Send Later) - supports both JSON and multipart/form-data with attachments
emailManagementRoutes.post("/email-contacts/:id/schedule", authenticateToken, requireTenant, requirePermission('contacts.edit'), (req: any, res: any, next: any) => {
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
      logoUrl: emailDesign?.logoUrl || company?.logoUrl || null,
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
      const { triggerScheduleContactEmail } = await import('../lib/trigger');
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

// Add contacts to list (bulk)
emailManagementRoutes.post("/email-lists/:listId/contacts", authenticateToken, requireTenant, async (req: any, res) => {
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

// Add tag to contact
emailManagementRoutes.post("/email-contacts/:contactId/tags/:tagId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
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
emailManagementRoutes.delete("/email-contacts/:contactId/tags/:tagId", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
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
emailManagementRoutes.post("/contact-tags/:tagId/contacts", authenticateToken, requireTenant, async (req: any, res) => {
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

// Get contact activity
emailManagementRoutes.get("/email-contacts/:contactId/activity", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
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
emailManagementRoutes.patch("/email-contacts/:contactId/birthday-email", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
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
emailManagementRoutes.patch("/email-contacts/birthday-email/bulk", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
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
      const unsubscribedContacts = contacts.filter((c: any) => c.birthdayUnsubscribedAt);
      if (unsubscribedContacts.length > 0) {
        return res.status(403).json({
          message: `Cannot re-enable birthday emails for ${unsubscribedContacts.length} contact(s) who have unsubscribed. These customers must opt-in again through the unsubscribe link.`,
          reason: 'unsubscribed',
          unsubscribedContactIds: unsubscribedContacts.map((c: any) => c.id)
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
        birthday: true,
        birthdayEmailEnabled: true,
        birthdayUnsubscribedAt: true,
        addedDate: true,
        lastActivity: true,
        emailsSent: true,
        emailsOpened: true,
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
    const contacts = contactsData.map((contact: any) => ({
      ...contact,
      tags: contact.tagAssignments.map((ta: any) => ta.tag),
      lists: contact.listMemberships.map((lm: any) => lm.list),
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
        senderName: company?.name || '',
        promotionId: null,
        promotion: null,
        disabledHolidays: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return res.json(defaultSettings);
    }

    // Ensure senderName and disabledHolidays are always present with default values
    const settingsWithDefaults = {
      ...settings,
      senderName: settings.senderName || company?.name || '',
      disabledHolidays: settings.disabledHolidays || []
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
      splitPromotionalEmail,
      disabledHolidays
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

    // Validate disabledHolidays if provided
    if (disabledHolidays !== undefined && disabledHolidays !== null) {
      if (!Array.isArray(disabledHolidays)) {
        return res.status(400).json({ message: 'disabledHolidays must be an array' });
      }
      // Validate each element is a string
      if (!disabledHolidays.every((id: any) => typeof id === 'string')) {
        return res.status(400).json({ message: 'disabledHolidays array must contain only strings' });
      }
    }


    // Validate custom theme data if provided
    if (customThemeData !== undefined && customThemeData !== null) {
      try {
        if (typeof customThemeData === 'string') {
          // Handle the string 'null' as a special case (treat it as null/undefined)
          if (customThemeData === 'null') {
            // This is valid - the string 'null' will be stored as-is or can be converted to null
          } else {
            JSON.parse(customThemeData);
          }
        } else if (typeof customThemeData === 'object') {
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
        disabledHolidays: disabledHolidays !== undefined ? disabledHolidays : [],
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
        disabledHolidays: disabledHolidays !== undefined ? disabledHolidays : [],
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

// Get e-card settings
emailManagementRoutes.get("/e-card-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const settings = await db.query.eCardSettings.findFirst({
      where: sql`${eCardSettings.tenantId} = ${req.user.tenantId}`,
    });

    // If no settings exist, return default settings
    if (!settings) {
      console.log('🎴 [E-Card Settings GET] No settings found, returning defaults');
      const defaultSettings = {
        id: '',
        enabled: false,
        emailTemplate: 'default',
        customMessage: '',
        senderName: '',
        customThemeData: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return res.json(defaultSettings);
    }

    console.log('🎴 [E-Card Settings GET] Returning settings:', {
      id: settings.id,
      emailTemplate: settings.emailTemplate,
      enabled: settings.enabled,
      customThemeData: settings.customThemeData ? 'present' : 'null'
    });

    res.json(settings);
  } catch (error) {
    console.error('Get e-card settings error:', error);
    res.status(500).json({ message: 'Failed to get e-card settings' });
  }
});

// Update e-card settings
emailManagementRoutes.put("/e-card-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const {
      enabled,
      emailTemplate,
      customMessage,
      customThemeData,
      senderName,
    } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Validate customThemeData if provided (should be valid JSON string or null)
    let customThemeDataStr = customThemeData;
    if (customThemeData !== undefined && customThemeData !== null && customThemeData !== 'null') {
      try {
        // If it's already a string, try to parse it to validate
        if (typeof customThemeData === 'string') {
          JSON.parse(customThemeData);
          customThemeDataStr = customThemeData;
        } else {
          // If it's an object, stringify it
          customThemeDataStr = JSON.stringify(customThemeData);
        }
      } catch (error) {
        return res.status(400).json({ message: 'customThemeData must be valid JSON' });
      }
    } else if (customThemeData === 'null') {
      customThemeDataStr = null;
    }

    // Get existing settings to extract old image URL for cleanup
    const existingSettings = await db.query.eCardSettings.findFirst({
      where: sql`${eCardSettings.tenantId} = ${req.user.tenantId}`,
    });

    const oldImageUrl = existingSettings?.customThemeData
      ? (() => {
        try {
          const data = JSON.parse(existingSettings.customThemeData);
          return data?.imageUrl || null;
        } catch {
          return null;
        }
      })()
      : null;

    let updatedSettings;

    if (existingSettings) {
      // Update existing settings
      updatedSettings = await db.update(eCardSettings)
        .set({
          enabled,
          emailTemplate: emailTemplate || 'default',
          customMessage: customMessage || '',
          customThemeData: customThemeDataStr,
          senderName: senderName || '',
          updatedAt: new Date(),
        })
        .where(sql`${eCardSettings.id} = ${existingSettings.id}`)
        .returning();
    } else {
      // Create new settings if they don't exist
      const insertData = {
        tenantId: req.user.tenantId,
        enabled,
        emailTemplate: emailTemplate || 'default',
        customMessage: customMessage || '',
        customThemeData: customThemeDataStr,
        senderName: senderName || '',
      };

      updatedSettings = await db.insert(eCardSettings)
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
          console.log('📸 [E-Card Settings] Cleaning up old image:', oldImageUrl);
          // Delete old image asynchronously (don't wait for it to complete)
          deleteImageFromR2(oldImageUrl).catch(error => {
            console.error('📸 [E-Card Settings] Failed to delete old image:', oldImageUrl, error);
          });
        }
      } catch (error) {
        console.warn('Failed to compare image URLs for cleanup:', error);
      }
    }

    // Log what we're about to return
    console.log('🎴 [E-Card Settings PUT] Returning updated settings:', {
      id: updatedSettings[0]?.id,
      emailTemplate: updatedSettings[0]?.emailTemplate,
      enabled: updatedSettings[0]?.enabled,
      customThemeData: updatedSettings[0]?.customThemeData ? 'present' : 'null'
    });

    // Return just the settings object to match GET endpoint structure
    res.json(updatedSettings[0]);
  } catch (error) {
    console.error('Update e-card settings error:', error);
    res.status(500).json({ message: 'Failed to update e-card settings' });
  }
});

// Get master email design settings
emailManagementRoutes.get("/master-email-design", authenticateToken, requireTenant, requirePermission('emails.manage_design'), async (req: any, res) => {
  try {
    const design = await db.query.masterEmailDesign.findFirst({
      where: sql`${masterEmailDesign.tenantId} = ${req.user.tenantId}`,
    });

    // Get company info for defaults
    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId} AND ${companies.isActive} = true`,
    });

    // If no design exists, return default settings
    if (!design) {
      console.log('🎨 [Master Email Design GET] No design found, returning defaults');
      const defaultDesign = {
        id: '',
        tenantId: req.user.tenantId,
        companyName: company?.name || '',
        logoUrl: company?.logoUrl || null,
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        accentColor: '#10B981',
        fontFamily: 'Arial, sans-serif',
        headerText: null,
        footerText: company?.name ? `© ${new Date().getFullYear()} ${company.name}. All rights reserved.` : null,
        socialLinks: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return res.json(defaultDesign);
    }

    console.log('🎨 [Master Email Design GET] Returning design:', { id: design.id });
    res.json(design);
  } catch (error) {
    console.error('Get master email design error:', error);
    res.status(500).json({ message: 'Failed to get master email design' });
  }
});

// Update master email design settings
emailManagementRoutes.put("/master-email-design", authenticateToken, requireTenant, requirePermission('emails.manage_design'), async (req: any, res) => {
  try {
    const {
      companyName,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      headerText,
      footerText,
      socialLinks,
    } = req.body;

    console.log('🎨 [Master Email Design PUT] Received:', { companyName, logoUrl, headerText, primaryColor, tenantId: req.user.tenantId });

    // Check if design already exists
    const existingDesign = await db.query.masterEmailDesign.findFirst({
      where: sql`${masterEmailDesign.tenantId} = ${req.user.tenantId}`,
    });

    let updatedDesign;

    const hasSocialLinks = Object.prototype.hasOwnProperty.call(req.body, 'socialLinks');
    let socialLinksStr: string | null | undefined;

    if (hasSocialLinks) {
      if (socialLinks === null) {
        socialLinksStr = null;
      } else if (typeof socialLinks === 'string') {
        try {
          JSON.parse(socialLinks);
        } catch (e) {
          return res.status(400).json({ message: 'Invalid socialLinks JSON' });
        }
        socialLinksStr = socialLinks;
      } else if (typeof socialLinks === 'object') {
        socialLinksStr = JSON.stringify(socialLinks);
      } else {
        return res.status(400).json({ message: 'Invalid socialLinks type' });
      }
    }

    if (existingDesign) {
      // Update existing design
      const updateSet: Record<string, unknown> = {
        companyName: companyName ?? existingDesign.companyName,
        logoUrl: logoUrl !== undefined ? logoUrl : existingDesign.logoUrl,
        primaryColor: primaryColor ?? existingDesign.primaryColor,
        secondaryColor: secondaryColor ?? existingDesign.secondaryColor,
        accentColor: accentColor ?? existingDesign.accentColor,
        fontFamily: fontFamily ?? existingDesign.fontFamily,
        headerText: headerText !== undefined ? headerText : existingDesign.headerText,
        footerText: footerText !== undefined ? footerText : existingDesign.footerText,
        updatedAt: new Date(),
      };

      if (hasSocialLinks) {
        updateSet.socialLinks = socialLinksStr;
      }

      updatedDesign = await db.update(masterEmailDesign)
        .set(updateSet)
        .where(sql`${masterEmailDesign.tenantId} = ${req.user.tenantId}`)
        .returning();
    } else {
      // Create new design
      updatedDesign = await db.insert(masterEmailDesign)
        .values({
          tenantId: req.user.tenantId,
          companyName: companyName || '',
          logoUrl: logoUrl || null,
          primaryColor: primaryColor || '#3B82F6',
          secondaryColor: secondaryColor || '#1E40AF',
          accentColor: accentColor || '#10B981',
          fontFamily: fontFamily || 'Arial, sans-serif',
          headerText: headerText || null,
          footerText: footerText || null,
          socialLinks: hasSocialLinks ? socialLinksStr : null,
        })
        .returning();
    }

    console.log('🎨 [Master Email Design PUT] Updated design:', { id: updatedDesign[0]?.id });
    res.json(updatedDesign[0]);
  } catch (error) {
    console.error('Update master email design error:', error);
    res.status(500).json({ message: 'Failed to update master email design' });
  }
});

// Send birthday invitation email to a contact via Trigger.dev
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

    if (!contact.email) {
      return res.status(400).json({ message: 'Contact email is missing' });
    }

    if (contact.status === 'unsubscribed' || contact.status === 'bounced') {
      return res.status(400).json({ message: 'Contact is unsubscribed or bounced' });
    }

    const suppressed = await db.query.bouncedEmails.findFirst({
      where: eq(bouncedEmails.email, String(contact.email).toLowerCase().trim()),
    }).catch(() => null);

    if (suppressed) {
      return res.status(400).json({ message: 'Email is globally suppressed/bounced' });
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

    const baseUrl = process.env.APP_URL || 'http://localhost:5002';
    const profileUpdateUrl = `${baseUrl}/update-profile?token=${profileUpdateToken}`;
    const maskedToken = profileUpdateToken.length > 8
      ? `${profileUpdateToken.slice(0, 4)}...${profileUpdateToken.slice(-4)}`
      : '[redacted]';
    console.log('🔗 [Birthday Invitation] Generated profile update link:', { baseUrl, path: '/update-profile', token: maskedToken });

    const emailTrackingId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
    const recipientName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
    const subject = `🎂 Help us celebrate your special day!`;

    await db.insert(emailSends).values({
      id: emailTrackingId,
      tenantId: req.user.tenantId,
      recipientEmail: contact.email,
      recipientName,
      senderEmail: 'admin@zendwise.com',
      senderName: tenant.name,
      subject,
      emailType: 'invitation',
      provider: 'resend',
      providerMessageId: null,
      status: 'pending',
      contactId: contact.id,
      sentAt: null,
    });

    // Trigger the birthday request email via Trigger.dev
    const { triggerRequestBdayEmail } = await import('../lib/trigger');

    const result = await triggerRequestBdayEmail({
      tenantId: req.user.tenantId,
      contactId: contact.id,
      emailTrackingId,
      contactEmail: contact.email,
      contactFirstName: contact.firstName,
      contactLastName: contact.lastName,
      tenantName: tenant.name,
      profileUpdateUrl,
      fromEmail: 'admin@zendwise.com',
    });

    if (result.success) {
      try {
        await db.insert(emailActivity).values({
          contactId: contact.id,
          tenantId: req.user.tenantId,
          activityType: 'sent',
          activityData: JSON.stringify({
            type: 'birthday_invitation',
            runId: result.runId,
            source: 'manual_birthday_invitation',
          }),
          occurredAt: new Date(),
        });
      } catch (logError) {
        console.error('⚠️ [Birthday Invitation] Failed to log email activity:', logError);
      }

      res.json({
        message: 'Birthday invitation queued successfully',
        runId: result.runId,
        taskLogId: result.taskLogId,
      });
    } else {
      throw new Error(result.error || 'Failed to queue birthday invitation email');
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
        from: fromEmail || 'admin@zendwise.com',
        metadata: {
          type: 'birthday_invitation',
          contactId: contactId,
          source: 'server-node-workflow'
        }
      }
    );

    if (typeof result === 'object' && 'success' in result && result.success) {
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

// Internal endpoint for Trigger.dev to log email activity
// Secured with HMAC signature verification
emailManagementRoutes.post("/internal/email-activity", authenticateInternalService, async (req: InternalServiceRequest, res) => {
  console.log('📧 [Internal Email Activity] Received authenticated request:', {
    service: req.internalService?.service,
    tenantId: req.body.tenantId,
    contactId: req.body.contactId,
    activityType: req.body.activityType,
    activityData: '[REDACTED - PII]',
    occurredAt: req.body.occurredAt
  });

  try {
    const {
      tenantId,
      contactId,
      activityType,
      activityData,
      occurredAt,
      webhookId
    } = req.body;

    // Validate required fields
    if (!tenantId || !contactId || !activityType) {
      return res.status(400).json({
        error: 'tenantId, contactId, and activityType are required'
      });
    }

    // Validate webhookId for idempotency
    if (!webhookId) {
      return res.status(400).json({
        error: 'webhookId is required for idempotency'
      });
    }

    // Validate activityType
    if (!allowedActivityTypes.includes(activityType)) {
      return res.status(400).json({
        error: `Invalid activityType. Must be one of: ${allowedActivityTypes.join(', ')}`
      });
    }

    // Verify contact exists
    const existingContact = await db
      .select({ id: emailContacts.id })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.id, contactId),
        eq(emailContacts.tenantId, tenantId)
      ))
      .limit(1);

    if (existingContact.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Validate occurredAt if provided
    let validatedOccurredAt = new Date();
    if (occurredAt) {
      const parsed = new Date(occurredAt);
      if (isFinite(parsed.getTime())) {
        validatedOccurredAt = parsed;
      } else {
        return res.status(400).json({
          error: 'Invalid occurredAt format. Must be a valid date.'
        });
      }
    }

    const txResult = await db.transaction(async (tx: any) => {
      const insertedActivities = await tx
        .insert(emailActivity)
        .values({
          tenantId,
          contactId,
          activityType,
          activityData: activityData ? JSON.stringify(activityData) : null,
          webhookId,
          occurredAt: validatedOccurredAt,
        })
        .onConflictDoNothing({
          target: [emailActivity.webhookId, emailActivity.tenantId],
        })
        .returning();

      if (insertedActivities.length > 0) {
        const activity = insertedActivities[0];

        // Update contact's lastActivity timestamp only when we actually inserted a new activity
        await tx
          .update(emailContacts)
          .set({
            lastActivity: new Date(),
            updatedAt: new Date(),
            // Increment emailsSent counter if this is a 'sent' activity
            ...(activityType === 'sent'
              ? { emailsSent: sql`coalesce(${emailContacts.emailsSent}, 0) + 1` }
              : {}),
          })
          .where(
            and(eq(emailContacts.id, contactId), eq(emailContacts.tenantId, tenantId))
          );

        return { inserted: true as const, activity };
      }

      // Conflict path: webhookId already exists
      const existingActivities = await tx
        .select()
        .from(emailActivity)
        .where(and(eq(emailActivity.webhookId, webhookId), eq(emailActivity.tenantId, tenantId)))
        .limit(1);

      if (existingActivities.length === 0) {
        throw new Error('Email activity conflict detected but existing row could not be found');
      }

      const activity = existingActivities[0];

      if (activity.contactId !== contactId) {
        return { inserted: false as const, contactMismatch: true as const, activity };
      }

      return { inserted: false as const, activity };
    });

    if ('contactMismatch' in txResult && txResult.contactMismatch) {
      console.warn(
        `📧 [Internal Email Activity] webhookId ${webhookId} already used for different contact (existing ${txResult.activity.contactId}, incoming ${contactId})`
      );
      return res.status(409).json({
        error: 'webhookId already used for a different contactId',
        webhookId,
      });
    }

    if (!txResult.inserted) {
      console.log(
        `📧 [Internal Email Activity] Found existing activity ${txResult.activity.id} for webhookId ${webhookId}`
      );
      return res.json({
        activity: txResult.activity,
        message: 'Email activity already exists (idempotent request)',
      });
    }

    console.log(
      `📧 [Internal Email Activity] Created activity ${txResult.activity.id} for contact ${contactId}`
    );

    res.json({
      activity: txResult.activity,
      message: 'Email activity logged successfully',
    });
  } catch (error) {
    console.error('Failed to log email activity (internal):', error);
    res.status(500).json({ error: 'Failed to log email activity' });
  }
});

// Internal endpoint for Trigger.dev to send promotional emails
// Secured with HMAC signature verification
emailManagementRoutes.post("/internal/send-promotional-email", authenticateInternalService, async (req: InternalServiceRequest, res) => {
  console.log('🎁 [Internal Promotional Email] Received authenticated request:', {
    service: req.internalService?.service,
    tenantId: req.body.tenantId,
    contactId: req.body.contactId,
    recipientEmail: req.body.recipientEmail,
  });

  try {
    const {
      tenantId,
      contactId,
      recipientEmail,
      recipientName,
      senderName,
      promoSubject,
      htmlPromo,
      unsubscribeToken,
      promotionId,
      manual,
    } = req.body;

    // Validate required fields
    if (!tenantId || !contactId || !recipientEmail || !recipientName || !senderName || !promoSubject || !htmlPromo) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, contactId, recipientEmail, recipientName, senderName, promoSubject, htmlPromo'
      });
    }

    // Call the existing sendPromotionalEmailJob function
    await sendPromotionalEmailJob({
      tenantId,
      contactId,
      recipientEmail,
      recipientName,
      senderName,
      promoSubject,
      htmlPromo,
      unsubscribeToken,
      promotionId,
      manual,
    });

    console.log(`✅ [Internal Promotional Email] Successfully sent promotional email for contact ${contactId}`);

    res.json({
      success: true,
      message: 'Promotional email sent successfully',
      contactId,
      recipientEmail,
    });
  } catch (error) {
    console.error('Failed to send promotional email (internal):', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send promotional email',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
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
emailManagementRoutes.post("/email-contacts/send-birthday-card", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactIds } = req.body;
    const tenantId = req.user.tenantId;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required',
      });
    }

    // Check email sending limits
    await storage.validateEmailSending(tenantId, contactIds.length);

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

    // Fetch company information for branding
    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.tenantId, tenantId),
        eq(companies.isActive, true)
      ),
    });

    const companyName = company?.name || settings.senderName || 'Your Company';
    const resolvedSenderName = settings.senderName || companyName || 'Your Team';

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
    const skippedOptOut: string[] = [];
    for (const contact of contacts) {
      try {
        // Check if contact has opted out of Customer Engagement emails
        if (contact.prefCustomerEngagement === false) {
          const contactName = contact.firstName || contact.lastName
            ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
            : contact.email;
          console.log(`🚫 [ManualBirthdayCard] Skipping ${contact.email} - opted out of Customer Engagement`);
          skippedOptOut.push(contactName);
          results.push({ contactId: contact.id, email: contact.email, success: false, error: 'Opted out of Customer Engagement' });
          continue;
        }

        // Prepare recipient name (needed for both split and combined flows)
        const recipientName = contact.firstName || contact.lastName
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
          : contact.email.split('@')[0];

        // Generate or reuse unsubscribe token (needed for both split and combined flows)
        let unsubscribeToken: string | undefined;
        try {
          let existingToken = await db.query.unsubscribeTokens.findFirst({
            where: and(
              eq(unsubscribeTokens.tenantId, tenantId),
              eq(unsubscribeTokens.contactId, contact.id),
              sql`${unsubscribeTokens.usedAt} IS NULL`
            ),
          });

          if (!existingToken) {
            const token = crypto.randomBytes(24).toString('base64url');
            const created = await db.insert(unsubscribeTokens).values({
              tenantId,
              contactId: contact.id,
              token,
            }).returning();
            existingToken = created[0];
          }

          unsubscribeToken = existingToken?.token;
          console.log(`🔗 [ManualBirthdayCard] Generated unsubscribe token for ${contact.email}`);
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
            brandName: companyName,
            customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
            senderName: resolvedSenderName,
            // NO promotion fields - these are intentionally omitted
            unsubscribeToken,
          });

          // Build unsubscribe URL for List-Unsubscribe header
          const bdayUnsubUrl = unsubscribeToken
            ? `${process.env.APP_URL || 'http://localhost:5002'}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&type=customer_engagement`
            : undefined;

          const birthdayResult = await enhancedEmailService.sendCustomEmail(
            contact.email,
            `🎉 Happy Birthday ${recipientName}!`,
            htmlBirthday,
            {
              text: htmlBirthday.replace(/<[^>]*>/g, ''),
              from: 'admin@zendwise.com',
              headers: bdayUnsubUrl ? {
                'List-Unsubscribe': `<${bdayUnsubUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              } : undefined,
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
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, split: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
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
              senderEmail: 'admin@zendwise.com',
              senderName: resolvedSenderName,
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
          // Send promotional email separately (queued)
          // Sanitize promotion fields to prevent XSS/HTML injection
          const safePromoTitle = sanitizeEmailHtml(settings.promotion.title || 'Special Birthday Offer!');
          const safePromoDescription = settings.promotion.description ? sanitizeEmailHtml(settings.promotion.description) : '';
          const safePromoContent = sanitizeEmailHtml(settings.promotion.content || '');

          const promoSubject = sanitizeEmailHtml(settings.promotion.title || 'Special Birthday Offer!');
          const htmlPromo = `
            <html>
              <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 600px; margin: 20px auto; padding: 32px 24px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px;">
                  <h2 style="font-size: 1.5rem; font-weight: bold; margin: 0 0 16px 0; color: #2d3748;">${safePromoTitle}</h2>
                  ${safePromoDescription ? `<p style="margin: 0 0 20px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${safePromoDescription}</p>` : ''}
                  <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${safePromoContent}</div>
                  <hr style="margin: 32px 0 16px 0; border: none; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-size: 0.85rem; color: #a0aec0; text-align: center;">
                    This is a special birthday promotion for valued subscribers.
                  </p>
                </div>
              </body>
            </html>
          `;

          console.log(`⏳ [SPLIT FLOW] Queuing promotional email job (20s delay) for ${contact.email}`);
          const queueResult = await enqueuePromotionalEmailJob(
            {
              tenantId,
              contactId: contact.id,
              recipientEmail: contact.email,
              recipientName,
              senderName: resolvedSenderName,
              promoSubject,
              htmlPromo,
              unsubscribeToken,
              promotionId: settings.promotion?.id || null,
              manual: true,
            },
            20000
          );

          if (queueResult.success) {
            console.log(`✅ [SPLIT FLOW] Promotional email queued successfully (runId: ${queueResult.runId})`);
          } else {
            console.warn(`⚠️ [SPLIT FLOW] Promotional email queue failed: ${queueResult.error}`);
          }

          // Record both emails as success
          if (typeof birthdayResult === 'string' || (birthdayResult && birthdayResult.success)) {
            results.push({
              contactId: contact.id,
              email: contact.email,
              success: true,
              messageId: typeof birthdayResult === 'string' ? birthdayResult : birthdayResult.messageId,
              note: 'Split email: Birthday sent, promotion queued',
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
          brandName: companyName,
          customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
          senderName: resolvedSenderName,
          promotionContent: settings.promotion?.content,
          promotionTitle: settings.promotion?.title,
          promotionDescription: settings.promotion?.description,
          unsubscribeToken,
        });

        // Build unsubscribe URL for List-Unsubscribe header
        const combinedUnsubUrl = unsubscribeToken
          ? `${process.env.APP_URL || 'http://localhost:5002'}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&type=customer_engagement`
          : undefined;

        // Send the birthday email
        const result = await enhancedEmailService.sendCustomEmail(
          contact.email,
          `🎉 Happy Birthday ${recipientName}!`,
          htmlContent,
          {
            text: htmlContent.replace(/<[^>]*>/g, ''),
            from: 'admin@zendwise.com',
            headers: combinedUnsubUrl ? {
              'List-Unsubscribe': `<${combinedUnsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            } : undefined,
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
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, queued: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
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
              senderEmail: 'admin@zendwise.com',
              senderName: resolvedSenderName,
              subject: `🎉 Happy Birthday ${recipientName}!`,
              emailType: 'birthday_card',
              provider: 'resend',
              providerMessageId: typeof result === 'string' ? result : (result as any).messageId,
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
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
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
              senderEmail: 'admin@zendwise.com',
              senderName: resolvedSenderName,
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
    const optOutCount = skippedOptOut.length;

    let message = `Birthday cards sent: ${successCount} successful, ${failureCount} failed`;
    if (optOutCount > 0) {
      message += `. ${optOutCount} contact(s) skipped (opted out of Customer Engagement): ${skippedOptOut.join(', ')}`;
    }

    res.json({
      success: true,
      message,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        optedOut: optOutCount,
        optedOutContacts: skippedOptOut,
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

// Helper function to render birthday template (also exported for test endpoint)
export function renderBirthdayTemplate(
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
      // Sanitize promotion fields to prevent XSS/HTML injection
      const safePromoTitle = params.promotionTitle ? sanitizeEmailHtml(processPlaceholders(params.promotionTitle, params)) : '';
      const safePromoDesc = params.promotionDescription ? sanitizeEmailHtml(processPlaceholders(params.promotionDescription, params)) : '';
      const safePromoContent = sanitizeEmailHtml(processPlaceholders(params.promotionContent, params));

      promotionSection = `
        <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px; border-left: 4px solid #667eea;">
          ${safePromoTitle ? `<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">${safePromoTitle}</h3>` : ''}
          ${safePromoDesc ? `<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${safePromoDesc}</p>` : ''}
          <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${safePromoContent}</div>
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

    // Build unsubscribe section only if token exists AND email contains promotional content
    let unsubscribeSection = '';
    if (params.unsubscribeToken && params.promotionContent) {
      const baseUrl = process.env.APP_URL || 'http://localhost:5002';
      const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(params.unsubscribeToken)}&type=customer_engagement`;
      unsubscribeSection = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 0.8rem; color: #a0aec0; line-height: 1.4;">
            Don't want to receive these emails? 
            <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Manage preferences</a>
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
    // Sanitize promotion fields to prevent XSS/HTML injection
    const safePromoTitle = params.promotionTitle ? sanitizeEmailHtml(processPlaceholders(params.promotionTitle, params)) : '';
    const safePromoDesc = params.promotionDescription ? sanitizeEmailHtml(processPlaceholders(params.promotionDescription, params)) : '';
    const safePromoContent = sanitizeEmailHtml(processPlaceholders(params.promotionContent, params));

    promotionSection = `
      <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px; border-left: 4px solid ${colors.primary};">
        ${safePromoTitle ? `<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">${safePromoTitle}</h3>` : ''}
        ${safePromoDesc ? `<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${safePromoDesc}</p>` : ''}
        <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${safePromoContent}</div>
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

  // Build unsubscribe section only if token exists AND email contains promotional content
  let unsubscribeSection = '';
  if (params.unsubscribeToken && params.promotionContent) {
    const baseUrl = process.env.APP_URL || 'http://localhost:5002';
    const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(params.unsubscribeToken)}&type=customer_engagement`;
    unsubscribeSection = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 0.8rem; color: #a0aec0; line-height: 1.4;">
          Don't want to receive these emails? 
          <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Manage preferences</a>
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

// Send individual email to a contact (supports both JSON and multipart/form-data with attachments)
emailManagementRoutes.post("/email-contacts/:id/send-email", authenticateToken, requireTenant, requirePermission('contacts.edit'), (req: any, res: any, next: any) => {
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

    // Get master email design settings
    const emailDesign = await db.query.masterEmailDesign.findFirst({
      where: sql`${masterEmailDesign.tenantId} = ${tenantId}`,
    });
    console.log('📧 [SendEmail] Master email design found:', emailDesign ? 'yes' : 'no (using defaults)', emailDesign ? { id: emailDesign.id, logoUrl: emailDesign.logoUrl, headerText: emailDesign.headerText, primaryColor: emailDesign.primaryColor } : {});

    // Design settings with defaults
    const design = {
      primaryColor: emailDesign?.primaryColor || '#3B82F6',
      secondaryColor: emailDesign?.secondaryColor || '#1E40AF',
      accentColor: emailDesign?.accentColor || '#10B981',
      fontFamily: sanitizeFontFamily(emailDesign?.fontFamily),
      logoUrl: emailDesign?.logoUrl || company?.logoUrl || null,
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
        console.error('[SendEmail] Failed to parse socialLinks:', e);
      }
    }

    // Build social links HTML if available
    let socialLinksHtml = '';
    if (design.socialLinks) {
      const links = [];
      // Use gray color for social links to match management preview style
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
    const resolvedContent = replaceEmailPlaceholders(content, contact, companyName);
    const resolvedSubject = replaceEmailPlaceholders(subject, contact, companyName);

    // Format content as HTML using master email design
    const htmlContent = `
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
                <img src="${design.logoUrl}" alt="${design.displayCompanyName}" style="height: 48px; width: auto; margin-bottom: 20px; object-fit: contain;" />
              ` : `
                <div style="height: 48px; width: 48px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px auto; line-height: 48px; font-size: 20px; font-weight: bold; color: #ffffff; text-align: center;">
                  ${(design.displayCompanyName || 'C').charAt(0)}
                </div>
              `}
              <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; letter-spacing: -0.025em; color: #ffffff;">
                ${design.displayCompanyName}
              </h1>
              ${design.headerText ? `
                <p style="margin: 0 auto; font-size: 16px; opacity: 0.95; max-width: 400px; line-height: 1.5; color: #ffffff;">
                  ${design.headerText}
                </p>
              ` : ''}
            </div>

            <!-- Body Content -->
            <div style="padding: 64px 48px; min-height: 200px;">
              <div style="font-size: 16px; line-height: 1.625; color: #334155;">
                ${sanitizeEmailHtml(resolvedContent.replace(/\n/g, '<br>'))}
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b;">
              
              ${socialLinksHtml}
              
              ${design.footerText ? `
                <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.5; color: #64748b;">${design.footerText}</p>
              ` : ''}
              
              <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">
                <p style="margin: 0;">
                  Sent via ${design.displayCompanyName}
                </p>
              </div>
            </div>
            
          </div>
        </body>
      </html>
    `;

    // Send email via Trigger.dev queue
    // Generate a unique ID to track this email send - will be stored in email_sends and passed to Trigger task
    const emailTrackingId = crypto.randomUUID();
    let emailActivityId: string | null = null;

    let result: { success: boolean; runId?: string; error?: string };
    try {
      const { sendEmailTask } = await import('../../src/trigger/email');
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
            from: design.displayCompanyName || 'Manager',
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
        senderName: design.displayCompanyName || 'Manager',
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

// Email Template Management Routes

// Get email templates
emailManagementRoutes.get("/email-templates", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // For now, return mock data. In production, this would query a database table
    const mockTemplates = [
      {
        id: "1",
        name: "Summer Sale Template",
        category: "promotional",
        subject: "🌞 Summer Sale - Up to 50% Off!",
        preview: "Get ready for summer with our biggest sale of the year.",
        htmlContent: "<html><body>Sample HTML</body></html>",
        primaryColor: "#EC4899",
        secondaryColor: "#BE185D",
        usageCount: 15,
        lastUsed: "2025-07-25",
        createdAt: "2025-06-10",
        isFavorite: true,
        tenantId: req.user.tenantId,
      },
      {
        id: "2",
        name: "Welcome Email Series",
        category: "welcome",
        subject: "Welcome to {{company_name}}! 🎉",
        preview: "Hi {{first_name}}, Welcome aboard! We're thrilled to have you.",
        htmlContent: "<html><body>Sample HTML</body></html>",
        primaryColor: "#3B82F6",
        secondaryColor: "#1E40AF",
        usageCount: 243,
        lastUsed: "2025-07-29",
        createdAt: "2025-03-15",
        isFavorite: true,
        tenantId: req.user.tenantId,
      },
    ];

    res.json({ templates: mockTemplates });
  } catch (error: any) {
    console.error('[EmailManagementRoutes] Get email templates error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get email templates"
    });
  }
});

// Create email template
emailManagementRoutes.post("/email-templates", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { name, category, subject, preview, htmlContent, primaryColor, secondaryColor } = req.body;

    if (!name || !category || !subject) {
      return res.status(400).json({
        success: false,
        message: "Name, category, and subject are required"
      });
    }

    // In production, this would insert into a database table
    const newTemplate = {
      id: crypto.randomBytes(16).toString('hex'),
      name: sanitizeString(name),
      category,
      subject: sanitizeString(subject),
      preview: preview ? sanitizeString(preview) : "",
      htmlContent: htmlContent || "",
      primaryColor: primaryColor || "#3B82F6",
      secondaryColor: secondaryColor || "#1E40AF",
      usageCount: 0,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      tenantId: req.user.tenantId,
    };

    res.json({
      success: true,
      template: newTemplate
    });
  } catch (error: any) {
    console.error('[EmailManagementRoutes] Create email template error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create email template"
    });
  }
});

// Update email template
emailManagementRoutes.put("/email-templates/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, category, subject, preview, htmlContent, primaryColor, secondaryColor, isFavorite } = req.body;

    if (!name || !category || !subject) {
      return res.status(400).json({
        success: false,
        message: "Name, category, and subject are required"
      });
    }

    // In production, this would update the database table
    const updatedTemplate = {
      id,
      name: sanitizeString(name),
      category,
      subject: sanitizeString(subject),
      preview: preview ? sanitizeString(preview) : "",
      htmlContent: htmlContent || "",
      primaryColor: primaryColor || "#3B82F6",
      secondaryColor: secondaryColor || "#1E40AF",
      isFavorite: isFavorite || false,
      updatedAt: new Date().toISOString(),
      tenantId: req.user.tenantId,
    };

    res.json({
      success: true,
      template: updatedTemplate
    });
  } catch (error: any) {
    console.error('[EmailManagementRoutes] Update email template error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update email template"
    });
  }
});

// Delete email template
emailManagementRoutes.delete("/email-templates/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    // In production, this would delete from the database table
    res.json({
      success: true,
      message: "Email template deleted successfully"
    });
  } catch (error: any) {
    console.error('[EmailManagementRoutes] Delete email template error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete email template"
    });
  }
});

// Toggle favorite status
emailManagementRoutes.patch("/email-templates/:id/favorite", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { isFavorite } = req.body;

    // In production, this would update the database table
    res.json({
      success: true,
      isFavorite
    });
  } catch (error: any) {
    console.error('[EmailManagementRoutes] Toggle favorite error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to toggle favorite status"
    });
  }
});
