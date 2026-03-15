import { Router } from 'express';
import { db } from '../db';
import { sql, eq, ne, and, like, desc, inArray } from 'drizzle-orm';
import { authenticateToken, requireTenant, requireRole, requirePermission } from '../middleware/auth-middleware';
import { createRateLimiter } from '../middleware/security';
import { authenticateInternalService } from '../middleware/internal-service-auth';
import { createNewsletterSchema, updateNewsletterSchema, insertNewsletterSchema, newsletters, newsletterTaskStatus, newsletterReviewerSettings, betterAuthUser, emailContacts, contactTagAssignments, bouncedEmails, unsubscribeTokens } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';
import { sanitizeEmailHtml } from './email';
import { emailService, enhancedEmailService } from '../emailService';
import { wrapNewsletterContent, extractPuckColorOverrides } from '../utils/newsletterEmailWrapper';
import { initNewsletterTracking, trackNewsletterEmailSend, getNewsletterStats, getNewsletterSends, getNewsletterEvents } from '../utils/convexNewsletterTracker';
import { logActivity, computeChanges, NEWSLETTER_TRACKED_FIELDS } from '../utils/activityLogger';
import { buildReactionButtonsHtml } from '../utils/newsletterReactionHtml';
// Temporal service removed - now using server-node proxy
import crypto from 'crypto';

export const newsletterRoutes = Router();

// Rate limiter for newsletter list endpoint (refresh button)
const newsletterListRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
});

/**
 * Replace {{variable}} placeholders in newsletter HTML with contact field values.
 */
function substituteNewsletterVariables(html: string, contact: { email: string; firstName?: string; lastName?: string; phoneNumber?: string; address?: string }): string {
  return html
    .replace(/\{\{first_name\}\}/g, contact.firstName || '')
    .replace(/\{\{last_name\}\}/g, contact.lastName || '')
    .replace(/\{\{email\}\}/g, contact.email || '')
    .replace(/\{\{phone\}\}/g, contact.phoneNumber || '')
    .replace(/\{\{address\}\}/g, contact.address || '')
    .replace(/\{\{office_hours\}\}/g, '');
}

/**
 * Generate a URL-friendly slug from a newsletter title.
 * Ensures uniqueness within a tenant by appending a numeric suffix if needed.
 */
async function generateWebSlug(title: string, tenantId: string, excludeId?: string): Promise<string> {
  let base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  if (!base) base = 'newsletter';

  let slug = base;
  let attempt = 0;
  while (attempt < 20) {
    const existing = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.tenantId, tenantId),
        eq(newsletters.webSlug, slug),
        excludeId ? sql`${newsletters.id} != ${excludeId}` : undefined,
      ),
      columns: { id: true },
    });
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
  // Fallback: append random suffix
  return `${base}-${Date.now().toString(36)}`;
}

// Rate limiting for approval code attempts
const MAX_APPROVAL_CODE_ATTEMPTS = 5;
const approvalCodeRateLimit = new Map<string, { count: number; resetAt: number; nextAllowedAt: number }>();

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(approvalCodeRateLimit.entries());
  for (const [key, data] of entries) {
    if (data.resetAt < now) {
      approvalCodeRateLimit.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check rate limiting for approval code attempts
 * Key format: "userId:newsletterId"
 */
function checkApprovalCodeRateLimit(userId: string, newsletterId: string): { allowed: boolean; retryAfter?: number; nextAllowedAt?: Date; exhausted?: boolean } {
  const key = `${userId}:${newsletterId}`;
  const now = Date.now();
  const rateLimitData = approvalCodeRateLimit.get(key);

  if (rateLimitData) {
    // Check if max attempts exceeded — code must be invalidated
    if (rateLimitData.count >= MAX_APPROVAL_CODE_ATTEMPTS) {
      return { allowed: false, exhausted: true };
    }

    // Check if we're still in cooldown period
    if (now < rateLimitData.nextAllowedAt) {
      const retryAfterMinutes = Math.ceil((rateLimitData.nextAllowedAt - now) / 60000);
      return {
        allowed: false,
        retryAfter: retryAfterMinutes,
        nextAllowedAt: new Date(rateLimitData.nextAllowedAt)
      };
    }

    // Reset counter if past reset time
    if (now >= rateLimitData.resetAt) {
      approvalCodeRateLimit.delete(key);
    }
  }

  return { allowed: true };
}

/**
 * Record a failed approval code attempt
 */
function recordFailedApprovalCodeAttempt(userId: string, newsletterId: string): void {
  const key = `${userId}:${newsletterId}`;
  const now = Date.now();
  const currentData = approvalCodeRateLimit.get(key);

  approvalCodeRateLimit.set(key, {
    count: (currentData?.count || 0) + 1,
    // Only set resetAt on first attempt so the window doesn't keep sliding forward
    resetAt: currentData?.resetAt ?? now + (15 * 60 * 1000),
    nextAllowedAt: now + (2 * 60 * 1000), // 2 minutes cooldown after failed attempt
  });
}

/**
 * Clear rate limit after successful approval
 */
function clearApprovalCodeRateLimit(userId: string, newsletterId: string): void {
  const key = `${userId}:${newsletterId}`;
  approvalCodeRateLimit.delete(key);
}

/**
 * Fetch tenant-scoped complaint suppressions + global bounce suppressions.
 * Returns a Map of lowercased email -> bounceType.
 *
 * Semantics:
 *  - Complaints (bounceType='complaint') are tenant-scoped: only rows where
 *    sourceTenantId matches the current tenant are included.
 *  - Hard/soft bounces remain global (no tenant filter).
 */
async function getSuppressionMap(tenantId: string): Promise<Map<string, string>> {
  // Global bounces (hard/soft) — no tenant filter
  const globalBounces = await db.select({ email: bouncedEmails.email, type: bouncedEmails.bounceType })
    .from(bouncedEmails)
    .where(and(
      eq(bouncedEmails.isActive, true as any),
      sql`${bouncedEmails.bounceType} != 'complaint'`
    ));

  // Tenant-scoped complaints
  const tenantComplaints = await db.select({ email: bouncedEmails.email, type: bouncedEmails.bounceType })
    .from(bouncedEmails)
    .where(and(
      eq(bouncedEmails.isActive, true as any),
      sql`${bouncedEmails.bounceType} = 'complaint'`,
      sql`${bouncedEmails.sourceTenantId} = ${tenantId}`
    ));

  const map = new Map<string, string>();
  for (const r of globalBounces) {
    map.set(String(r.email).toLowerCase().trim(), r.type);
  }
  for (const r of tenantComplaints) {
    map.set(String(r.email).toLowerCase().trim(), r.type);
  }
  return map;
}

// Helper: Base function to get newsletter recipients
async function getNewsletterRecipientsBase(newsletter: any, tenantId: string, options: { filterActiveOnly: boolean }) {
  const { filterActiveOnly } = options;
  console.log(`[Newsletter] Getting recipients for newsletter ${newsletter.id}, type: ${newsletter.recipientType}, activeOnly: ${filterActiveOnly}`);

  try {
    let recipients: Array<any> = [];
    // Dynamically build columns selection
    const columns = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      address: true,
      ...(filterActiveOnly ? { prefNewsletters: true } : { status: true }),
    };

    switch (newsletter.recipientType) {
      case 'all':
        recipients = await db.query.emailContacts.findMany({
          where: and(
            eq(emailContacts.tenantId, tenantId),
            filterActiveOnly ? eq(emailContacts.status, 'active') : undefined
          ),
          columns,
        });
        break;

      case 'selected':
        if (newsletter.selectedContactIds && newsletter.selectedContactIds.length > 0) {
          recipients = await db.query.emailContacts.findMany({
            where: and(
              eq(emailContacts.tenantId, tenantId),
              inArray(emailContacts.id, newsletter.selectedContactIds),
              filterActiveOnly ? eq(emailContacts.status, 'active') : undefined
            ),
            columns,
          });
        }
        break;

      case 'tags':
        if (newsletter.selectedTagIds && newsletter.selectedTagIds.length > 0) {
          const contactIds = await db
            .select({ contactId: contactTagAssignments.contactId })
            .from(contactTagAssignments)
            .where(inArray(contactTagAssignments.tagId, newsletter.selectedTagIds));

          if (contactIds.length > 0) {
            recipients = await db.query.emailContacts.findMany({
              where: and(
                eq(emailContacts.tenantId, tenantId),
                inArray(emailContacts.id, contactIds.map((c: any) => c.contactId)),
                filterActiveOnly ? eq(emailContacts.status, 'active') : undefined
              ),
              columns,
            });
          }
        }
        break;

      default:
        console.warn(`[Newsletter] Unknown recipient type: ${newsletter.recipientType}`);
        break;
    }

    console.log(`[Newsletter] Found ${recipients.length} recipients for newsletter ${newsletter.id} (activeOnly: ${filterActiveOnly})`);
    return recipients;
  } catch (error) {
    console.error(`[Newsletter] Error getting recipients for newsletter ${newsletter.id}:`, error);
    throw error;
  }
}

// Helper function to get newsletter recipients based on segmentation (Active only)
async function getNewsletterRecipients(newsletter: any, tenantId: string) {
  return getNewsletterRecipientsBase(newsletter, tenantId, { filterActiveOnly: true });
}

// Helper: get ALL original recipients regardless of status (for viewing in stats modal)
async function getAllNewsletterRecipients(newsletter: any, tenantId: string) {
  return getNewsletterRecipientsBase(newsletter, tenantId, { filterActiveOnly: false });
}

// Helper: get contacts that WOULD be recipients but are excluded due to non-active status
// (suppressed, bounced, unsubscribed). Used for Convex dashboard reporting.
async function getSuppressedNewsletterContacts(newsletter: any, tenantId: string) {
  try {
    let contacts: Array<{ id: string; email: string; status: string }> = [];

    switch (newsletter.recipientType) {
      case 'all':
        contacts = await db.query.emailContacts.findMany({
          where: and(
            eq(emailContacts.tenantId, tenantId),
            ne(emailContacts.status, 'active')
          ),
          columns: { id: true, email: true, status: true },
        });
        break;

      case 'selected':
        if (newsletter.selectedContactIds && newsletter.selectedContactIds.length > 0) {
          contacts = await db.query.emailContacts.findMany({
            where: and(
              eq(emailContacts.tenantId, tenantId),
              inArray(emailContacts.id, newsletter.selectedContactIds),
              ne(emailContacts.status, 'active')
            ),
            columns: { id: true, email: true, status: true },
          });
        }
        break;

      case 'tags':
        if (newsletter.selectedTagIds && newsletter.selectedTagIds.length > 0) {
          const contactIds = await db
            .select({ contactId: contactTagAssignments.contactId })
            .from(contactTagAssignments)
            .where(inArray(contactTagAssignments.tagId, newsletter.selectedTagIds));

          if (contactIds.length > 0) {
            contacts = await db.query.emailContacts.findMany({
              where: and(
                eq(emailContacts.tenantId, tenantId),
                inArray(emailContacts.id, contactIds.map((c: any) => c.contactId)),
                ne(emailContacts.status, 'active')
              ),
              columns: { id: true, email: true, status: true },
            });
          }
        }
        break;
    }

    return contacts;
  } catch (error) {
    console.error('[Newsletter] Error getting suppressed contacts:', error);
    return [];
  }
}

// Get preview recipients (all tenant users: owners, admins, managers, employees)
newsletterRoutes.get("/preview-recipients", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = 1000; // Reasonable limit to prevent large responses
    console.log('[Newsletter Preview] Fetching preview recipients for tenant:', tenantId);

    // Get all tenant users from betterAuthUser (all roles)
    const users = await db
      .select({
        id: betterAuthUser.id,
        email: betterAuthUser.email,
        firstName: betterAuthUser.firstName,
        lastName: betterAuthUser.lastName,
        name: betterAuthUser.name,
        role: betterAuthUser.role,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId))
      .limit(limit + 1); // Fetch one extra to detect if there are more

    const hasMore = users.length > limit;
    const limitedUsers = hasMore ? users.slice(0, limit) : users;

    console.log(`[Newsletter Preview] Found ${limitedUsers.length} users for tenant ${tenantId}${hasMore ? ' (truncated)' : ''}`);

    const recipients = limitedUsers.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      role: u.role || 'Employee',
      type: 'user' as const,
    }));

    res.json({
      recipients,
      total: hasMore ? limit : recipients.length,
      truncated: hasMore
    });
  } catch (error) {
    console.error('Get preview recipients error:', error);
    res.status(500).json({ message: 'Failed to get preview recipients' });
  }
});

