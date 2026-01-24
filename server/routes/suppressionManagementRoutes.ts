import { Router } from 'express';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { db } from '../db';
import { bouncedEmails, emailContacts } from '@shared/schema';
import { eq, and, sql, count, inArray, ilike } from 'drizzle-orm';

export const suppressionManagementRoutes = Router();

// Get suppression statistics for debugging
suppressionManagementRoutes.get("/stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Get total suppressed emails
    const [totalSuppressed] = await db
      .select({ count: count() })
      .from(bouncedEmails)
      .where(eq(bouncedEmails.isActive, true));

    // Get total active email contacts for this tenant
    const [totalContacts] = await db
      .select({ count: count() })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.tenantId, req.user.tenantId),
        eq(emailContacts.status, 'active')
      ));

    // Get suppressed emails by type
    const suppressedByType = await db
      .select({ 
        type: bouncedEmails.bounceType, 
        count: count() 
      })
      .from(bouncedEmails)
      .where(eq(bouncedEmails.isActive, true))
      .groupBy(bouncedEmails.bounceType);

    // Get contacts that are suppressed for this tenant
    const suppressedContactsForTenant = await db
      .select({ 
        email: emailContacts.email,
        status: emailContacts.status,
        suppressionReason: bouncedEmails.reason,
        suppressionType: bouncedEmails.bounceType,
        suppressedAt: bouncedEmails.bouncedAt
      })
      .from(emailContacts)
      .leftJoin(bouncedEmails, 
        sql`${emailContacts.email} = ${bouncedEmails.email} AND ${bouncedEmails.isActive} = true`
      )
      .where(and(
        eq(emailContacts.tenantId, req.user.tenantId),
        eq(emailContacts.status, 'active')
      ));

    const suppressedContacts = suppressedContactsForTenant.filter(contact => contact.suppressionReason);

    res.json({
      status: 'success',
      statistics: {
        totalSuppressedGlobally: totalSuppressed.count,
        totalActiveContacts: totalContacts.count,
        suppressedContactsForTenant: suppressedContacts.length,
        suppressionRate: totalContacts.count > 0 ? 
          Math.round((suppressedContacts.length / totalContacts.count) * 100) : 0,
        suppressedByType: suppressedByType,
      },
      suppressedContacts: suppressedContacts.slice(0, 50), // First 50 for preview
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get suppression stats error:', error);
    res.status(500).json({ 
      message: 'Failed to get suppression statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all suppressed emails (paginated)
suppressionManagementRoutes.get("/list", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search = '', type = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereConditions = [eq(bouncedEmails.isActive, true)];
    
    if (search) {
      whereConditions.push(ilike(bouncedEmails.email, `%${search}%`));
    }
    
    if (type) {
      whereConditions.push(eq(bouncedEmails.bounceType, type as string));
    }

    const suppressedEmails = await db
      .select({
        id: bouncedEmails.id,
        email: bouncedEmails.email,
        reason: bouncedEmails.reason,
        bounceType: bouncedEmails.bounceType,
        bouncedAt: bouncedEmails.bouncedAt,
        description: bouncedEmails.description,
      })
      .from(bouncedEmails)
      .where(and(...whereConditions))
      .orderBy(bouncedEmails.bouncedAt)
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: count() })
      .from(bouncedEmails)
      .where(and(...whereConditions));

    res.json({
      status: 'success',
      data: suppressedEmails,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / parseInt(limit as string)),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get suppressed emails error:', error);
    res.status(500).json({ 
      message: 'Failed to get suppressed emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Remove email from suppression list (admin only)
suppressionManagementRoutes.delete("/remove/:email", authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'Owner' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    const { email } = req.params;
    const { reason = 'Manually removed by admin' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if email exists in suppression list
    const existingSuppression = await db.query.bouncedEmails.findFirst({
      where: and(
        eq(bouncedEmails.email, emailLower),
        eq(bouncedEmails.isActive, true)
      ),
    });

    if (!existingSuppression) {
      return res.status(404).json({ message: 'Email not found in suppression list' });
    }

    // Deactivate the suppression record (soft delete)
    await db
      .update(bouncedEmails)
      .set({
        isActive: false,
        description: `${existingSuppression.description || ''} - ${reason}`,
        updatedAt: new Date(),
      })
      .where(eq(bouncedEmails.id, existingSuppression.id));

    console.log(`[Suppression] Admin ${req.user.email} removed ${emailLower} from suppression list: ${reason}`);

    res.json({
      status: 'success',
      message: 'Email removed from suppression list',
      email: emailLower,
      removedBy: req.user.email,
      reason,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Remove suppression error:', error);
    res.status(500).json({ 
      message: 'Failed to remove email from suppression list',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk remove emails from suppression list (admin only)
suppressionManagementRoutes.post("/bulk-remove", authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'Owner' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    const { emails, reason = 'Bulk removal by admin' } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'Emails array is required' });
    }

    if (emails.length > 100) {
      return res.status(400).json({ message: 'Cannot remove more than 100 emails at once' });
    }

    const emailsLower = emails.map(email => email.toLowerCase().trim());

    // Get existing suppression records
    const existingSuppressions = await db
      .select()
      .from(bouncedEmails)
      .where(and(
        inArray(bouncedEmails.email, emailsLower),
        eq(bouncedEmails.isActive, true)
      ));

    if (existingSuppressions.length === 0) {
      return res.status(404).json({ message: 'No matching emails found in suppression list' });
    }

    // Deactivate the suppression records
    await db
      .update(bouncedEmails)
      .set({
        isActive: false,
        description: sql`COALESCE(${bouncedEmails.description}, '') || ' - ' || ${reason}`,
        updatedAt: new Date(),
      })
      .where(inArray(bouncedEmails.id, existingSuppressions.map(s => s.id)));

    console.log(`[Suppression] Admin ${req.user.email} bulk removed ${existingSuppressions.length} emails from suppression list: ${reason}`);

    res.json({
      status: 'success',
      message: `${existingSuppressions.length} emails removed from suppression list`,
      removedEmails: existingSuppressions.map(s => s.email),
      removedBy: req.user.email,
      reason,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Bulk remove suppression error:', error);
    res.status(500).json({ 
      message: 'Failed to bulk remove emails from suppression list',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear all suppressions (emergency admin function)
suppressionManagementRoutes.post("/clear-all", authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'Owner') {
      return res.status(403).json({ message: 'Only owners can clear all suppressions' });
    }

    const { confirmationCode, reason = 'Emergency clearance by owner' } = req.body;

    // Require confirmation code for this dangerous operation
    if (confirmationCode !== 'CLEAR_ALL_SUPPRESSIONS') {
      return res.status(400).json({ 
        message: 'Invalid confirmation code. Use CLEAR_ALL_SUPPRESSIONS to confirm this action.' 
      });
    }

    // Get count before clearing
    const [beforeCount] = await db
      .select({ count: count() })
      .from(bouncedEmails)
      .where(eq(bouncedEmails.isActive, true));

    // Deactivate all suppression records
    await db
      .update(bouncedEmails)
      .set({
        isActive: false,
        description: sql`COALESCE(${bouncedEmails.description}, '') || ' - ' || ${reason}`,
        updatedAt: new Date(),
      })
      .where(eq(bouncedEmails.isActive, true));

    console.log(`[Suppression] EMERGENCY: Owner ${req.user.email} cleared ALL ${beforeCount.count} suppressions: ${reason}`);

    res.json({
      status: 'success',
      message: `All ${beforeCount.count} suppression records have been cleared`,
      clearedCount: beforeCount.count,
      clearedBy: req.user.email,
      reason,
      timestamp: new Date().toISOString(),
      warning: 'All email suppressions have been cleared. Monitor bounce rates carefully.',
    });

  } catch (error) {
    console.error('Clear all suppressions error:', error);
    res.status(500).json({ 
      message: 'Failed to clear all suppressions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check specific email suppression status
suppressionManagementRoutes.get("/check/:email", authenticateToken, async (req: any, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check suppression status
    const suppression = await db.query.bouncedEmails.findFirst({
      where: and(
        eq(bouncedEmails.email, emailLower),
        eq(bouncedEmails.isActive, true)
      ),
    });

    // Check if this email exists as a contact for this tenant
    const contact = await db.query.emailContacts.findFirst({
      where: and(
        eq(emailContacts.email, emailLower),
        eq(emailContacts.tenantId, req.user.tenantId)
      ),
    });

    res.json({
      status: 'success',
      email: emailLower,
      isSuppressed: !!suppression,
      isContact: !!contact,
      suppressionDetails: suppression ? {
        reason: suppression.reason,
        bounceType: suppression.bounceType,
        description: suppression.description,
        suppressedAt: suppression.bouncedAt,
        id: suppression.id,
      } : null,
      contactDetails: contact ? {
        id: contact.id,
        status: contact.status,
        firstName: contact.firstName,
        lastName: contact.lastName,
        newsletterEnabled: contact.newsletterEnabled,
      } : null,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Check email suppression error:', error);
    res.status(500).json({ 
      message: 'Failed to check email suppression status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default suppressionManagementRoutes;

