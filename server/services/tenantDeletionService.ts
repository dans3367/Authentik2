/**
 * Tenant Deletion Service
 *
 * Implements the account deletion flow with a 30-day grace period:
 *
 *   1. requestTenantDeletion  – Owner initiates deletion. Marks tenant pending,
 *      cancels Stripe subscription at period end, invalidates all sessions.
 *   2. cancelTenantDeletion   – Owner cancels deletion during the grace period.
 *   3. purgeTenant            – Called by the scheduled worker once the grace
 *      period expires. Hard-deletes the tenant (DB cascade) and wipes R2
 *      assets. Non-cascaded records are anonymized (not deleted) to preserve
 *      bounce protection and audit history for other tenants.
 *
 * All three functions are designed to be idempotent and safe to retry.
 */

import Stripe from 'stripe';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  tenants,
  betterAuthUser,
  betterAuthSession,
  subscriptions,
  shops,
  masterEmailDesign,
  bouncedEmails,
  rolePermissions,
  convexNewsletterSends,
  convexNewsletterEvents,
  convexNewsletterStats,
} from '@shared/schema';
import { deleteR2Prefix, deleteImageFromR2 } from '../config/r2';
import {
  invalidateUserSecurity,
  invalidateTenantSecurity,
  invalidateTenantPlanCache,
} from '../utils/userSecurityCache';
import { logActivity } from '../utils/activityLogger';
import { enhancedEmailService } from '../emailService';

const GRACE_PERIOD_DAYS = 30;
const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any })
  : null;

export interface RequestTenantDeletionParams {
  tenantId: string;
  userId: string;
  reason?: string;
}

export interface DeletionStatus {
  pending: boolean;
  requestedAt: Date | null;
  scheduledPurgeAt: Date | null;
  requestedByUserId: string | null;
  reason: string | null;
}

// ─── Status lookup ──────────────────────────────────────────────────────────

export async function getDeletionStatus(tenantId: string): Promise<DeletionStatus> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: {
      deletionRequestedAt: true,
      deletionScheduledAt: true,
      deletionRequestedByUserId: true,
      deletionReason: true,
    },
  });

  return {
    pending: !!tenant?.deletionScheduledAt,
    requestedAt: tenant?.deletionRequestedAt ?? null,
    scheduledPurgeAt: tenant?.deletionScheduledAt ?? null,
    requestedByUserId: tenant?.deletionRequestedByUserId ?? null,
    reason: tenant?.deletionReason ?? null,
  };
}

// ─── Request deletion ───────────────────────────────────────────────────────