// Send preview email via Trigger.dev + Resend (supports up to 5 recipients)
newsletterRoutes.post("/send-preview", authenticateToken, requireTenant, requirePermission('newsletters.send'), async (req: any, res) => {
  try {
    const { to, subject, html, puckData } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ message: 'Missing required fields: to, subject, html' });
    }

    // Normalize to always be an array (backward-compatible with single string)
    const MAX_PREVIEW_RECIPIENTS = 5;
    const recipients: string[] = (Array.isArray(to) ? to : [to])
      .map((email: any) => String(email).trim().toLowerCase())
      .filter(Boolean);

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'At least one recipient is required.' });
    }
    if (recipients.length > MAX_PREVIEW_RECIPIENTS) {
      return res.status(400).json({ message: `Maximum ${MAX_PREVIEW_RECIPIENTS} preview recipients allowed.` });
    }

    // Trigger one preview task per recipient
    const { sendNewsletterPreviewTask } = await import('../../src/trigger/newsletterPreview');

    const sanitizedHtml = sanitizeEmailHtml(html);
    const colorOverrides = extractPuckColorOverrides(typeof puckData === 'string' ? puckData : JSON.stringify(puckData));
    const wrappedHtml = await wrapNewsletterContent(req.user.tenantId, sanitizedHtml, colorOverrides);

    const handles = await Promise.all(
      recipients.map((recipientEmail) =>
        sendNewsletterPreviewTask.trigger({
          to: recipientEmail,
          subject,
          html: sanitizedHtml,
          wrappedHtml,
          tenantId: req.user.tenantId,
          requestedBy: req.user.email,
        })
      )
    );

    const runIds = handles.map((h) => h.id);
    console.log(`[Newsletter Preview] Triggered ${recipients.length} send-newsletter-preview task(s) (runs: ${runIds.join(', ')}) to ${recipients.join(', ')}`);

    // Log activity: preview email sent
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityName: subject,
      activityType: 'preview_sent',
      description: `Sent preview email to ${recipients.join(', ')}`,
      metadata: { to: recipients, subject, runIds },
      req,
    });

    res.json({
      message: `Preview email${recipients.length > 1 ? 's' : ''} queued successfully`,
      to: recipients,
      runIds,
    });
  } catch (error) {
    console.error('Send preview email error:', error);
    res.status(500).json({ message: 'Failed to queue preview email' });
  }
});

// Internal endpoint: Get suppression list (called by Trigger.dev tasks)
// Must be defined BEFORE /:id routes to avoid 'internal' matching as :id
newsletterRoutes.get('/internal/suppression-list', authenticateInternalService, async (req: any, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    // Use centralized helper: global bounces + tenant-scoped complaints
    const suppressionMap = await getSuppressionMap(tenantId as string);
    const emails = Array.from(suppressionMap.keys());

    console.log(`[Newsletter Internal] Suppression list for tenant ${tenantId}: ${emails.length} emails (tenant-scoped complaints + global bounces)`);
    res.json({ emails });
  } catch (error) {
    console.error('[Newsletter Internal] Suppression list error:', error);
    res.status(500).json({ error: 'Failed to get suppression list' });
  }
});

// Get all newsletters
newsletterRoutes.get("/", newsletterListRateLimiter, authenticateToken, requireTenant, requirePermission('newsletters.view'), async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, status, emailType, archived } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`;

    // Archive filtering: archived=true returns only archived, default excludes archived
    if (archived === 'true') {
      whereClause = sql`${whereClause} AND ${newsletters.archivedAt} IS NOT NULL`;
    } else {
      whereClause = sql`${whereClause} AND ${newsletters.archivedAt} IS NULL`;
    }

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${newsletters.subject} ILIKE ${`%${sanitizedSearch}%`} OR
        ${newsletters.title} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (status) {
      whereClause = sql`${whereClause} AND ${newsletters.status} = ${status}`;
    }

    // Filter by emailType — default to 'newsletter' when not specified
    const resolvedType = (emailType as string) || 'newsletter';
    whereClause = sql`${whereClause} AND (${newsletters.emailType} = ${resolvedType} OR (${newsletters.emailType} IS NULL AND ${resolvedType} = 'newsletter'))`;

    const allNewsletters = await db.query.newsletters.findMany({
      where: whereClause,
      orderBy: desc(newsletters.createdAt),
      limit: Number(limit),
      offset,
      with: {
        user: true,
        tenant: true,
      }
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(newsletters).where(whereClause);

    res.json({
      newsletters: allNewsletters,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get newsletters error:', error);
    res.status(500).json({ message: 'Failed to get newsletters' });
  }
});

// ─── Newsletter Reviewer Settings Routes ────────────────────────────────────
// IMPORTANT: These must be defined BEFORE /:id to avoid Express matching
// "/reviewer-settings" as a newsletter ID parameter.

// Get tenant reviewer settings
newsletterRoutes.get("/reviewer-settings", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    const settings = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, tenantId),
    });

    if (!settings) {
      // Return defaults if no settings exist yet
      return res.json({
        enabled: false,
        reviewerId: null,
        reviewer: null,
      });
    }

    // Fetch reviewer details if set
    let reviewer = null;
    let reviewerMissing = false;
    if (settings.reviewerId) {
      const reviewerUser = await db.query.betterAuthUser.findFirst({
        where: and(
          eq(betterAuthUser.id, settings.reviewerId),
          eq(betterAuthUser.tenantId, tenantId)
        ),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          role: true,
          avatarUrl: true,
        },
      });
      reviewer = reviewerUser || null;
      if (!reviewer && settings.enabled) {
        reviewerMissing = true;
      }
    }

    res.json({
      enabled: settings.enabled,
      reviewerId: settings.reviewerId,
      reviewer,
      reviewerMissing,
    });
  } catch (error) {
    console.error('Get reviewer settings error:', error);
    res.status(500).json({ message: 'Failed to get reviewer settings' });
  }
});

// Update tenant reviewer settings
newsletterRoutes.put("/reviewer-settings", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { enabled, reviewerId } = req.body;

    // Get existing settings to compute effective reviewerId
    const existing = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, tenantId),
    });

    // Compute effective reviewerId (use incoming if provided, otherwise existing)
    const effectiveReviewerId = reviewerId !== undefined ? (reviewerId || null) : (existing?.reviewerId || null);

    // If enabling, validate reviewer exists, belongs to tenant, and has an eligible role
    if (enabled && effectiveReviewerId) {
      const reviewerUser = await db.query.betterAuthUser.findFirst({
        where: and(
          eq(betterAuthUser.id, effectiveReviewerId),
          eq(betterAuthUser.tenantId, tenantId)
        ),
      });

      if (!reviewerUser) {
        return res.status(400).json({ message: 'Selected reviewer not found in your organization' });
      }

      // Ensure reviewer has an eligible role (Owner, Administrator, or Manager only)
      if (!['Owner', 'Administrator', 'Manager'].includes(reviewerUser.role || '')) {
        return res.status(400).json({ message: 'Reviewer must have Owner, Administrator, or Manager role' });
      }

      // Prevent admins from setting themselves as the reviewer
      if (effectiveReviewerId === req.user.id) {
        return res.status(400).json({ message: 'You cannot set yourself as the designated reviewer' });
      }
    }

    // If enabling without a valid reviewerId, reject the request
    if (enabled && !effectiveReviewerId) {
      return res.status(400).json({ message: 'Cannot enable reviewer settings without selecting a valid reviewer' });
    }

    // Upsert settings
    let result;
    if (existing) {
      const [updated] = await db.update(newsletterReviewerSettings)
        .set({
          enabled: enabled ?? existing.enabled,
          reviewerId: reviewerId !== undefined ? (reviewerId || null) : existing.reviewerId,
          updatedAt: new Date(),
        })
        .where(eq(newsletterReviewerSettings.tenantId, tenantId))
        .returning();
      result = updated;
    } else {
      const [inserted] = await db.insert(newsletterReviewerSettings)
        .values({
          tenantId,
          enabled: enabled ?? false,
          reviewerId: reviewerId || null,
        })
        .returning();
      result = inserted;
    }

    // Fetch reviewer details for response (scoped to tenant to prevent cross-tenant leakage)
    let reviewer = null;
    if (result.reviewerId) {
      const reviewerUser = await db.query.betterAuthUser.findFirst({
        where: and(
          eq(betterAuthUser.id, result.reviewerId),
          eq(betterAuthUser.tenantId, tenantId)
        ),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          role: true,
          avatarUrl: true,
        },
      });
      reviewer = reviewerUser || null;
    }

    // Log activity
    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'newsletter_reviewer_settings',
      entityId: tenantId,
      entityName: 'Newsletter Reviewer Settings',
      activityType: 'updated',
      description: `${enabled ? 'Enabled' : 'Disabled'} newsletter reviewer approval${reviewer ? ` with reviewer ${reviewer.email}` : ''}`,
      metadata: { enabled, reviewerId: result.reviewerId },
      req,
    });

    res.json({
      enabled: result.enabled,
      reviewerId: result.reviewerId,
      reviewer,
    });
  } catch (error) {
    console.error('Update reviewer settings error:', error);
    res.status(500).json({ message: 'Failed to update reviewer settings' });
  }
});

// Get specific newsletter
newsletterRoutes.get("/:id", authenticateToken, requireTenant, requirePermission('newsletters.view'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
      with: {
        user: true,
        reviewer: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    res.json({ newsletter });
  } catch (error) {
    console.error('Get newsletter error:', error);
    res.status(500).json({ message: 'Failed to get newsletter' });
  }
});

newsletterRoutes.get("/:id/recipients", authenticateToken, requireTenant, requirePermission('newsletters.view'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Get ALL recipients regardless of status (so suppressed contacts are shown in the list)
    const recipients = await getAllNewsletterRecipients(newsletter, req.user.tenantId);

    res.json({
      recipients: recipients.map((r: any) => ({
        id: r.id,
        email: r.email,
        firstName: r.firstName || '',
        lastName: r.lastName || '',
        status: r.status || 'active',
      })),
      total: recipients.length,
    });
  } catch (error) {
    console.error('Get newsletter recipients error:', error);
    res.status(500).json({ message: 'Failed to get newsletter recipients' });
  }
});

// Create newsletter
newsletterRoutes.post("/", authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const validatedData = createNewsletterSchema.parse(req.body);
    const { title, subject, content, puckData, scheduledAt, status } = validatedData;

    const sanitizedTitle = sanitizeString(title);
    const sanitizedSubject = sanitizeString(subject);

    // Get the correct user ID from the betterAuthUser table based on email
    // since authentication uses betterAuthUser and newsletters now reference betterAuthUser table
    const userRecord = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.email} = ${req.user.email}`,
    });

    if (!userRecord) {
      console.error('User not found in betterAuthUser table for newsletter creation:', req.user.email);
      return res.status(404).json({ message: 'User account not found. Please contact support.' });
    }

    const emailType = (req.body.emailType === 'advertise') ? 'advertise' : 'newsletter';

    const newNewsletter = await db.insert(newsletters).values({
      tenantId: req.user.tenantId,
      userId: userRecord.id,
      title: sanitizedTitle,
      subject: sanitizedSubject,
      content,
      puckData: puckData || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: status || 'draft',
      emailType,
      recipientType: 'all',
      recipientCount: 0,
      openCount: 0,
      uniqueOpenCount: 0,
      clickCount: 0,
    } as any).returning();

    // Log activity: newsletter created
    await logActivity({
      tenantId: req.user.tenantId,
      userId: userRecord.id,
      entityType: 'newsletter',
      entityId: newNewsletter[0].id,
      entityName: sanitizedTitle,
      activityType: 'created',
      description: `Created newsletter "${sanitizedTitle}"`,
      metadata: { subject: sanitizedSubject, status: status || 'draft' },
      req,
    });

    res.status(201).json(newNewsletter[0]);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('Create newsletter error:', errMsg);
    if (errStack) console.error(errStack);
    res.status(500).json({ message: 'Failed to create newsletter' });
  }
});

