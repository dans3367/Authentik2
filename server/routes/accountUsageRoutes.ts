import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth-middleware';
import { storage } from '../storage';
import { db } from '../db';
import { 
  emailContacts, 
  emailLists, 
  forms, 
  newsletters, 
  campaigns,
  appointments,
  contactTags
} from '@shared/schema';
import { eq, count, and, gte, sql } from 'drizzle-orm';

export const accountUsageRoutes = Router();

// Get comprehensive account usage data
accountUsageRoutes.get('/', authenticateToken, requirePermission('account_usage.view'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Fetch all usage data in parallel
    const [
      shopLimits,
      userLimits,
      emailLimits,
      contactCount,
      listCount,
      formCount,
      newsletterCount,
      campaignCount,
      appointmentCount,
      tagCount,
      subscription
    ] = await Promise.all([
      storage.checkShopLimits(tenantId),
      storage.checkUserLimits(tenantId),
      storage.checkEmailLimits(tenantId),
      db.select({ count: count() }).from(emailContacts).where(eq(emailContacts.tenantId, tenantId)),
      db.select({ count: count() }).from(emailLists).where(eq(emailLists.tenantId, tenantId)),
      db.select({ count: count() }).from(forms).where(eq(forms.tenantId, tenantId)),
      db.select({ count: count() }).from(newsletters).where(eq(newsletters.tenantId, tenantId)),
      db.select({ count: count() }).from(campaigns).where(eq(campaigns.tenantId, tenantId)),
      db.select({ count: count() }).from(appointments).where(eq(appointments.tenantId, tenantId)),
      db.select({ count: count() }).from(contactTags).where(eq(contactTags.tenantId, tenantId)),
      storage.getTenantSubscription(tenantId)
    ]);

    // Calculate period info for email usage
    let periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
    
    let periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(0); // Last day of current month

    if (subscription?.currentPeriodStart && subscription?.currentPeriodEnd) {
      periodStart = new Date(subscription.currentPeriodStart);
      periodEnd = new Date(subscription.currentPeriodEnd);
    }

    res.json({
      subscription: subscription ? {
        planName: subscription.plan.displayName || subscription.plan.name,
        status: subscription.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd
      } : {
        planName: 'Basic (Free)',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd
      },
      usage: {
        shops: {
          current: shopLimits.currentShops,
          limit: shopLimits.maxShops,
          canAdd: shopLimits.canAddShop,
          isCustomLimit: shopLimits.isCustomLimit || false
        },
        users: {
          current: userLimits.currentUsers,
          limit: userLimits.maxUsers,
          canAdd: userLimits.canAddUser
        },
        emails: {
          current: emailLimits.currentUsage,
          limit: emailLimits.monthlyLimit,
          remaining: emailLimits.remaining,
          canSend: emailLimits.canSend,
          periodLabel: 'This billing period'
        },
        contacts: {
          current: contactCount[0]?.count || 0,
          limit: null // Unlimited in most plans
        },
        lists: {
          current: listCount[0]?.count || 0,
          limit: null
        },
        forms: {
          current: formCount[0]?.count || 0,
          limit: null
        },
        newsletters: {
          current: newsletterCount[0]?.count || 0,
          limit: null
        },
        campaigns: {
          current: campaignCount[0]?.count || 0,
          limit: null
        },
        appointments: {
          current: appointmentCount[0]?.count || 0,
          limit: null
        },
        tags: {
          current: tagCount[0]?.count || 0,
          limit: null
        }
      }
    });
  } catch (error) {
    console.error('Get account usage error:', error);
    res.status(500).json({ message: 'Failed to get account usage data' });
  }
});