export async function requestTenantDeletion(
  params: RequestTenantDeletionParams,
): Promise<DeletionStatus> {
  const { tenantId, userId, reason } = params;
  const now = new Date();
  const scheduledPurgeAt = new Date(now.getTime() + GRACE_PERIOD_MS);

  // 1. Mark tenant pending deletion and deactivate it.
  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({
        deletionRequestedAt: now,
        deletionScheduledAt: scheduledPurgeAt,
        deletionRequestedByUserId: userId,
        deletionReason: reason ?? null,
        isActive: false,
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));
  });

  // 2. Cancel Stripe subscription at period end (best-effort — log but don't fail).
  try {
    const tenantSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId));

    if (stripe) {
      for (const sub of tenantSubscriptions) {
        if (sub.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
            await db
              .update(subscriptions)
              .set({ cancelAtPeriodEnd: true, updatedAt: now })
              .where(eq(subscriptions.id, sub.id));
          } catch (err) {
            console.error(
              `[TenantDeletion] Failed to cancel Stripe subscription ${sub.stripeSubscriptionId}:`,
              err,
            );
          }
        }
      }
    }
  } catch (err) {
    console.error(`[TenantDeletion] Stripe cleanup error for tenant ${tenantId}:`, err);
  }

  // 3. Invalidate every session in this tenant and bump tokenValidAfter on every user.
  try {
    const tenantUsers = await db
      .select({ id: betterAuthUser.id, email: betterAuthUser.email })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId));

    for (const user of tenantUsers) {
      await db.delete(betterAuthSession).where(eq(betterAuthSession.userId, user.id));
      await db
        .update(betterAuthUser)
        .set({ tokenValidAfter: now, updatedAt: now })
        .where(eq(betterAuthUser.id, user.id));
      invalidateUserSecurity(user.id, 'status_change', { tenantId });
    }

    invalidateTenantSecurity(tenantId);
    invalidateTenantPlanCache(tenantId);

    // 4. Send confirmation email to Owner (best-effort).
    const owner = tenantUsers.find((u) => u.id === userId) || tenantUsers[0];
    if (owner?.email) {
      try {
        await enhancedEmailService.sendCustomEmail(
          owner.email,
          'Your account is scheduled for deletion',
          buildDeletionRequestedEmailHtml(scheduledPurgeAt),
          { metadata: { type: 'account_deletion_requested', tenantId } },
        );
      } catch (err) {
        console.error('[TenantDeletion] Failed to send deletion requested email:', err);
      }
    }
  } catch (err) {
    console.error(`[TenantDeletion] Session invalidation error for tenant ${tenantId}:`, err);
  }

  // 5. Audit log.
  try {
    await logActivity({
      tenantId,
      userId,
      entityType: 'tenant',
      entityId: tenantId,
      activityType: 'deletion_requested',
      description: `Account deletion scheduled for ${scheduledPurgeAt.toISOString()}`,
      metadata: { reason: reason ?? null, scheduledPurgeAt: scheduledPurgeAt.toISOString() },
    });
  } catch (err) {
    console.error('[TenantDeletion] Activity log error:', err);
  }

  return {
    pending: true,
    requestedAt: now,
    scheduledPurgeAt,
    requestedByUserId: userId,
    reason: reason ?? null,
  };
}

// ─── Cancel deletion ────────────────────────────────────────────────────────

export async function cancelTenantDeletion(tenantId: string): Promise<DeletionStatus> {
  const now = new Date();

  // Only reactivate tenants that are actually pending — never touch a tenant
  // whose scheduled purge has already run or was never requested.
  const [existing] = await db
    .select({
      deletionRequestedByUserId: tenants.deletionRequestedByUserId,
      deletionScheduledAt: tenants.deletionScheduledAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!existing?.deletionScheduledAt) {
    return {
      pending: false,
      requestedAt: null,
      scheduledPurgeAt: null,
      requestedByUserId: null,
      reason: null,
    };
  }

  await db
    .update(tenants)
    .set({
      deletionRequestedAt: null,
      deletionScheduledAt: null,
      deletionRequestedByUserId: null,
      deletionReason: null,
      isActive: true,
      updatedAt: now,
    })
    .where(eq(tenants.id, tenantId));

  invalidateTenantSecurity(tenantId);
  invalidateTenantPlanCache(tenantId);

  // Notify the Owner that deletion was cancelled.
  try {
    if (existing.deletionRequestedByUserId) {
      const owner = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, existing.deletionRequestedByUserId),
        columns: { email: true },
      });
      if (owner?.email) {
        await enhancedEmailService.sendCustomEmail(
          owner.email,
          'Your account deletion was cancelled',
          buildDeletionCancelledEmailHtml(),
          { metadata: { type: 'account_deletion_cancelled', tenantId } },
        );
      }
    }
  } catch (err) {
    console.error('[TenantDeletion] Failed to send cancellation email:', err);
  }

  try {
    await logActivity({
      tenantId,
      userId: existing.deletionRequestedByUserId || undefined,
      entityType: 'tenant',
      entityId: tenantId,
      activityType: 'deletion_cancelled',
      description: 'Account deletion cancelled by Owner',
    });
  } catch (err) {
    console.error('[TenantDeletion] Activity log error:', err);
  }

  return {
    pending: false,
    requestedAt: null,
    scheduledPurgeAt: null,
    requestedByUserId: null,
    reason: null,
  };
}

// ─── Purge ─────────────────────────────────────────────────────────────────