newsletterRoutes.post("/:id/clone", authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const source = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!source) {
      return res.status(404).json({ message: "Newsletter not found" });
    }

    const userRecord = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.email} = ${req.user.email}`,
    });

    if (!userRecord) {
      return res.status(404).json({ message: "User account not found." });
    }

    const cloned = await db.insert(newsletters).values({
      tenantId: req.user.tenantId,
      userId: userRecord.id,
      title: `${source.title} (Copy)`,
      subject: source.subject,
      content: source.content || '',
      puckData: source.puckData || null,
      status: 'draft',
      recipientType: 'all',
      recipientCount: 0,
      openCount: 0,
      uniqueOpenCount: 0,
      clickCount: 0,
    } as any).returning();

    // Log activity: newsletter cloned
    await logActivity({
      tenantId: req.user.tenantId,
      userId: userRecord.id,
      entityType: 'newsletter',
      entityId: cloned[0].id,
      entityName: `${source.title} (Copy)`,
      activityType: 'created',
      description: `Cloned newsletter from "${source.title}"`,
      metadata: { sourceNewsletterId: source.id, sourceTitle: source.title },
      req,
    });

    res.status(201).json(cloned[0]);
  } catch (error) {
    console.error("Clone newsletter error:", error);
    res.status(500).json({ message: "Failed to clone newsletter" });
  }
});

// Archive a sent newsletter
newsletterRoutes.post("/:id/archive", authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status !== 'sent') {
      return res.status(400).json({ message: 'Only sent newsletters can be archived' });
    }

    if (newsletter.archivedAt) {
      return res.status(400).json({ message: 'Newsletter is already archived' });
    }

    const [updated] = await db.update(newsletters)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(sql`${newsletters.id} = ${id}`)
      .returning();

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'archived',
      description: `Archived newsletter "${newsletter.title}"`,
      metadata: {},
      req,
    });

    res.json({ message: 'Newsletter archived successfully', newsletter: updated });
  } catch (error) {
    console.error('Archive newsletter error:', error);
    res.status(500).json({ message: 'Failed to archive newsletter' });
  }
});

// Unarchive a newsletter
newsletterRoutes.post("/:id/unarchive", authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (!newsletter.archivedAt) {
      return res.status(400).json({ message: 'Newsletter is not archived' });
    }

    const [updated] = await db.update(newsletters)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(sql`${newsletters.id} = ${id}`)
      .returning();

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'unarchived',
      description: `Unarchived newsletter "${newsletter.title}"`,
      metadata: {},
      req,
    });

    res.json({ message: 'Newsletter unarchived successfully', newsletter: updated });
  } catch (error) {
    console.error('Unarchive newsletter error:', error);
    res.status(500).json({ message: 'Failed to unarchive newsletter' });
  }
});

// Update newsletter
newsletterRoutes.put("/:id", authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateNewsletterSchema.parse(req.body);
    const { title, subject, content, puckData, scheduledAt, status, recipientType, selectedContactIds, selectedTagIds, reactionsEnabled, publishToBlog, publishedAt: _ignoredPublishedAt, webSlug: _ignoredWebSlug, ...rest } = validatedData;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Prevent edits on approved newsletters — they must be sent as-is
    if (newsletter.reviewStatus === 'approved') {
      return res.status(403).json({ message: 'This newsletter has been approved and cannot be edited. Send it as-is or contact the reviewer.' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) {
      updateData.title = sanitizeString(title);
    }

    if (subject !== undefined) {
      updateData.subject = sanitizeString(subject);
    }

    if (content !== undefined) {
      updateData.content = content;
    }

    if (puckData !== undefined) {
      updateData.puckData = puckData;
    }

    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    }

    if (status !== undefined) {
      updateData.status = status;
      // When moving to ready_to_send, clear stale review state so a new review cycle can start
      if (status === 'ready_to_send' && newsletter.reviewStatus) {
        updateData.reviewStatus = 'pending';
        updateData.requiresReviewerApproval = false;
        updateData.reviewedAt = null;
        updateData.reviewNotes = null;
        updateData.reviewerApprovalCode = null;
        updateData.reviewerId = null;
      }
    }

    if (recipientType !== undefined) {
      updateData.recipientType = recipientType;
    }

    if (selectedContactIds !== undefined) {
      updateData.selectedContactIds = selectedContactIds;
    }

    if (selectedTagIds !== undefined) {
      updateData.selectedTagIds = selectedTagIds;
    }

    if (reactionsEnabled !== undefined) {
      updateData.reactionsEnabled = reactionsEnabled;
    }

    if (publishToBlog !== undefined) {
      updateData.publishToBlog = publishToBlog;
      // If toggling off blog publishing on an already-published newsletter, clear the web slug
      if (publishToBlog === false && newsletter.webSlug) {
        updateData.webSlug = null;
        updateData.publishedAt = null;
      }
    }

    const updatedNewsletter = await db.update(newsletters)
      .set(updateData)
      .where(sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`)
      .returning();

    // Log activity: newsletter updated (compute changed fields)
    const changes = computeChanges(newsletter as Record<string, any>, updateData, NEWSLETTER_TRACKED_FIELDS);
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: updatedNewsletter[0]?.title || newsletter.title,
      activityType: 'updated',
      description: `Updated newsletter "${updatedNewsletter[0]?.title || newsletter.title}"`,
      changes: changes || undefined,
      metadata: { fieldsChanged: changes ? Object.keys(changes) : [] },
      req,
    });

    res.json(updatedNewsletter[0]);
  } catch (error) {
    console.error('Update newsletter error:', error);
    res.status(500).json({ message: 'Failed to update newsletter' });
  }
});

// Delete newsletter (soft delete — preserves analytics and task data)
newsletterRoutes.delete("/:id", authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Log activity: newsletter deleted
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'deleted',
      description: `Deleted newsletter "${newsletter.title}"`,
      metadata: {
        subject: newsletter.subject,
        status: newsletter.status,
        recipientCount: newsletter.recipientCount,
        sentAt: newsletter.sentAt,
      },
      req,
    });

    if (newsletter.status === 'draft' || newsletter.status === 'ready_to_send') {
      // Hard delete: drafts have no analytics or send history to preserve
      await db.delete(newsletters)
        .where(sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`);
    } else {
      // Soft delete: preserve the row for analytics and task data
      await db.update(newsletters)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`);
    }

    res.json({ message: 'Newsletter deleted successfully' });
  } catch (error) {
    console.error('Delete newsletter error:', error);
    res.status(500).json({ message: 'Failed to delete newsletter' });
  }
});


// Get detailed newsletter statistics
newsletterRoutes.get("/:id/detailed-stats", authenticateToken, requireTenant, requirePermission('newsletters.view_stats'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Get real stats from Convex
    const convexStats = await getNewsletterStats(id);
    const sends = await getNewsletterSends(id, 200);

    // Calculate rates
    const totalSent = convexStats?.sent ?? newsletter.recipientCount ?? 0;
    const totalDelivered = convexStats?.delivered ?? 0;
    const totalOpened = convexStats?.uniqueOpens ?? newsletter.uniqueOpenCount ?? 0;
    const totalClicked = convexStats?.uniqueClicks ?? newsletter.clickCount ?? 0;
    const totalBounced = convexStats?.bounced ?? 0;
    const totalUnsubscribed = convexStats?.unsubscribed ?? 0;

    const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 1000) / 10 : 0;
    const clickRate = totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 1000) / 10 : 0;
    const bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 1000) / 10 : 0;

    // Build per-email data with events
    const emails = sends.map((send: any) => ({
      id: send._id || send.recipientId || send.recipientEmail,
      recipientEmail: send.recipientEmail,
      recipientId: send.recipientId,
      status: send.status,
      sentAt: send.sentAt ? new Date(send.sentAt).toISOString() : null,
      deliveredAt: send.deliveredAt ? new Date(send.deliveredAt).toISOString() : null,
      openedAt: send.firstOpenedAt ? new Date(send.firstOpenedAt).toISOString() : null,
      clickedAt: send.firstClickedAt ? new Date(send.firstClickedAt).toISOString() : null,
      openCount: send.openCount ?? 0,
      clickCount: send.clickCount ?? 0,
      error: send.error,
    }));

    res.json({
      newsletter,
      totalEmails: sends.length,
      emails,
      stats: {
        newsletterId: id,
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalUnsubscribed,
        totalFailed: convexStats?.failed ?? 0,
        totalSuppressed: convexStats?.suppressed ?? 0,
        openRate,
        clickRate,
        bounceRate,
        createdAt: newsletter.createdAt,
        sentAt: newsletter.sentAt,
      },
    });
  } catch (error) {
    console.error('Get detailed newsletter stats error:', error);
    res.status(500).json({ message: 'Failed to get detailed newsletter statistics' });
  }
});

// Get email trajectory
newsletterRoutes.get("/emails/:resendId/trajectory", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { resendId } = req.params;

    // Fetch real events from Convex using the provider message ID
    const events = await getNewsletterEvents(resendId, 50);

    // If no events found, try to look up by the resendId as a newsletter send ID
    if (events.length === 0) {
      // Return empty trajectory if no data found
      return res.json({
        resendId,
        events: [],
        message: 'No events found for this email',
      });
    }

    // Transform Convex events to trajectory format
    const trajectory = {
      resendId,
      events: events.map((event: any) => ({
        type: event.eventType,
        timestamp: event.occurredAt ? new Date(event.occurredAt).toISOString() : new Date().toISOString(),
        status: 'success',
        metadata: event.metadata,
      })),
    };

    res.json(trajectory);
  } catch (error) {
    console.error('Get email trajectory error:', error);
    res.status(500).json({ message: 'Failed to get email trajectory' });
  }
});

