/**
 * Account routes — self-service tenant deletion & data export.
 *
 * All endpoints require Owner (billing.delete_account permission).
 *
 *   GET  /api/account/deletion-status   — poll pending deletion state
 *   GET  /api/account/export            — download JSON export of tenant data
 *   POST /api/account/delete            — request tenant deletion (password required)
 *   POST /api/account/cancel-deletion   — cancel a pending deletion (grace period)
 */

import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  betterAuthUser,
  betterAuthAccount,
  tenants,
  shops,
  emailContacts,
  emailLists,
  newsletters,
  forms,
  formResponses,
  templates,
  appointments,
  campaigns,
} from '@shared/schema';
import { authenticateToken, requireTenant, requirePermission } from '../middleware/auth-middleware';
import {
  requestTenantDeletion,
  cancelTenantDeletion,
  getDeletionStatus,
} from '../services/tenantDeletionService';

export const accountRoutes = Router();

// ─── Status ──────────────────────────────────────────────────────────────────

accountRoutes.get('/deletion-status', authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const status = await getDeletionStatus(tenantId);
    res.json(status);
  } catch (err) {
    console.error('[Account] deletion-status error:', err);
    res.status(500).json({ message: 'Failed to fetch deletion status' });
  }
});

// ─── Data export ────────────────────────────────────────────────────────────

accountRoutes.get(
  '/export',
  authenticateToken,
  requireTenant,
  requirePermission('billing.delete_account'),
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Pull every tenant-scoped entity the user would reasonably want back.
      const [
        tenant,
        tenantUsers,
        tenantShops,
        contacts,
        lists,
        tenantNewsletters,
        tenantForms,
        tenantFormResponses,
        tenantTemplates,
        tenantAppointments,
        tenantCampaigns,
      ] = await Promise.all([
        db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }),
        db
          .select({
            id: betterAuthUser.id,
            email: betterAuthUser.email,
            firstName: betterAuthUser.firstName,
            lastName: betterAuthUser.lastName,
            role: betterAuthUser.role,
            createdAt: betterAuthUser.createdAt,
          })
          .from(betterAuthUser)
          .where(eq(betterAuthUser.tenantId, tenantId)),
        db.select().from(shops).where(eq(shops.tenantId, tenantId)),
        db.select().from(emailContacts).where(eq(emailContacts.tenantId, tenantId)),
        db.select().from(emailLists).where(eq(emailLists.tenantId, tenantId)),
        db.select().from(newsletters).where(eq(newsletters.tenantId, tenantId)),
        db.select().from(forms).where(eq(forms.tenantId, tenantId)),
        db.select().from(formResponses).where(eq(formResponses.tenantId, tenantId)),
        db.select().from(templates).where(eq(templates.tenantId, tenantId)),
        db.select().from(appointments).where(eq(appointments.tenantId, tenantId)),
        db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId)),
      ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.email,
        tenant,
        users: tenantUsers,
        shops: tenantShops,
        contacts,
        emailLists: lists,
        newsletters: tenantNewsletters,
        forms: tenantForms,
        formResponses: tenantFormResponses,
        templates: tenantTemplates,
        appointments: tenantAppointments,
        campaigns: tenantCampaigns,
      };

      const filename = `account-export-${tenantId}-${Date.now()}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(exportPayload, null, 2));
    } catch (err) {
      console.error('[Account] export error:', err);
      res.status(500).json({ message: 'Failed to export account data' });
    }
  },
);

// ─── Request deletion ───────────────────────────────────────────────────────

accountRoutes.post(
  '/delete',
  authenticateToken,
  requireTenant,
  requirePermission('billing.delete_account'),
  async (req: any, res) => {
    try {
      const { password, confirmText, reason } = req.body || {};

      if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: 'Password is required' });
      }

      if (confirmText !== 'Delete Account') {
        return res
          .status(400)
          .json({ message: 'Please type "Delete Account" to confirm' });
      }

      const userId = req.user.id;
      const tenantId = req.user.tenantId;

      // Re-verify the Owner's password against their Better Auth credential account.
      const [credentialAccount] = await db
        .select()
        .from(betterAuthAccount)
        .where(
          and(
            eq(betterAuthAccount.userId, userId),
            eq(betterAuthAccount.providerId, 'credential'),
          ),
        )
        .limit(1);

      if (!credentialAccount?.password) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      const { verifyPassword } = await import('better-auth/crypto');
      const passwordValid = await verifyPassword({
        password,
        hash: credentialAccount.password,
      });

      if (!passwordValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      // Already pending? Return the existing schedule (idempotent).
      const existing = await getDeletionStatus(tenantId);
      if (existing.pending) {
        return res.json(existing);
      }

      const status = await requestTenantDeletion({
        tenantId,
        userId,
        reason: typeof reason === 'string' ? reason.slice(0, 1000) : undefined,
      });

      res.json(status);
    } catch (err) {
      console.error('[Account] delete error:', err);
      res.status(500).json({ message: 'Failed to schedule account deletion' });
    }
  },
);

// ─── Cancel deletion ────────────────────────────────────────────────────────

accountRoutes.post(
  '/cancel-deletion',
  authenticateToken,
  requireTenant,
  requirePermission('billing.delete_account'),
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const status = await cancelTenantDeletion(tenantId);
      res.json(status);
    } catch (err) {
      console.error('[Account] cancel-deletion error:', err);
      res.status(500).json({ message: 'Failed to cancel deletion' });
    }
  },
);