/**
 * Hard-delete a tenant and every record that references it.
 * Called by the scheduled purge worker after the grace period expires.
 *
 * Steps:
 *   1. Send final "account deleted" email to the Owner (while we still have the email).
 *   2. Best-effort R2 cleanup: known URLs first, then tenant-scoped prefixes.
 *   3. Anonymize non-cascaded rows (activity_logs, bounced_emails, Convex mirrors).
 *   4. DELETE FROM tenants → DB fans out via FK cascade to ~40 tables.
 *   5. Return cleanup stats for logging/monitoring.
 */
export async function purgeTenant(tenantId: string): Promise<{
  success: boolean;
  r2Deleted: number;
  r2Errors: number;
}> {
  console.log(`[TenantDeletion] Starting purge for tenant ${tenantId}`);

  // ── 1. Final email (before we lose the Owner's email address) ──────────────
  let ownerEmail: string | undefined;
  try {
    const tenantInfo = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { name: true, deletionRequestedByUserId: true },
    });

    if (tenantInfo?.deletionRequestedByUserId) {
      const owner = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, tenantInfo.deletionRequestedByUserId),
        columns: { email: true },
      });
      ownerEmail = owner?.email;
    }
    if (!ownerEmail) {
      // Fall back to any Owner in the tenant.
      const anyOwner = await db
        .select({ email: betterAuthUser.email })
        .from(betterAuthUser)
        .where(and(eq(betterAuthUser.tenantId, tenantId), eq(betterAuthUser.role, 'Owner')))
        .limit(1);
      ownerEmail = anyOwner[0]?.email;
    }

    if (ownerEmail) {
      try {
        await enhancedEmailService.sendCustomEmail(
          ownerEmail,
          'Your account has been permanently deleted',
          buildDeletionCompletedEmailHtml(tenantInfo?.name || 'your account'),
          { metadata: { type: 'account_deletion_completed', tenantId } },
        );
      } catch (err) {
        console.error('[TenantDeletion] Failed to send final deletion email:', err);
      }
    }
  } catch (err) {
    console.error('[TenantDeletion] Final email lookup failed:', err);
  }

  // ── 2. R2 cleanup ──────────────────────────────────────────────────────────
  let r2Deleted = 0;
  let r2Errors = 0;

  try {
    // 2a. Known, directly-stored image URLs (shops, master_email_design).
    const tenantShops = await db
      .select({ logoUrl: shops.logoUrl, bannerUrl: shops.bannerUrl })
      .from(shops)
      .where(eq(shops.tenantId, tenantId));

    for (const shop of tenantShops) {
      if (shop.logoUrl) {
        await deleteImageFromR2(shop.logoUrl);
        r2Deleted++;
      }
      if (shop.bannerUrl) {
        await deleteImageFromR2(shop.bannerUrl);
        r2Deleted++;
      }
    }

    const designs = await db
      .select({ logoUrl: masterEmailDesign.logoUrl, bannerUrl: masterEmailDesign.bannerUrl })
      .from(masterEmailDesign)
      .where(eq(masterEmailDesign.tenantId, tenantId));

    for (const design of designs) {
      if (design.logoUrl) {
        await deleteImageFromR2(design.logoUrl);
        r2Deleted++;
      }
      if (design.bannerUrl) {
        await deleteImageFromR2(design.bannerUrl);
        r2Deleted++;
      }
    }

    // 2b. Tenant-scoped prefixes — catches card images, newsletter images,
    //     newsletter logos, and newsletter asset rehosts.
    const prefixes = [
      `card-images/${tenantId}/`,
      `newsletter-images/${tenantId}/`,
      `newsletter-logos/${tenantId}/`,
      `newsletter-assets/${tenantId}/`,
    ];
    for (const prefix of prefixes) {
      const result = await deleteR2Prefix(prefix);
      r2Deleted += result.deleted;
      r2Errors += result.errors;
    }

    // 2c. User avatars — keyed by userId, not tenantId. Delete each user's avatar individually.
    const tenantUsers = await db
      .select({ avatarUrl: betterAuthUser.avatarUrl })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId));

    for (const user of tenantUsers) {
      if (user.avatarUrl) {
        await deleteImageFromR2(user.avatarUrl);
        r2Deleted++;
      }
    }
  } catch (err) {
    console.error(`[TenantDeletion] R2 cleanup error for tenant ${tenantId}:`, err);
    r2Errors++;
  }

  // ── 3. Handle non-cascaded records ─────────────────────────────────────────
  // Note: activity_logs.tenantId is NOT NULL with FK CASCADE, so those rows
  // will be wiped automatically by the tenant delete (step 4). Preserving
  // them across tenant deletion would require making tenantId nullable.
  //
  // bounced_emails: the FK has no ON DELETE action, so we MUST null these
  // refs before deleting the tenant or the delete will fail. Keeping the
  // rows preserves the global bounce suppression list for other tenants.
  try {
    await db
      .update(bouncedEmails)
      .set({
        sourceTenantId: null,
        sourceNewsletterId: null,
        sourceCampaignId: null,
      })
      .where(eq(bouncedEmails.sourceTenantId, tenantId));
  } catch (err) {
    console.error('[TenantDeletion] bounced_emails anonymize error:', err);
  }

  // role_permissions: no FK, delete outright (tenant-specific config)
  try {
    await db.delete(rolePermissions).where(eq(rolePermissions.tenantId, tenantId));
  } catch (err) {
    console.error('[TenantDeletion] role_permissions cleanup error:', err);
  }

  // Convex mirror tables: no FK, manual cascade
  try {
    await db.delete(convexNewsletterSends).where(eq(convexNewsletterSends.tenantId, tenantId));
    await db.delete(convexNewsletterEvents).where(eq(convexNewsletterEvents.tenantId, tenantId));
    await db.delete(convexNewsletterStats).where(eq(convexNewsletterStats.tenantId, tenantId));
  } catch (err) {
    console.error('[TenantDeletion] Convex mirror cleanup error:', err);
  }

  // ── 4. Hard delete the tenant row ──────────────────────────────────────────
  // DB FK cascade fans this out to shops, contacts, newsletters, forms, etc.
  try {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  } catch (err) {
    console.error(`[TenantDeletion] Hard delete failed for tenant ${tenantId}:`, err);
    return { success: false, r2Deleted, r2Errors };
  }

  invalidateTenantSecurity(tenantId);
  invalidateTenantPlanCache(tenantId);

  // ── 5. Final audit log (anonymous — tenant is gone, so no tenantId/userId) ──
  console.log(
    `[TenantDeletion] Purge complete for tenant ${tenantId} — r2Deleted: ${r2Deleted}, r2Errors: ${r2Errors}`,
  );

  return { success: true, r2Deleted, r2Errors };
}