// Get newsletter task status
newsletterRoutes.get("/:id/task-status", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId} AND ${newsletters.deletedAt} IS NULL`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Get actual task statuses from database
    const dbTaskStatuses = await db.query.newsletterTaskStatus.findMany({
      where: and(
        eq(newsletterTaskStatus.newsletterId, id),
        eq(newsletterTaskStatus.tenantId, req.user.tenantId)
      ),
    });

    // If no task statuses exist, derive from newsletter status and Convex stats
    if (dbTaskStatuses.length === 0) {
      const convexStats = await getNewsletterStats(id);
      const taskStatuses = [];

      // Derive status based on newsletter state
      if (newsletter.status === 'sent' || newsletter.status === 'sending') {
        const totalRecipients = convexStats?.totalRecipients ?? newsletter.recipientCount ?? 0;
        const sent = convexStats?.sent ?? 0;
        const failed = convexStats?.failed ?? 0;
        const processed = sent + failed;
        const progress = totalRecipients > 0 ? Math.round((processed / totalRecipients) * 100) : 0;

        taskStatuses.push({
          id: `${id}-sending`,
          newsletterId: id,
          tenantId: req.user.tenantId,
          taskType: 'sending',
          taskName: 'Sending Emails',
          status: newsletter.status === 'sent' ? 'completed' : 'in_progress',
          progress: newsletter.status === 'sent' ? 100 : progress,
          startedAt: newsletter.sentAt,
          completedAt: newsletter.status === 'sent' ? newsletter.sentAt : null,
          metadata: { sent, failed, total: totalRecipients },
        });

        // Analytics task
        taskStatuses.push({
          id: `${id}-analytics`,
          newsletterId: id,
          tenantId: req.user.tenantId,
          taskType: 'analytics',
          taskName: 'Analytics Collection',
          status: newsletter.status === 'sent' ? 'in_progress' : 'pending',
          progress: newsletter.status === 'sent' ? 50 : 0,
          startedAt: newsletter.status === 'sent' ? newsletter.sentAt : null,
          completedAt: null,
        });
      }

      return res.json({ taskStatuses });
    }

    res.json({ taskStatuses: dbTaskStatuses });
  } catch (error) {
    console.error('Get newsletter task status error:', error);
    res.status(500).json({ message: 'Failed to get newsletter task status' });
  }
});

// Update newsletter status (internal service endpoint for temporal server)
newsletterRoutes.put("/:id/status", authenticateInternalService, async (req: any, res) => {
  try {

    const { id } = req.params;
    const { status, metadata } = req.body;

    console.log(`[Newsletter] Updating newsletter ${id} status to: ${status}`);

    // Update newsletter status in database
    const updatedNewsletter = await db.update(newsletters)
      .set({
        status,
        ...(metadata && {
          recipientCount: metadata.recipientCount,
          updatedAt: new Date(),
        }),
        ...(status === 'sent' && metadata?.completedAt && {
          sentAt: new Date(metadata.completedAt)
        })
      })
      .where(eq(newsletters.id, id))
      .returning();

    if (updatedNewsletter.length === 0) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    console.log(`[Newsletter] Successfully updated newsletter ${id} status to: ${status}`);

    // Log activity: internal status update
    await logActivity({
      tenantId: updatedNewsletter[0].tenantId,
      entityType: 'newsletter',
      entityId: id,
      entityName: updatedNewsletter[0].title,
      activityType: 'status_changed',
      description: `Newsletter "${updatedNewsletter[0].title}" status changed to ${status} (internal)`,
      metadata: { status, source: 'internal_service', ...(metadata || {}) },
    });

    res.json({
      message: 'Newsletter status updated successfully',
      newsletter: updatedNewsletter[0]
    });

  } catch (error) {
    console.error('Update newsletter status error:', error);
    res.status(500).json({ message: 'Failed to update newsletter status' });
  }
});

// Log newsletter activity (internal service endpoint for temporal server)
newsletterRoutes.post("/:id/log", authenticateInternalService, async (req: any, res) => {
  try {

    const { id } = req.params;
    const { activity, details, timestamp } = req.body;

    console.log(`[Newsletter Activity] ${id}: ${activity}`, {
      details,
      timestamp,
      source: 'temporal-server'
    });

    // Fetch the newsletter to get tenantId and title
    const newsletter = await db.query.newsletters.findFirst({
      where: eq(newsletters.id, id),
      columns: { tenantId: true, title: true },
    });

    if (newsletter) {
      await logActivity({
        tenantId: newsletter.tenantId,
        entityType: 'newsletter',
        entityId: id,
        entityName: newsletter.title,
        activityType: activity,
        description: `${activity} — ${newsletter.title}`,
        metadata: { details, source: 'temporal-server', timestamp },
      });
    }

    res.json({
      message: 'Newsletter activity logged successfully',
      newsletterId: id,
      activity,
      timestamp
    });

  } catch (error) {
    console.error('Log newsletter activity error:', error);
    res.status(500).json({ message: 'Failed to log newsletter activity' });
  }
});

// Update newsletter task status
newsletterRoutes.post("/:id/task-status", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, progress, totalRecipients, processedRecipients, failedRecipients, error } = req.body;

    const newsletter = await db.query.newsletters.findFirst({
      where: and(eq(newsletters.id, id), eq(newsletters.tenantId, req.user.tenantId)),
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Update task status (placeholder - you might have a separate task status table)
    const taskStatus = {
      newsletterId: id,
      status: status || 'pending',
      progress: progress || 0,
      totalRecipients: totalRecipients || 0,
      processedRecipients: processedRecipients || 0,
      failedRecipients: failedRecipients || 0,
      startedAt: status === 'processing' ? new Date().toISOString() : null,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
      error: error || null,
    };

    res.json(taskStatus);
  } catch (error) {
    console.error('Update newsletter task status error:', error);
    res.status(500).json({ message: 'Failed to update newsletter task status' });
  }
});

// Update specific task status
newsletterRoutes.put("/:newsletterId/task-status/:taskId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { newsletterId, taskId } = req.params;
    const { status, progress, error } = req.body;

    const newsletter = await db.query.newsletters.findFirst({
      where: and(eq(newsletters.id, newsletterId), eq(newsletters.tenantId, req.user.tenantId)),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Update specific task status (placeholder)
    const taskStatus = {
      taskId,
      newsletterId,
      status: status || 'pending',
      progress: progress || 0,
      error: error || null,
      updatedAt: new Date().toISOString(),
    };

    res.json(taskStatus);
  } catch (error) {
    console.error('Update specific task status error:', error);
    res.status(500).json({ message: 'Failed to update task status' });
  }
});

// Initialize newsletter tasks
newsletterRoutes.post("/:id/initialize-tasks", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: and(eq(newsletters.id, id), eq(newsletters.tenantId, req.user.tenantId)),
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Derive task statuses from the newsletter's current state
    const status = newsletter.status;

    let validationStatus = 'pending';
    let deliveryStatus = 'pending';
    let analyticsStatus = 'pending';

    if (status === 'ready_to_send' || status === 'sending' || status === 'sent') {
      validationStatus = 'completed';
    } else if (status === 'scheduled') {
      validationStatus = 'running';
    }

    if (status === 'sent') {
      deliveryStatus = 'completed';
    } else if (status === 'sending') {
      deliveryStatus = 'running';
    }

    if (status === 'sent' || status === 'sending') {
      analyticsStatus = 'running';
      if (newsletter.sentAt) {
        const hoursSinceSent = (Date.now() - new Date(newsletter.sentAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceSent >= 24) {
          analyticsStatus = 'completed';
        }
      }
    }

    const tasks = [
      {
        id: `task-${id}-1`,
        type: 'prepare_recipients',
        status: validationStatus,
        progress: validationStatus === 'completed' ? 100 : validationStatus === 'running' ? 50 : 0,
      },
      {
        id: `task-${id}-2`,
        type: 'send_emails',
        status: deliveryStatus,
        progress: deliveryStatus === 'completed' ? 100 : deliveryStatus === 'running' ? 50 : 0,
      },
      {
        id: `task-${id}-3`,
        type: 'track_results',
        status: analyticsStatus,
        progress: analyticsStatus === 'completed' ? 100 : analyticsStatus === 'running' ? 50 : 0,
      },
    ];

    res.json({
      message: 'Newsletter tasks initialized successfully',
      newsletterId: id,
      tasks,
    });
  } catch (error) {
    console.error('Initialize newsletter tasks error:', error);
    res.status(500).json({ message: 'Failed to initialize newsletter tasks' });
  }
});

// Send newsletter - Updated to follow the flowchart
newsletterRoutes.post("/:id/send", authenticateToken, requireTenant, requirePermission('newsletters.send'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { testEmail } = req.body;

    // Execute Auth Ver checks (from flowchart)
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication verification failed' });
    }

    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId)
      ),
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status === 'sent') {
      return res.status(400).json({ message: 'Newsletter has already been sent' });
    }

    if (newsletter.status === 'pending_review') {
      return res.status(400).json({ message: 'Newsletter is pending reviewer approval and cannot be sent yet' });
    }

    // Check if reviewer approval is required but not yet obtained (per-newsletter flag)
    if (newsletter.requiresReviewerApproval && newsletter.reviewStatus !== 'approved') {
      return res.status(400).json({ message: 'Newsletter requires reviewer approval before it can be sent' });
    }

    // Check tenant-level reviewer settings: when enabled, ALL unsent newsletters must be reviewed
    const reviewerSettings = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, req.user.tenantId),
    });
    if (reviewerSettings?.enabled && newsletter.reviewStatus !== 'approved') {
      return res.status(400).json({
        message: 'Newsletter reviewer approval is required. Please submit this newsletter for review before sending.',
        requiresReview: true,
      });
    }

    // If test email is provided, send test email
    if (testEmail) {
      try {
        const wrappedTestHtml = await wrapNewsletterContent(req.user.tenantId, newsletter.content, extractPuckColorOverrides(newsletter.puckData));
        const testTrackingId = crypto.randomUUID();
        await emailService.sendCustomEmail(testEmail, newsletter.subject, wrappedTestHtml, {
          tags: [
            { name: 'type', value: 'newsletter-test' },
            { name: 'newsletterId', value: id },
            { name: 'tenantId', value: req.user.tenantId },
            { name: 'trackingId', value: testTrackingId },
          ],
        });
        res.json({
          message: 'Test newsletter sent successfully',
          testEmail,
          trackingId: testTrackingId,
        });
      } catch (emailError) {
        console.error('Failed to send test newsletter:', emailError);
        res.status(500).json({ message: 'Failed to send test newsletter' });
      }
      return;
    }

    // Save Newsletter to DB (update status) - don't set sentAt yet, only when actually sent
    await db.update(newsletters)
      .set({
        status: 'sending',
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id));

    // Log activity: newsletter send initiated
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'sent',
      description: `Started sending newsletter "${newsletter.title}"`,
      metadata: {
        subject: newsletter.subject,
        recipientType: newsletter.recipientType,
      },
      req,
    });

    try {
      // Generate unique group UUID for tracking
      const groupUUID = crypto.randomUUID();
      console.log(`[Newsletter] Starting to send newsletter ${id} with groupUUID: ${groupUUID}`);

      // Get recipients based on newsletter segmentation
      const recipients = await getNewsletterRecipients(newsletter, req.user.tenantId);

      // Suppression filter: global bounces + tenant-scoped complaints
      const suppressedMap = await getSuppressionMap(req.user.tenantId);

      const dedupedRecipients = Array.from(new Map(recipients.map((r: any) => [String(r.email).toLowerCase().trim(), r])).values());
      const allowedRecipients = dedupedRecipients.filter((r: any) => !suppressedMap.has(String(r.email).toLowerCase().trim()) && r.prefNewsletters !== false);
      const blockedRecipients = dedupedRecipients.filter((r: any) => suppressedMap.has(String(r.email).toLowerCase().trim()));

      if (blockedRecipients.length > 0) {
        console.log(`[Newsletter] Suppressed ${blockedRecipients.length} recipient(s) (global bounces + tenant-scoped complaints).`);

        // Update contact status for blocked recipients based on suppression type
        const complaintEmails = blockedRecipients
          .filter((r: any) => suppressedMap.get(String(r.email).toLowerCase().trim()) === 'complaint')
          .map((r: any) => String(r.email).toLowerCase().trim());

        const bouncedTypeEmails = blockedRecipients
          .filter((r: any) => suppressedMap.get(String(r.email).toLowerCase().trim()) !== 'complaint')
          .map((r: any) => String(r.email).toLowerCase().trim());

        if (complaintEmails.length > 0) {
          await db.update(emailContacts)
            .set({ status: 'unsubscribed' as any, updatedAt: new Date() as any })
            .where(and(eq(emailContacts.tenantId, req.user.tenantId), inArray(emailContacts.email, complaintEmails)));
        }
        if (bouncedTypeEmails.length > 0) {
          await db.update(emailContacts)
            .set({ status: 'bounced' as any, updatedAt: new Date() as any })
            .where(and(eq(emailContacts.tenantId, req.user.tenantId), inArray(emailContacts.email, bouncedTypeEmails)));
        }
      }

      if (recipients.length === 0) {
        await db.update(newsletters)
          .set({
            status: 'draft',
            updatedAt: new Date(),
          })
          .where(eq(newsletters.id, id));

        return res.status(400).json({
          message: 'No recipients found for newsletter. Please check your segmentation settings or add email contacts.'
        });
      }

      if (allowedRecipients.length === 0) {
        await db.update(newsletters)
          .set({ status: 'draft', updatedAt: new Date() })
          .where(eq(newsletters.id, id));
        return res.status(400).json({ message: 'All recipients are suppressed (bounces or tenant-level complaints). No emails will be sent.' });
      }

      // Also fetch contacts excluded at the DB level (status != 'active': suppressed, bounced, unsubscribed)
      // These were filtered out by getNewsletterRecipients before the suppressionMap check
      const locallySuppressedContacts = await getSuppressedNewsletterContacts(newsletter, req.user.tenantId);
      const allSuppressedForTracking = [
        ...blockedRecipients.map((r: any) => ({
          id: r.id,
          email: String(r.email),
          reason: `bouncedEmails: ${suppressedMap.get(String(r.email).toLowerCase().trim()) || 'unknown'}`,
        })),
        ...locallySuppressedContacts.map((c) => ({
          id: c.id,
          email: c.email,
          reason: `contact status: ${c.status}`,
        })),
      ];

      console.log(`[Newsletter] Found ${recipients.length} active recipients for newsletter ${id}. ${allowedRecipients.length} allowed after suppression filter. ${locallySuppressedContacts.length} locally suppressed (non-active status). ${blockedRecipients.length} blocked by bouncedEmails.`);

      // Initialize Convex tracking with TOTAL recipients (allowed + all suppressed)
      // so the dashboard accurately reflects the full picture
      const totalForTracking = allowedRecipients.length + allSuppressedForTracking.length;
      try {
        await initNewsletterTracking({
          tenantId: req.user.tenantId,
          newsletterId: id,
          totalRecipients: totalForTracking,
        });

        // Track each suppressed recipient in Convex so the dashboard shows them
        // Track each suppressed recipient in Convex so the dashboard shows them
        if (allSuppressedForTracking.length > 0) {
          const results = await Promise.allSettled(allSuppressedForTracking.map(suppressed =>
            trackNewsletterEmailSend({
              tenantId: req.user.tenantId,
              newsletterId: id,
              groupUUID,
              recipientEmail: suppressed.email,
              recipientId: suppressed.id,
              status: 'suppressed',
              error: `Suppressed: ${suppressed.reason}`,
            })
          ));

          // Log failures
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              const suppressed = allSuppressedForTracking[index];
              console.error(`[Newsletter] Failed to track suppressed recipient ${suppressed.email} (id: ${suppressed.id}):`, result.reason);
            }
          });

          console.log(`[Newsletter] Tracked ${allSuppressedForTracking.length} suppressed recipient(s) in Convex`);
        }
      } catch (convexErr) {
        console.warn('[Newsletter] Failed to init Convex tracking (non-fatal):', convexErr);
      }

      // Send via Trigger.dev
      try {
        console.log(`[Newsletter] Triggering Trigger.dev sendNewsletterTask`);

        // Wrap newsletter content in the tenant's global email design template
        const wrappedContent = await wrapNewsletterContent(req.user.tenantId, newsletter.content, extractPuckColorOverrides(newsletter.puckData));

        // Generate unsubscribe tokens for all recipients
        const recipientsWithTokens = await Promise.all(
          allowedRecipients.map(async (contact: { id: string; email: string; firstName?: string; lastName?: string; phoneNumber?: string; address?: string }) => {
            let unsub = await db.query.unsubscribeTokens.findFirst({
              where: and(eq(unsubscribeTokens.tenantId, req.user.tenantId), eq(unsubscribeTokens.contactId, contact.id), sql`${unsubscribeTokens.usedAt} IS NULL`),
            });
            if (!unsub) {
              const token = crypto.randomBytes(24).toString('base64url');
              const created = await db.insert(unsubscribeTokens).values({ tenantId: req.user.tenantId, contactId: contact.id, token }).returning();
              unsub = created[0];
            }
            return {
              id: contact.id,
              email: contact.email,
              firstName: contact.firstName || '',
              lastName: contact.lastName || '',
              phoneNumber: contact.phoneNumber || '',
              address: contact.address || '',
              unsubscribeToken: unsub.token,
            };
          })
        );

        // Import and trigger the Trigger.dev task
        const { sendNewsletterTask } = await import('../../src/trigger/newsletter');

        const handle = await sendNewsletterTask.trigger({
          jobId: `newsletter-${newsletter.id}-${Date.now()}`,
          newsletterId: newsletter.id,
          tenantId: req.user.tenantId,
          userId: req.user.id,
          groupUUID,
          subject: newsletter.subject,
          content: wrappedContent,
          recipients: recipientsWithTokens,
          batchSize: 25,
          priority: 'normal' as const,
          reactionsEnabled: newsletter.reactionsEnabled ?? true,
          baseUrl: `${req.protocol}://${req.get('host')}`,
        });

        console.log(`[Newsletter] Trigger.dev task triggered:`, {
          runId: handle.id,
          newsletterId: newsletter.id,
          recipientCount: allowedRecipients.length
        });

        // Keep status as 'sending' — final 'sent' is set by Trigger.dev job completion callback
        await db.update(newsletters)
          .set({
            status: 'sending',
            recipientCount: allowedRecipients.length,
            updatedAt: new Date(),
          })
          .where(eq(newsletters.id, id));

        // Return success response
        res.json({
          message: 'Newsletter send started successfully',
          runId: handle.id,
          newsletterId: newsletter.id,
          groupUUID,
          recipientCount: allowedRecipients.length
        });

      } catch (triggerError: any) {
        console.error(`[Newsletter] Failed to trigger Trigger.dev task:`, triggerError);

        // Fallback to direct sending if Trigger.dev is unavailable
        console.log(`[Newsletter] Falling back to direct email sending`);

        // Generate or reuse unsubscribe tokens per recipient (single-use, long-lived until used)
        const tokenMap = new Map<string, string>();
        for (const r of allowedRecipients) {
          let unsub = await db.query.unsubscribeTokens.findFirst({
            where: and(eq(unsubscribeTokens.tenantId, req.user.tenantId), eq(unsubscribeTokens.contactId, r.id), sql`${unsubscribeTokens.usedAt} IS NULL`),
          });
          if (!unsub) {
            const token = crypto.randomBytes(24).toString('base64url');
            const created = await db.insert(unsubscribeTokens).values({ tenantId: req.user.tenantId, contactId: r.id, token }).returning();
            unsub = created[0];
          }
          tokenMap.set(r.id, unsub.token);
        }

        // Wrap newsletter content in the branded email design template
        const wrappedContent = await wrapNewsletterContent(req.user.tenantId, newsletter.content, extractPuckColorOverrides(newsletter.puckData));

        // Helper to inject content before the footer marker (inside the document body)
        const injectBeforeFooter = (content: string, injection: string): string => {
          const footerMarker = '<!-- Footer -->';
          if (content.includes(footerMarker)) {
            return content.replace(footerMarker, `${injection}\n\n      ${footerMarker}`);
          }
          // Fallback: insert before closing </div></body>
          const closingMatch = content.lastIndexOf('</div>\n  </body>');
          if (closingMatch !== -1) {
            return content.slice(0, closingMatch) + injection + '\n' + content.slice(closingMatch);
          }
          // Last resort: insert before </body>
          return content.replace('</body>', `${injection}\n</body>`);
        };

        // Prepare emails for batch sending (inject reaction buttons + unsubscribe link inside body)
        const emails = allowedRecipients.map((contact: { id: string; email: string; firstName?: string; lastName?: string; phoneNumber?: string; address?: string }) => {
          const token = tokenMap.get(contact.id)!;
          const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/email/unsubscribe?token=${encodeURIComponent(token)}&type=newsletters`;
          const emailTrackingId = crypto.randomUUID();

          // Build reaction buttons HTML if reactions are enabled
          const reactionHtml = newsletter.reactionsEnabled
            ? buildReactionButtonsHtml(`${req.protocol}://${req.get('host')}`, newsletter.id, contact.id)
            : '';

          // Build unsubscribe block
          const unsubscribeBlock = `<div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
              </p>
            </div>`;

          // Substitute template variables for this recipient
          let html = substituteNewsletterVariables(wrappedContent, contact);
          if (reactionHtml) {
            html = injectBeforeFooter(html, reactionHtml);
          }
          html = injectBeforeFooter(html, unsubscribeBlock);
          const text = `${newsletter.content.replace(/<[^>]*>/g, '')}\n\nUnsubscribe: ${unsubscribeUrl}`;
          return {
            to: contact.email,
            subject: newsletter.subject,
            html,
            text,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            },
            tags: [
              { name: 'type', value: 'newsletter' },
              { name: 'newsletterId', value: newsletter.id },
              { name: 'groupUUID', value: groupUUID },
              { name: 'tenantId', value: req.user.tenantId },
              { name: 'recipientId', value: contact.id },
              { name: 'trackingId', value: emailTrackingId },
            ],
            metadata: {
              type: 'newsletter',
              newsletterId: newsletter.id,
              groupUUID,
              recipientId: contact.id,
            }
          };
        });

        // Send emails individually (batch method removed - use Trigger.dev for bulk sending)
        console.log(`[Newsletter] Sending ${emails.length} emails for newsletter ${id} (after suppression filter)`);
        let successful = 0;
        let failed = 0;
        const errors: Array<{ email: string; error: string }> = [];

        for (const emailData of emails) {
          try {
            const result = await enhancedEmailService.sendCustomEmail(
              emailData.to,
              emailData.subject,
              emailData.html,
              { text: emailData.text, headers: emailData.headers, tags: emailData.tags, metadata: emailData.metadata }
            );
            if (result.success) {
              successful++;
            } else {
              failed++;
              errors.push({ email: emailData.to, error: result.error || 'Send failed' });
            }
          } catch (err) {
            failed++;
            errors.push({ email: emailData.to, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }

        console.log(`[Newsletter] Batch sending complete for ${id}:`, {
          successful,
          failed
        });

        // Generate web slug and publish for browser viewing (only if publishToBlog is enabled)
        const sendUpdate: Record<string, any> = {
          status: 'sent',
          recipientCount: successful,
          sentAt: new Date(),
          updatedAt: new Date(),
        };

        if (newsletter.publishToBlog !== false) {
          sendUpdate.webSlug = await generateWebSlug(newsletter.title, req.user.tenantId, id);
          sendUpdate.publishedAt = new Date();
        }

        await db.update(newsletters)
          .set(sendUpdate)
          .where(eq(newsletters.id, id));

        res.json({
          message: 'Newsletter sent successfully (direct mode)',
          newsletterId: id,
          status: 'sent',
          successful,
          failed,
          total: successful + failed,
          groupUUID,
          note: 'Temporal server was unavailable, sent directly'
        });
      }

    } catch (sendError) {
      console.error(`[Newsletter] Failed to send newsletter ${id}:`, sendError);

      // Update newsletter status back to draft on failure, clear sentAt if it was set
      await db.update(newsletters)
        .set({
          status: 'draft',
          sentAt: null,
          updatedAt: new Date(),
        })
        .where(eq(newsletters.id, id));

      // Log activity: send failure
      await logActivity({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        entityType: 'newsletter',
        entityId: id,
        entityName: newsletter.title,
        activityType: 'failed',
        description: `Failed to send newsletter "${newsletter.title}"`,
        metadata: {
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        },
        req,
      });

      res.status(500).json({
        message: 'Failed to create temporal workflow for newsletter sending',
        error: sendError instanceof Error ? sendError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ message: 'Failed to send newsletter' });
  }
});

// Schedule newsletter for future sending
newsletterRoutes.post("/:id/schedule", authenticateToken, requireTenant, requirePermission('newsletters.send'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ message: 'scheduledAt is required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ message: 'Invalid scheduledAt date' });
    }

    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'Scheduled time must be in the future' });
    }

    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication verification failed' });
    }

    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId)
      ),
      with: { user: true }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status === 'sent') {
      return res.status(400).json({ message: 'Newsletter has already been sent' });
    }

    if (newsletter.status === 'sending') {
      return res.status(400).json({ message: 'Newsletter is currently being sent' });
    }

    if (newsletter.status === 'pending_review') {
      return res.status(400).json({ message: 'Newsletter is pending reviewer approval and cannot be scheduled yet' });
    }

    // Check reviewer approval requirements
    if (newsletter.requiresReviewerApproval && newsletter.reviewStatus !== 'approved') {
      return res.status(400).json({ message: 'Newsletter requires reviewer approval before it can be scheduled' });
    }

    const reviewerSettings = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, req.user.tenantId),
    });
    if (reviewerSettings?.enabled && newsletter.reviewStatus !== 'approved') {
      return res.status(400).json({
        message: 'Newsletter reviewer approval is required. Please submit this newsletter for review before scheduling.',
        requiresReview: true,
      });
    }

    // Get recipients and apply suppression filter (same as send)
    const recipients = await getNewsletterRecipients(newsletter, req.user.tenantId);
    const suppressedMap = await getSuppressionMap(req.user.tenantId);

    const dedupedRecipients = Array.from(new Map(recipients.map((r: any) => [String(r.email).toLowerCase().trim(), r])).values());
    const allowedRecipients = dedupedRecipients.filter((r: any) => !suppressedMap.has(String(r.email).toLowerCase().trim()) && r.prefNewsletters !== false);
    const blockedRecipients = dedupedRecipients.filter((r: any) => suppressedMap.has(String(r.email).toLowerCase().trim()));

    if (recipients.length === 0) {
      return res.status(400).json({
        message: 'No recipients found for newsletter. Please check your segmentation settings or add email contacts.'
      });
    }

    if (allowedRecipients.length === 0) {
      return res.status(400).json({ message: 'All recipients are suppressed (bounces or tenant-level complaints). No emails will be sent.' });
    }

    // Generate unique group UUID for tracking
    const groupUUID = crypto.randomUUID();
    console.log(`[Newsletter] Scheduling newsletter ${id} for ${scheduledDate.toISOString()} with groupUUID: ${groupUUID}`);

    // Also fetch contacts excluded at the DB level (status != 'active')
    const locallySuppressedContacts = await getSuppressedNewsletterContacts(newsletter, req.user.tenantId);
    const allSuppressedForTracking = [
      ...blockedRecipients.map((r: any) => ({
        id: r.id,
        email: String(r.email),
        reason: `bouncedEmails: ${suppressedMap.get(String(r.email).toLowerCase().trim()) || 'unknown'}`,
      })),
      ...locallySuppressedContacts.map((c) => ({
        id: c.id,
        email: c.email,
        reason: `contact status: ${c.status}`,
      })),
    ];

    console.log(`[Newsletter] Schedule: ${allowedRecipients.length} allowed, ${allSuppressedForTracking.length} suppressed`);

    // Initialize Convex tracking
    const totalForTracking = allowedRecipients.length + allSuppressedForTracking.length;
    try {
      await initNewsletterTracking({
        tenantId: req.user.tenantId,
        newsletterId: id,
        totalRecipients: totalForTracking,
      });

      if (allSuppressedForTracking.length > 0) {
        await Promise.allSettled(allSuppressedForTracking.map(suppressed =>
          trackNewsletterEmailSend({
            tenantId: req.user.tenantId,
            newsletterId: id,
            groupUUID,
            recipientEmail: suppressed.email,
            recipientId: suppressed.id,
            status: 'suppressed',
            error: `Suppressed: ${suppressed.reason}`,
          })
        ));
      }
    } catch (convexErr) {
      console.warn('[Newsletter] Failed to init Convex tracking for scheduled send (non-fatal):', convexErr);
    }

    // Wrap newsletter content
    const wrappedContent = await wrapNewsletterContent(req.user.tenantId, newsletter.content, extractPuckColorOverrides(newsletter.puckData));

    // Trigger the schedule task via Trigger.dev
    const { scheduleNewsletterTask } = await import('../../src/trigger/newsletter');

    const handle = await scheduleNewsletterTask.trigger({
      jobId: `newsletter-${newsletter.id}-${Date.now()}`,
      newsletterId: newsletter.id,
      tenantId: req.user.tenantId,
      userId: req.user.id,
      groupUUID,
      subject: newsletter.subject,
      content: wrappedContent,
      recipients: allowedRecipients.map((contact: { id: string; email: string; firstName?: string; lastName?: string; phoneNumber?: string; address?: string }) => ({
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        phoneNumber: contact.phoneNumber || '',
        address: contact.address || '',
      })),
      batchSize: 25,
      priority: 'normal' as const,
      scheduledFor: scheduledDate.toISOString(),
      reactionsEnabled: newsletter.reactionsEnabled ?? true,
      baseUrl: `${req.protocol}://${req.get('host')}`,
    });

    console.log(`[Newsletter] Schedule task triggered:`, {
      runId: handle.id,
      newsletterId: newsletter.id,
      scheduledFor: scheduledDate.toISOString(),
      recipientCount: allowedRecipients.length,
    });

    // Update newsletter status to 'scheduled' and store the run ID
    await db.update(newsletters)
      .set({
        status: 'scheduled',
        scheduledAt: scheduledDate,
        triggerRunId: handle.id,
        recipientCount: allowedRecipients.length,
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id));

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'scheduled',
      description: `Scheduled newsletter "${newsletter.title}" for ${scheduledDate.toISOString()}`,
      metadata: {
        scheduledAt: scheduledDate.toISOString(),
        recipientCount: allowedRecipients.length,
        runId: handle.id,
      },
      req,
    });

    res.json({
      message: 'Newsletter scheduled successfully',
      newsletterId: newsletter.id,
      scheduledAt: scheduledDate.toISOString(),
      recipientCount: allowedRecipients.length,
      runId: handle.id,
      groupUUID,
    });
  } catch (error) {
    console.error('Schedule newsletter error:', error);
    res.status(500).json({ message: 'Failed to schedule newsletter' });
  }
});