// ─── Email templates ────────────────────────────────────────────────────────

function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
      .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>${title}</h1></div>
      <div class="content">${body}</div>
      <div class="footer">If you did not request this, please contact support immediately.</div>
    </div>
  </body>
</html>`;
}

function buildDeletionRequestedEmailHtml(scheduledPurgeAt: Date): string {
  const dateStr = scheduledPurgeAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return emailShell(
    'Your account is scheduled for deletion',
    `<p>We received a request to delete your account.</p>
     <p><strong>Your account and all associated data will be permanently deleted on ${dateStr}.</strong></p>
     <p>Your subscription has been set to cancel at the end of the current billing period. All active sessions have been signed out.</p>
     <p>If you change your mind, log back in to your account within the next ${GRACE_PERIOD_DAYS} days and click <em>Cancel Deletion</em> on your Profile → Danger Zone tab.</p>`,
  );
}

function buildDeletionCancelledEmailHtml(): string {
  return emailShell(
    'Your account deletion was cancelled',
    `<p>Good news — the pending deletion of your account has been cancelled.</p>
     <p>Your account is fully active again. Welcome back!</p>`,
  );
}

function buildDeletionCompletedEmailHtml(accountName: string): string {
  return emailShell(
    'Your account has been permanently deleted',
    `<p>This email confirms that <strong>${accountName}</strong> and all associated data have been permanently deleted from our systems.</p>
     <p>Thank you for having been part of our platform.</p>`,
  );
}