// Cancel a scheduled newsletter
newsletterRoutes.post("/:id/cancel-schedule", authenticateToken, requireTenant, requirePermission('newsletters.send'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId)
      ),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status !== 'scheduled') {
      return res.status(400).json({ message: 'Newsletter is not currently scheduled' });
    }

    // Cancel the Trigger.dev run if we have a run ID
    if (newsletter.triggerRunId) {
      try {
        const { runs } = await import('@trigger.dev/sdk/v3');
        await runs.cancel(newsletter.triggerRunId);
        console.log(`[Newsletter] Cancelled Trigger.dev run ${newsletter.triggerRunId} for newsletter ${id}`);
      } catch (cancelErr) {
        console.warn(`[Newsletter] Failed to cancel Trigger.dev run ${newsletter.triggerRunId} (may have already started):`, cancelErr);
      }
    }

    // Revert newsletter status to draft
    await db.update(newsletters)
      .set({
        status: 'draft',
        scheduledAt: null,
        triggerRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id));

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'schedule_cancelled',
      description: `Cancelled scheduled send for newsletter "${newsletter.title}"`,
      metadata: {
        previousScheduledAt: newsletter.scheduledAt?.toISOString(),
        cancelledRunId: newsletter.triggerRunId,
      },
      req,
    });

    res.json({
      message: 'Scheduled send cancelled successfully',
      newsletterId: id,
      status: 'draft',
    });
  } catch (error) {
    console.error('Cancel schedule error:', error);
    res.status(500).json({ message: 'Failed to cancel scheduled send' });
  }
});

// Internal endpoint: Complete analytics collection (called by Trigger.dev completeAnalyticsCollectionTask)
newsletterRoutes.put('/internal/:id/complete-analytics', authenticateInternalService, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { tenantId, taskType, status: taskStatus, progress, completedAt } = req.body;

    console.log(`[Newsletter Internal] Completing analytics collection for newsletter ${id}`);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    // Find the analytics task for this newsletter
    const analyticsTask = await db.query.newsletterTaskStatus.findFirst({
      where: and(
        eq(newsletterTaskStatus.newsletterId, id),
        eq(newsletterTaskStatus.tenantId, tenantId),
        eq(newsletterTaskStatus.taskType, 'analytics')
      ),
    });

    if (!analyticsTask) {
      console.log(`[Newsletter Internal] No analytics task found for newsletter ${id}, creating one`);
      await db.insert(newsletterTaskStatus).values({
        newsletterId: id,
        tenantId,
        taskType: 'analytics',
        taskName: 'Analytics Collection',
        status: taskStatus || 'completed',
        progress: progress || 100,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
      });
    } else {
      // Update existing analytics task status
      await db.update(newsletterTaskStatus)
        .set({
          status: taskStatus || 'completed',
          progress: progress || 100,
          completedAt: completedAt ? new Date(completedAt) : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(newsletterTaskStatus.id, analyticsTask.id));
    }

    console.log(`[Newsletter Internal] Analytics collection marked as completed for newsletter ${id}`);
    res.json({ success: true, newsletterId: id, taskType: 'analytics', status: 'completed' });
  } catch (error) {
    console.error('[Newsletter Internal] Complete analytics error:', error);
    res.status(500).json({ error: 'Failed to complete analytics collection' });
  }
});

// Internal endpoint: Update newsletter status (called by Trigger.dev tasks)
newsletterRoutes.put('/internal/:id/status', authenticateInternalService, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, sentCount, failedCount, totalCount } = req.body;

    console.log(`[Newsletter Internal] Updating newsletter ${id} status to: ${status}`, { sentCount, failedCount, totalCount });

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (sentCount !== undefined) {
      updateData.recipientCount = sentCount;
    }

    // When marking as 'sent', also publish for web viewing (if publishToBlog is enabled)
    if (status === 'sent') {
      const newsletter = await db.query.newsletters.findFirst({
        where: eq(newsletters.id, id),
        columns: { id: true, title: true, tenantId: true, webSlug: true, publishToBlog: true },
      });
      if (newsletter && !newsletter.webSlug && newsletter.publishToBlog !== false) {
        updateData.publishedAt = new Date();
        updateData.webSlug = await generateWebSlug(newsletter.title, newsletter.tenantId, id);
        console.log(`[Newsletter Internal] Auto-publishing newsletter ${id} with webSlug: ${updateData.webSlug}`);
      }
      if (!updateData.sentAt) {
        updateData.sentAt = new Date();
      }
    }

    await db.update(newsletters)
      .set(updateData)
      .where(eq(newsletters.id, id));

    console.log(`[Newsletter Internal] Newsletter ${id} status updated to: ${status}`);
    res.json({ success: true, newsletterId: id, status });
  } catch (error) {
    console.error('[Newsletter Internal] Status update error:', error);
    res.status(500).json({ error: 'Failed to update newsletter status' });
  }
});

// Endpoint for sending a single newsletter email (called by Temporal activities)
newsletterRoutes.post('/:id/send-single', authenticateInternalService, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { recipient, subject, content, groupUUID, tenantId } = req.body;

    console.log(`[Newsletter] Sending single email for newsletter ${id} to ${recipient.email}`);

    // Pre-send suppression filter: tenant-scoped complaints + global bounces
    try {
      const suppressionMap = await getSuppressionMap(tenantId);
      const lowerEmail = String(recipient.email).toLowerCase().trim();
      const suppressionType = suppressionMap.get(lowerEmail);

      if (suppressionType) {
        console.warn(`[Newsletter] Blocking send to suppressed email: ${recipient.email} (type=${suppressionType})`);

        // Update contact status based on suppression type
        const statusUpdate = suppressionType === 'complaint' ? 'unsubscribed' : 'bounced';
        await db.update(emailContacts)
          .set({ status: statusUpdate as any, updatedAt: new Date() as any })
          .where(and(eq(emailContacts.tenantId, tenantId), sql`${emailContacts.email} = ${lowerEmail}`));

        return res.json({
          success: true,
          blocked: true,
          reason: suppressionType,
          recipient: recipient.email,
        });
      }
    } catch (suppressionError) {
      console.error('[Newsletter] Suppression check failed, proceeding cautiously:', suppressionError);
    }

    // Prepare the email message
    // Generate or reuse unsubscribe token (single-use, long-lived until used)
    let unsub = await db.query.unsubscribeTokens.findFirst({
      where: and(eq(unsubscribeTokens.tenantId, tenantId), eq(unsubscribeTokens.contactId, recipient.id), sql`${unsubscribeTokens.usedAt} IS NULL`),
    });
    if (!unsub) {
      const token = crypto.randomBytes(24).toString('base64url');
      const created = await db.insert(unsubscribeTokens).values({ tenantId, contactId: recipient.id, token }).returning();
      unsub = created[0];
    }
    const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/email/unsubscribe?token=${encodeURIComponent(unsub.token)}&type=newsletters`;

    // Check if reactions are enabled for this newsletter
    const singleNewsletter = await db.query.newsletters.findFirst({
      where: and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)),
      columns: { reactionsEnabled: true, puckData: true },
    });

    // Wrap newsletter content in the branded email design template
    const wrappedSingleContent = await wrapNewsletterContent(tenantId, content, extractPuckColorOverrides(singleNewsletter?.puckData));
    const singleReactionHtml = singleNewsletter?.reactionsEnabled
      ? buildReactionButtonsHtml(`${req.protocol}://${req.get('host')}`, id, recipient.id)
      : '';

    // Helper to inject content before the footer marker (inside the document body)
    const injectBeforeFooterSingle = (htmlContent: string, injection: string): string => {
      const footerMarker = '<!-- Footer -->';
      if (htmlContent.includes(footerMarker)) {
        return htmlContent.replace(footerMarker, `${injection}\n\n      ${footerMarker}`);
      }
      // Fallback: insert before closing </div></body>
      const closingMatch = htmlContent.lastIndexOf('</div>\n  </body>');
      if (closingMatch !== -1) {
        return htmlContent.slice(0, closingMatch) + injection + '\n' + htmlContent.slice(closingMatch);
      }
      // Last resort: insert before </body>
      return htmlContent.replace('</body>', `${injection}\n</body>`);
    };

    // Build unsubscribe block
    const unsubscribeBlock = `<div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>`;

    // Inject reaction buttons and unsubscribe block inside the document body
    let finalHtml = wrappedSingleContent;
    if (singleReactionHtml) {
      finalHtml = injectBeforeFooterSingle(finalHtml, singleReactionHtml);
    }
    finalHtml = injectBeforeFooterSingle(finalHtml, unsubscribeBlock);

    const email = {
      to: recipient.email,
      subject: subject,
      html: finalHtml,
      from: process.env.EMAIL_FROM || 'noreply@saas-app.com',
      tags: [
        { name: 'type', value: 'newsletter' },
        { name: 'newsletterId', value: id },
        { name: 'groupUUID', value: groupUUID },
        { name: 'tenantId', value: tenantId },
        { name: 'recipientId', value: recipient.id },
        { name: 'trackingId', value: crypto.randomUUID() },
      ]
    };

    // Send email using the enhanced email service
    try {
      const result = await enhancedEmailService.sendCustomEmail(
        email.to,
        email.subject,
        email.html,
        {
          from: email.from,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          },
          tags: email.tags,
          metadata: { type: 'newsletter', newsletterId: id, groupUUID, recipientId: recipient.id },
        }
      );

      console.log(`[Newsletter] Email sent successfully to ${recipient.email}:`, result);

      res.json({
        success: true,
        messageId: (result as any).id || (result as any).messageId,
        recipient: recipient.email
      });

    } catch (sendError) {
      console.error(`[Newsletter] Failed to send email to ${recipient.email}:`, sendError);
      res.status(500).json({
        success: false,
        error: sendError instanceof Error ? sendError.message : 'Failed to send email',
        recipient: recipient.email
      });
    }

  } catch (error) {
    console.error('[Newsletter] Send single email error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Submit newsletter for review
newsletterRoutes.post("/:id/submit-for-review", authenticateToken, requireTenant, requirePermission(['newsletters.create', 'newsletters.send']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status === 'pending_review') {
      return res.status(400).json({ message: 'Newsletter is already pending review. It cannot be re-submitted until the current review is resolved.' });
    }

    if (newsletter.status !== 'ready_to_send') {
      return res.status(400).json({ message: 'Newsletter must be in "Ready to Send" status with recipients selected before submitting for review' });
    }

    // Get reviewer settings
    const settings = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, tenantId),
    });

    if (!settings?.enabled || !settings?.reviewerId) {
      return res.status(400).json({ message: 'Newsletter reviewer is not configured for this organization' });
    }

    // Prevent users from submitting themselves as the reviewer
    if (settings.reviewerId === req.user.id) {
      return res.status(400).json({ message: 'You cannot submit a newsletter for review when you are the designated reviewer. This would allow self-approval and bypass the review workflow.' });
    }

    // Generate a random 6-digit numeric approval code (900k possible values)
    const approvalCode = String(crypto.randomInt(100000, 1000000));
    // Store only the SHA-256 hash in the database — the plaintext code is sent via email
    const approvalCodeHash = crypto.createHash('sha256').update(approvalCode).digest('hex');

    // Update newsletter status
    const [updated] = await db.update(newsletters)
      .set({
        status: 'pending_review',
        requiresReviewerApproval: true,
        reviewerId: settings.reviewerId,
        reviewStatus: 'pending',
        reviewedAt: null,
        reviewNotes: null,
        reviewerApprovalCode: approvalCodeHash,
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id))
      .returning();

    // Log activity
    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'submitted_for_review',
      description: `Submitted newsletter "${newsletter.title}" for review`,
      metadata: { reviewerId: settings.reviewerId },
      req,
    });

    // Trigger review notification email to the reviewer
    try {
      // Fetch reviewer details
      const reviewer = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, settings.reviewerId),
        columns: { id: true, email: true, firstName: true, lastName: true, name: true },
      });

      if (reviewer?.email) {
        const submitterName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.name || req.user.email;
        const reviewerName = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(' ') || reviewer.name || reviewer.email;

        const { sendReviewNotificationTask } = await import('../../src/trigger/newsletterReviewNotification');
        await sendReviewNotificationTask.trigger({
          newsletterId: id,
          newsletterTitle: newsletter.title,
          newsletterSubject: newsletter.subject,
          newsletterContent: newsletter.content,
          tenantId,
          submitterName,
          submitterEmail: req.user.email,
          reviewerEmail: reviewer.email,
          reviewerName,
          submittedAt: new Date().toISOString(),
          approvalCode,
        });
        console.log(`[Newsletter] Review notification triggered for reviewer ${reviewer.email}`);
      }
    } catch (notifError) {
      // Non-fatal: don't block the submission if notification fails
      console.error('[Newsletter] Failed to trigger review notification:', notifError);
    }

    res.json({ message: 'Newsletter submitted for review', newsletter: updated });
  } catch (error) {
    console.error('Submit for review error:', error);
    res.status(500).json({ message: 'Failed to submit newsletter for review' });
  }
});

// Approve newsletter (requires 6-digit approval code verification)
newsletterRoutes.post("/:id/approve", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { notes, approvalCode } = req.body;
    const tenantId = req.user.tenantId;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status !== 'pending_review') {
      return res.status(400).json({ message: 'Newsletter is not pending review' });
    }

    // Check that the current user is the assigned reviewer
    if (newsletter.reviewerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigned reviewer can approve this newsletter' });
    }

    // Cross-check: verify the user is still the current designated reviewer in tenant settings
    const currentSettings = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, tenantId),
    });
    if (currentSettings?.enabled && currentSettings.reviewerId !== req.user.id) {
      return res.status(403).json({ message: 'You are no longer the designated reviewer. The reviewer settings have been updated since this newsletter was submitted.' });
    }

    // Check rate limiting for approval code attempts
    const rateLimitCheck = checkApprovalCodeRateLimit(req.user.id, id);
    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.exhausted) {
        // Max attempts exceeded — invalidate the code and force re-submission
        await db.update(newsletters)
          .set({ reviewerApprovalCode: null, status: 'draft', reviewStatus: 'pending', updatedAt: new Date() })
          .where(eq(newsletters.id, id));
        clearApprovalCodeRateLimit(req.user.id, id);
        return res.status(403).json({
          message: 'Too many failed approval code attempts. The approval code has been invalidated. The newsletter must be re-submitted for review.',
          codeInvalidated: true,
        });
      }
      return res.status(429).json({
        message: `Too many incorrect approval code attempts. Please wait ${rateLimitCheck.retryAfter || 1} minute${(rateLimitCheck.retryAfter || 1) > 1 ? 's' : ''} before trying again.`,
        retryAfter: rateLimitCheck.retryAfter,
        nextAllowedAt: rateLimitCheck.nextAllowedAt?.toISOString()
      });
    }

    // Strict server-side validation: code must be exactly 6 digits
    const codeStr = String(approvalCode || '').trim();
    if (!codeStr || !/^\d{6}$/.test(codeStr)) {
      recordFailedApprovalCodeAttempt(req.user.id, id);
      return res.status(400).json({ message: 'Invalid approval code. Please enter the correct 6-digit code.' });
    }

    // Compare provided code hash against stored hash (approval codes are stored hashed)
    const providedCodeHash = crypto.createHash('sha256').update(codeStr).digest('hex');
    const expectedCodeHash = String(newsletter.reviewerApprovalCode || '');

    const providedBuf = Buffer.from(providedCodeHash, 'utf8');
    const expectedBuf = Buffer.from(expectedCodeHash, 'utf8');

    // Use constant-time comparison to prevent timing attacks
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      // Record failed attempt for rate limiting
      recordFailedApprovalCodeAttempt(req.user.id, id);
      return res.status(400).json({ message: 'Invalid approval code. Please enter the correct 6-digit code.' });
    }

    // Clear rate limit after successful approval
    clearApprovalCodeRateLimit(req.user.id, id);

    const [updated] = await db.update(newsletters)
      .set({
        status: 'ready_to_send',
        reviewStatus: 'approved',
        reviewedAt: new Date(),
        reviewNotes: notes || null,
        reviewerApprovalCode: null, // Clear the code after use
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id))
      .returning();

    // Log activity
    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'approved',
      description: `Approved newsletter "${newsletter.title}"`,
      metadata: { reviewStatus: 'approved', reviewNotes: notes },
      req,
    });

    res.json({ message: 'Newsletter approved', newsletter: updated });
  } catch (error) {
    console.error('Approve newsletter error:', error);
    res.status(500).json({ message: 'Failed to approve newsletter' });
  }
});

// Approve & Send newsletter in one step (reviewer enters code via email link)
newsletterRoutes.post("/:id/approve-and-send", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { approvalCode, notes } = req.body;
    const tenantId = req.user.tenantId;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status !== 'pending_review') {
      return res.status(400).json({ message: 'Newsletter is not pending review' });
    }

    // Check that the current user is the assigned reviewer
    if (newsletter.reviewerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigned reviewer can approve this newsletter' });
    }

    // Cross-check: verify the user is still the current designated reviewer in tenant settings
    const currentSettings = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, tenantId),
    });
    if (currentSettings?.enabled && currentSettings.reviewerId !== req.user.id) {
      return res.status(403).json({ message: 'You are no longer the designated reviewer. The reviewer settings have been updated since this newsletter was submitted.' });
    }

    // Check rate limiting for approval code attempts
    const rateLimitCheck = checkApprovalCodeRateLimit(req.user.id, id);
    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.exhausted) {
        // Max attempts exceeded — invalidate the code and force re-submission
        await db.update(newsletters)
          .set({ reviewerApprovalCode: null, status: 'draft', reviewStatus: 'pending', updatedAt: new Date() })
          .where(eq(newsletters.id, id));
        clearApprovalCodeRateLimit(req.user.id, id);
        return res.status(403).json({
          message: 'Too many failed approval code attempts. The approval code has been invalidated. The newsletter must be re-submitted for review.',
          codeInvalidated: true,
        });
      }
      return res.status(429).json({
        message: `Too many incorrect approval code attempts. Please wait ${rateLimitCheck.retryAfter || 1} minute${(rateLimitCheck.retryAfter || 1) > 1 ? 's' : ''} before trying again.`,
        retryAfter: rateLimitCheck.retryAfter,
        nextAllowedAt: rateLimitCheck.nextAllowedAt?.toISOString()
      });
    }

    // Strict server-side validation: code must be exactly 6 digits
    const codeStrAS = String(approvalCode || '').trim();
    if (!codeStrAS || !/^\d{6}$/.test(codeStrAS)) {
      recordFailedApprovalCodeAttempt(req.user.id, id);
      return res.status(400).json({ message: 'Invalid approval code. Please enter the correct 6-digit code.' });
    }

    // Compare provided code hash against stored hash (approval codes are stored hashed)
    const providedCodeHashAS = crypto.createHash('sha256').update(codeStrAS).digest('hex');
    const expectedCodeHashAS = String(newsletter.reviewerApprovalCode || '');

    const providedBufAS = Buffer.from(providedCodeHashAS, 'utf8');
    const expectedBufAS = Buffer.from(expectedCodeHashAS, 'utf8');

    // Use constant-time comparison to prevent timing attacks
    if (providedBufAS.length !== expectedBufAS.length || !crypto.timingSafeEqual(providedBufAS, expectedBufAS)) {
      // Record failed attempt for rate limiting
      recordFailedApprovalCodeAttempt(req.user.id, id);
      return res.status(400).json({ message: 'Invalid approval code. Please enter the correct 6-digit code.' });
    }

    // Clear rate limit after successful approval
    clearApprovalCodeRateLimit(req.user.id, id);

    // Approve the newsletter
    const [updated] = await db.update(newsletters)
      .set({
        status: 'ready_to_send',
        reviewStatus: 'approved',
        reviewedAt: new Date(),
        reviewNotes: notes || null,
        reviewerApprovalCode: null, // Clear the code after use
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id))
      .returning();

    // Log activity
    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'approved',
      description: `Approved newsletter "${newsletter.title}"`,
      metadata: { reviewStatus: 'approved' },
      req,
    });

    // Immediately trigger the send server-side so the client doesn't need to fire a second request.
    // This prevents a race condition where a network failure would leave the newsletter stuck at ready_to_send.
    try {
      // Use hardcoded localhost to prevent SSRF via Host header manipulation
      const port = process.env.PORT || 5002;
      const sendResponse = await fetch(`http://127.0.0.1:${port}/api/newsletters/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || '',
          'Authorization': req.headers.authorization || '',
        },
        body: JSON.stringify({}),
      });
      const sendData = await sendResponse.json() as any;
      if (!sendResponse.ok) {
        console.warn(`[Newsletter] approve-and-send: send triggered but returned ${sendResponse.status}:`, sendData?.message);
      }
      res.json({ message: 'Newsletter approved and sending', newsletter: updated, sendReady: true, sendTriggered: sendResponse.ok, sendMessage: sendData?.message });
    } catch (sendErr) {
      console.error('[Newsletter] approve-and-send: failed to auto-trigger send:', sendErr);
      // Non-fatal: newsletter is approved and in ready_to_send state; user can manually send
      res.json({ message: 'Newsletter approved and ready to send', newsletter: updated, sendReady: true, sendTriggered: false });
    }
  } catch (error) {
    console.error('Approve and send newsletter error:', error);
    res.status(500).json({ message: 'Failed to approve and send newsletter' });
  }
});

// Reject newsletter
newsletterRoutes.post("/:id/reject", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const tenantId = req.user.tenantId;

    if (!notes || typeof notes !== 'string') {
      return res.status(400).json({ message: 'Rejection notes are required' });
    }

    const sanitizedNotes = sanitizeString(notes.trim()) || '';
    if (sanitizedNotes.length === 0) {
      return res.status(400).json({ message: 'Rejection notes cannot be empty' });
    }
    if (sanitizedNotes.length > 2000) {
      return res.status(400).json({ message: 'Rejection notes must be 2000 characters or less' });
    }

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status !== 'pending_review') {
      return res.status(400).json({ message: 'Newsletter is not pending review' });
    }

    // Check that the current user is the assigned reviewer
    if (newsletter.reviewerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigned reviewer can reject this newsletter' });
    }

    // Cross-check: verify the user is still the current designated reviewer in tenant settings
    const currentSettings = await db.query.newsletterReviewerSettings.findFirst({
      where: eq(newsletterReviewerSettings.tenantId, tenantId),
    });
    if (currentSettings?.enabled && currentSettings.reviewerId !== req.user.id) {
      return res.status(403).json({ message: 'You are no longer the designated reviewer. The reviewer settings have been updated since this newsletter was submitted.' });
    }

    const [updated] = await db.update(newsletters)
      .set({
        status: 'draft', // Send back to draft for edits
        reviewStatus: 'rejected',
        reviewedAt: new Date(),
        reviewNotes: sanitizedNotes,
        reviewerApprovalCode: null, // Invalidate the code on rejection
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id))
      .returning();

    // Log activity
    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'rejected',
      description: `Rejected newsletter "${newsletter.title}"`,
      metadata: { reviewStatus: 'rejected', reviewNotes: sanitizedNotes },
      req,
    });

    res.json({ message: 'Newsletter rejected', newsletter: updated });
  } catch (error) {
    console.error('Reject newsletter error:', error);
    res.status(500).json({ message: 'Failed to reject newsletter' });
  }
});

// Recall newsletter from review — returns it to draft and invalidates the reviewer's approval link
newsletterRoutes.post("/:id/recall-review", authenticateToken, requireTenant, requirePermission(['newsletters.create', 'newsletters.send']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${tenantId} AND ${newsletters.deletedAt} IS NULL`,
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status !== 'pending_review') {
      return res.status(400).json({ message: 'Newsletter is not pending review' });
    }

    // Only the original submitter (newsletter creator) or an Owner/Administrator can recall
    const isAdminOrOwner = ['Owner', 'Administrator'].includes(req.user.role);
    if (newsletter.userId !== req.user.id && !isAdminOrOwner) {
      return res.status(403).json({ message: 'Only the person who submitted this newsletter or an administrator can recall it from review' });
    }

    const [updated] = await db.update(newsletters)
      .set({
        status: 'draft',
        reviewStatus: null,
        reviewedAt: null,
        reviewNotes: null,
        reviewerApprovalCode: null, // Invalidate any existing approval code/link
        reviewerId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)))
      .returning();

    // Log activity
    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'newsletter',
      entityId: id,
      entityName: newsletter.title,
      activityType: 'recalled_from_review',
      description: `Recalled newsletter "${newsletter.title}" from review back to draft`,
      metadata: { previousReviewerId: newsletter.reviewerId },
      req,
    });

    res.json({ message: 'Newsletter recalled to draft', newsletter: updated });
  } catch (error) {
    console.error('Recall from review error:', error);
    res.status(500).json({ message: 'Failed to recall newsletter from review' });
  }
});

// ─── Safety net: finalize newsletters stuck in 'sending' status ───
// If Trigger.dev's callback fails, newsletters can get permanently stuck.
// This function detects newsletters in 'sending' for > 30 minutes and marks them 'sent'.

async function finalizeStuckNewsletters(): Promise<number> {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const stuckNewsletters = await db.select({
      id: newsletters.id,
      title: newsletters.title,
      tenantId: newsletters.tenantId,
      recipientCount: newsletters.recipientCount,
      updatedAt: newsletters.updatedAt,
    })
      .from(newsletters)
      .where(and(
        eq(newsletters.status, 'sending'),
        sql`${newsletters.updatedAt} < ${thirtyMinutesAgo.toISOString()}`
      ));

    if (stuckNewsletters.length === 0) return 0;

    console.log(`🔧 [Newsletter Safety Net] Found ${stuckNewsletters.length} newsletter(s) stuck in 'sending' status`);

    for (const nl of stuckNewsletters) {
      try {
        // TODO: Remove this try/catch after migration 0064 is deployed to all environments
        // Read the full row to check publishToBlog safely (column may not exist in DB yet)
        let shouldPublishToBlog = true;
        try {
          const fullNl = await db.query.newsletters.findFirst({
            where: eq(newsletters.id, nl.id),
            columns: { publishToBlog: true },
          });
          if (fullNl && fullNl.publishToBlog === false) {
            shouldPublishToBlog = false;
          }
        } catch {
          // Column doesn't exist in DB yet — default to publishing
        }

        const finalizeUpdate: Record<string, any> = {
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date(),
        };

        // Only publish to blog if publishToBlog is enabled
        if (shouldPublishToBlog) {
          finalizeUpdate.webSlug = await generateWebSlug(nl.title, nl.tenantId, nl.id);
          finalizeUpdate.publishedAt = new Date();
        }

        await db.update(newsletters)
          .set(finalizeUpdate)
          .where(eq(newsletters.id, nl.id));

        console.log(`✅ [Newsletter Safety Net] Finalized newsletter "${nl.title}" (${nl.id}) → sent`);
      } catch (err) {
        console.error(`❌ [Newsletter Safety Net] Failed to finalize newsletter ${nl.id}:`, err);
      }
    }

    return stuckNewsletters.length;
  } catch (error) {
    console.error('❌ [Newsletter Safety Net] Error checking stuck newsletters:', error);
    return 0;
  }
}

// Run the safety net every 10 minutes
setInterval(() => {
  finalizeStuckNewsletters().catch(err =>
    console.error('❌ [Newsletter Safety Net] Interval error:', err)
  );
}, 10 * 60 * 1000);

// Also run once on startup (after a short delay to let the server initialize)
setTimeout(() => {
  finalizeStuckNewsletters().catch(err =>
    console.error('❌ [Newsletter Safety Net] Startup check error:', err)
  );
}, 15_000);

// Manual trigger endpoint for admins
newsletterRoutes.post('/fix-stuck-sending', authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const count = await finalizeStuckNewsletters();
    res.json({ message: `Finalized ${count} stuck newsletter(s)`, count });
  } catch (error) {
    console.error('Fix stuck newsletters error:', error);
    res.status(500).json({ message: 'Failed to fix stuck newsletters' });
  }
});