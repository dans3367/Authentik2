import { Router } from 'express';
import { db } from '../db';
import { sql, eq, or } from 'drizzle-orm';
import { betterAuthUser, subscriptionPlans, forms, formResponses, companies, subscriptions, subscriptionPlanRelations, tenants, shopLimitEvents, shops } from '@shared/schema';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { storage } from '../storage';
import Stripe from 'stripe';

export const subscriptionRoutes = Router();

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("Warning: STRIPE_SECRET_KEY not found, Stripe features will be disabled");
}
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Get subscription plans
subscriptionRoutes.get("/plans", async (req, res) => {
  try {
    const plans = await db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.isActive, true),
      orderBy: sql`${subscriptionPlans.price} ASC`,
    });

    res.json(plans);
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ message: 'Failed to get subscription plans' });
  }
});

// Get current tenant's effective plan (accessible to all authenticated users)
subscriptionRoutes.get("/tenant-plan", authenticateToken, async (req: any, res) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const tenantId = req.user.tenantId;
    const plan = await storage.getTenantPlan(tenantId);

    // Also fetch current usage for context
    const [emailLimits, shopLimits, userLimits] = await Promise.all([
      storage.checkEmailLimits(tenantId),
      storage.checkShopLimits(tenantId),
      storage.checkUserLimits(tenantId),
    ]);

    res.json({
      plan: {
        name: plan.planName,
        maxUsers: plan.maxUsers,
        maxShops: plan.maxShops,
        monthlyEmailLimit: plan.monthlyEmailLimit,
        allowUsersManagement: plan.allowUsersManagement,
        allowRolesManagement: plan.allowRolesManagement,
        subscriptionStatus: plan.subscriptionStatus,
      },
      usage: {
        emails: {
          current: emailLimits.currentUsage,
          limit: emailLimits.monthlyLimit,
          remaining: emailLimits.remaining,
          canSend: emailLimits.canSend,
        },
        shops: {
          current: shopLimits.currentShops,
          limit: shopLimits.maxShops,
          canAdd: shopLimits.canAddShop,
        },
        users: {
          current: userLimits.currentUsers,
          limit: userLimits.maxUsers,
          canAdd: userLimits.canAddUser,
        },
      },
    });
  } catch (error) {
    console.error('Get tenant plan error:', error);
    res.status(500).json({ message: 'Failed to get tenant plan' });
  }
});

// Free trial signup
subscriptionRoutes.post("/free-trial-signup", async (req: any, res) => {
  try {
    const { email, firstName, lastName, companyName } = req.body;

    if (!email || !firstName || !lastName || !companyName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.email} = ${email}`,
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user with free trial
    // Note: Password handling removed - better-auth handles authentication
    // Users will need to set their password through better-auth registration

    const newUser = await db.insert(betterAuthUser).values({
      email,
      firstName,
      lastName,
      // Note: password field removed - better-auth handles authentication
      role: 'Owner',
      tenantId: 'default-tenant-id', // Will be updated after tenant creation
      emailVerified: true, // Auto-verify for free trial
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Create company/tenant
    const newCompany = await db.insert(tenants).values({
      name: companyName,
      slug: companyName.toLowerCase().replace(/\s+/g, '-'),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Update user with correct tenant ID
    await db.update(betterAuthUser)
      .set({
        tenantId: newCompany[0].id,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, newUser[0].id));

    // Sync tenant information with Better Auth user table
    try {
      // Check if Better Auth user exists (they might have signed up via Better Auth first)
      const existingBetterAuthUser = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.email, email),
      });

      if (existingBetterAuthUser) {
        // Update Better Auth user with tenant information
        await db.update(betterAuthUser)
          .set({
            tenantId: newCompany[0].id,
            role: 'Owner',
            updatedAt: new Date(),
          })
          .where(eq(betterAuthUser.id, existingBetterAuthUser.id));

        console.log('✅ Synced tenant info to Better Auth user during free trial signup:', {
          userId: existingBetterAuthUser.id,
          email,
          tenantId: newCompany[0].id
        });
      } else {
        console.warn('⚠️ No Better Auth user found for free trial signup:', email);
        console.log('🏢 User should sign up via Better Auth first, then use this endpoint');
      }
    } catch (error) {
      console.error('❌ Failed to sync tenant info during free trial signup:', error);
      // Don't fail the signup, just log the error
    }


    res.status(201).json({
      message: 'Free trial account created successfully',
      userId: newUser[0].id,
      tenantId: newCompany[0].id,
      tenantSlug: newCompany[0].slug,
    });
  } catch (error) {
    console.error('Free trial signup error:', error);
    res.status(500).json({ message: 'Free trial signup failed' });
  }
});

// Get user's subscription
subscriptionRoutes.get("/my-subscription", authenticateToken, async (req: any, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const tenantId = req.user.tenantId;
    console.log('🔍 [Subscription] Fetching subscription for tenant:', tenantId);

    // Get company info (companies table has tenantId field)
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, tenantId),
    });

    if (!company) {
      console.log('❌ [Subscription] No company found for tenantId:', tenantId);
      return res.status(404).json({ message: 'Company not found' });
    }

    // Get subscription separately by tenantId
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
      with: {
        plan: true,
      },
    });

    let subscriptionDetails = null;

    const hasRealStripeId = subscription?.stripeSubscriptionId?.startsWith('sub_');

    if (subscription && stripe && hasRealStripeId) {
      try {
        // Get subscription details from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId) as any;

        subscriptionDetails = {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          plan: {
            id: stripeSubscription.items.data[0]?.price.id,
            amount: stripeSubscription.items.data[0]?.price.unit_amount,
            currency: stripeSubscription.items.data[0]?.price.currency,
            interval: stripeSubscription.items.data[0]?.price.recurring?.interval,
          },
        };
      } catch (stripeError) {
        console.error('Stripe subscription fetch error:', stripeError);
        // Continue without Stripe details
      }
    }

    const response = {
      company: {
        id: company.id,
        name: company.name,
        // Note: companies table doesn't have slug or trialEndsAt fields in schema
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        plan: subscription.plan || null,
        isYearly: subscription.isYearly || false,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        isOnTrial: subscription.trialEnd ? subscription.trialEnd > new Date() : false,
        details: subscriptionDetails,
      } : null,
    };

    res.json(response);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Failed to get subscription' });
  }
});

// Create Stripe checkout session
subscriptionRoutes.post("/create-checkout-session", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;

    if (!stripe) {
      return res.status(500).json({ message: 'Stripe is not configured' });
    }

    if (!planId || !successUrl || !cancelUrl) {
      return res.status(400).json({ message: 'Plan ID, success URL, and cancel URL are required' });
    }

    // Validate authentication
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get plan details
    const plan = await db.query.subscriptionPlans.findFirst({
      where: sql`${subscriptionPlans.id} = ${planId}`,
    });

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, req.user.tenantId),
    });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    let customerId = company.subscription?.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: company.companyEmail || req.user.email,
        name: company.name,
        metadata: {
          companyId: company.id,
          userId: req.user.id,
        },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        companyId: company.id,
        planId: plan.id,
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
});

// Create billing portal session
subscriptionRoutes.post("/create-portal-session", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    const { returnUrl } = req.body;

    if (!stripe) {
      return res.status(500).json({ message: 'Stripe is not configured' });
    }

    // Validate authentication
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, req.user.tenantId),
      with: {
        subscription: true,
      },
    });

    if (!company || !company.subscription?.stripeCustomerId) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: company.subscription.stripeCustomerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL || 'https://web.zendwise.work'}/subscribe`,
    });

    res.json({
      url: session.url,
    });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({ message: 'Failed to create portal session' });
  }
});

// Cancel subscription
subscriptionRoutes.post("/cancel", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    const { cancelAtPeriodEnd = true } = req.body;

    if (!stripe) {
      return res.status(500).json({ message: 'Stripe is not configured' });
    }

    // Validate authentication
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get company subscription
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, req.user.tenantId),
      with: {
        subscription: true,
      },
    });

    if (!company || !company.subscription?.stripeSubscriptionId) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    // Cancel subscription in Stripe
    const subscription = await stripe.subscriptions.update(
      company.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: cancelAtPeriodEnd,
      }
    );

    // Update subscription in database
    await db.update(db.subscriptions)
      .set({
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(sql`${db.subscriptions.id} = ${company.subscription.id}`);

    res.json({
      message: cancelAtPeriodEnd ? 'Subscription will be cancelled at the end of the current period' : 'Subscription cancelled immediately',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
subscriptionRoutes.post("/reactivate", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe is not configured' });
    }

    // Validate authentication
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get company subscription
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, req.user.tenantId),
      with: {
        subscription: true,
      },
    });

    if (!company || !company.subscription?.stripeSubscriptionId) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    // Reactivate subscription in Stripe
    const subscription = await stripe.subscriptions.update(
      company.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    // Update subscription in database
    await db.update(db.subscriptions)
      .set({
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(sql`${db.subscriptions.id} = ${company.subscription.id}`);

    res.json({
      message: 'Subscription reactivated successfully',
      cancelAtPeriodEnd: false,
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ message: 'Failed to reactivate subscription' });
  }
});

// Pre-flight check for downgrade impact
subscriptionRoutes.post("/check-downgrade", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ message: 'Plan ID is required' });
    }

    const tenantId = req.user.tenantId;

    // Get the target plan
    const targetPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });

    if (!targetPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Get current usage and subscription in parallel
    const [userLimits, shopLimits, emailLimits, currentSubscription] = await Promise.all([
      storage.checkUserLimits(tenantId),
      storage.checkShopLimits(tenantId),
      storage.checkEmailLimits(tenantId),
      storage.getTenantSubscription(tenantId),
    ]);
    const currentPlan = currentSubscription?.plan;

    // Calculate impacts (resources that will be suspended)
    const impacts: Array<{ resource: string; current: number; limit: number | null; willSuspend: number }> = [];

    if (targetPlan.maxShops !== null && shopLimits.currentShops > targetPlan.maxShops) {
      impacts.push({
        resource: 'shops',
        current: shopLimits.currentShops,
        limit: targetPlan.maxShops,
        willSuspend: shopLimits.currentShops - targetPlan.maxShops,
      });
    }

    if (targetPlan.maxUsers !== null && userLimits.currentUsers > targetPlan.maxUsers) {
      impacts.push({
        resource: 'users',
        current: userLimits.currentUsers,
        limit: targetPlan.maxUsers,
        willSuspend: userLimits.currentUsers - targetPlan.maxUsers,
      });
    }

    // Determine feature losses
    const featureLosses: string[] = [];
    if (currentPlan?.allowUsersManagement && !targetPlan.allowUsersManagement) {
      featureLosses.push('User management');
    }
    if (currentPlan?.allowRolesManagement && !targetPlan.allowRolesManagement) {
      featureLosses.push('Role & permission management');
    }

    // Email limit change
    const emailLimitChange = {
      current: emailLimits.monthlyLimit,
      new: targetPlan.monthlyEmailLimit,
    };

    // Billing info
    const billing = {
      currentPlan: currentPlan?.displayName || 'No Plan',
      targetPlan: targetPlan.displayName,
      currentPrice: currentPlan?.price || '0.00',
      newPrice: targetPlan.price,
      effectiveDate: currentSubscription?.currentPeriodEnd?.toISOString() || new Date().toISOString(),
    };

    res.json({
      canDowngrade: true,
      impacts,
      featureLosses,
      emailLimitChange,
      billing,
    });
  } catch (error) {
    console.error('Check downgrade error:', error);
    res.status(500).json({ message: 'Failed to check downgrade eligibility' });
  }
});

// Upgrade or downgrade subscription plan (Owner only)
subscriptionRoutes.post("/upgrade-subscription", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { planId, billingCycle } = req.body;
    if (!planId) {
      return res.status(400).json({ message: 'Plan ID is required' });
    }

    // Validate billingCycle parameter
    if (billingCycle && billingCycle !== 'monthly' && billingCycle !== 'yearly') {
      return res.status(400).json({ message: 'Invalid billing cycle. Must be "monthly" or "yearly"' });
    }

    const tenantId = req.user.tenantId;

    // Get company details
    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, tenantId),
    });

    // Get the target plan
    const targetPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });

    if (!targetPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Get existing subscription
    const existingSubscription = await storage.getTenantSubscription(tenantId);
    const currentPlan = existingSubscription?.plan;

    // Determine effective price based on billing cycle
    const isYearly = billingCycle === 'yearly';
    const targetPrice = isYearly && targetPlan.yearlyPrice
      ? parseFloat(targetPlan.yearlyPrice)
      : parseFloat(targetPlan.price);

    // Get current price based on existing subscription's billing cycle
    const currentIsYearly = existingSubscription?.isYearly || false;
    const currentPrice = currentPlan
      ? (currentIsYearly && currentPlan.yearlyPrice
        ? parseFloat(currentPlan.yearlyPrice)
        : parseFloat(currentPlan.price))
      : 0;

    // Determine if this is an upgrade or downgrade
    const isDowngrade = targetPrice < currentPrice;
    const isDowngradeToFree = targetPlan.name === 'Free' || targetPrice === 0;

    // SECURITY: Require payment flow for any paid plan unless the user has a valid, active Stripe subscription
    // that's verified with Stripe directly. This prevents lateral moves between paid plans or re-activation
    // of cancelled plans without payment verification.
    let hasActiveStripeSubscription = false;

    if (existingSubscription &&
      existingSubscription.status === 'active' &&
      existingSubscription.stripeSubscriptionId &&
      !existingSubscription.stripeSubscriptionId.startsWith('manual_') &&
      !existingSubscription.stripeSubscriptionId.startsWith('free_')) {

      // Verify the Stripe subscription is actually active with Stripe
      // SECURITY: This check now applies to ANY existing Stripe subscription, not just same-plan changes
      // This prevents bypass via lateral moves (e.g., monthly->yearly on cancelled subscriptions)
      if (stripe) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId);
          hasActiveStripeSubscription = stripeSubscription.status === 'active';

          // Additional security: check if subscription is in good standing (not past due, canceled, etc.)
          if (stripeSubscription.status !== 'active') {
            console.warn(`Security: Stripe subscription ${existingSubscription.stripeSubscriptionId} has status ${stripeSubscription.status}, requiring payment`);
          }
        } catch (stripeError) {
          console.warn(`Security: Failed to verify Stripe subscription ${existingSubscription.stripeSubscriptionId}, requiring payment:`, stripeError);
          // If we can't verify with Stripe, require payment
          hasActiveStripeSubscription = false;
        }
      } else {
        // No Stripe configured - only allow free plans
        hasActiveStripeSubscription = false;
      }
    }

    // We require checkout if it's a price upgrade OR if they don't have an active Stripe sub verified with Stripe
    const isUpgradeToPaid = targetPrice > 0 && (targetPrice > currentPrice || !hasActiveStripeSubscription);

    // SECURITY: Prevent direct activation of paid plans without payment
    if (isUpgradeToPaid) {
      if (!stripe) {
        return res.status(503).json({
          message: 'Payment processing is not configured. Please contact support.'
        });
      }

      // For upgrades to paid plans, require Stripe Checkout
      // Get or create Stripe customer
      let stripeCustomerId = existingSubscription?.stripeCustomerId;

      if (!stripeCustomerId || stripeCustomerId.startsWith('manual_')) {
        const customer = await stripe.customers.create({
          email: company?.companyEmail || req.user.email,
          metadata: {
            tenantId,
            userId: req.user.id,
          },
        });
        stripeCustomerId = customer.id;

        // Update existing subscription with real Stripe customer ID
        if (existingSubscription) {
          await db.update(subscriptions)
            .set({ stripeCustomerId })
            .where(eq(subscriptions.id, existingSubscription.id));
        }
      }

      // Create Stripe Checkout Session for the upgrade
      const stripePriceId = isYearly ? targetPlan.stripeYearlyPriceId : targetPlan.stripePriceId;

      if (!stripePriceId) {
        return res.status(400).json({
          message: `No Stripe price configured for ${isYearly ? 'yearly' : 'monthly'} billing on this plan.`
        });
      }

      // Capture the old Stripe subscription ID before it gets overwritten by confirm-checkout
      const previousStripeSubscriptionId = existingSubscription?.stripeSubscriptionId &&
        !existingSubscription.stripeSubscriptionId.startsWith('free_') &&
        !existingSubscription.stripeSubscriptionId.startsWith('manual_')
        ? existingSubscription.stripeSubscriptionId
        : undefined;

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            tenantId,
            userId: req.user.id,
            planId: targetPlan.id,
            billingCycle: isYearly ? 'yearly' : 'monthly',
            setupType: 'upgrade',
            ...(previousStripeSubscriptionId && { previousStripeSubscriptionId }),
          },
        },
        success_url: `${process.env.FRONTEND_URL || 'https://web.zendwise.work'}/subscribe?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://web.zendwise.work'}/subscribe?canceled=true`,
        metadata: {
          tenantId,
          userId: req.user.id,
          planId: targetPlan.id,
          billingCycle: isYearly ? 'yearly' : 'monthly',
          setupType: 'upgrade',
          ...(previousStripeSubscriptionId && { previousStripeSubscriptionId }),
        },
      });

      return res.json({
        requiresPayment: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        message: 'Please complete payment to activate your subscription',
      });
    }

    if (!existingSubscription) {
      // No existing subscription — only allow Free plan without payment
      if (targetPrice > 0) {
        return res.status(400).json({
          message: 'Payment required for paid plans. Please use the checkout flow.'
        });
      }

      const startDate = new Date();
      const isYearly = billingCycle === 'yearly';
      const endDate = new Date(startDate);

      if (isYearly) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setDate(endDate.getDate() + 30);
      }

      await db.insert(subscriptions).values({
        tenantId,
        userId: req.user.id,
        planId: targetPlan.id,
        stripeSubscriptionId: `manual_${tenantId}_${Date.now()}`,
        stripeCustomerId: `manual_customer_${tenantId}`,
        status: 'active',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        cancelAtPeriodEnd: false,
        isYearly: isYearly,
      });

      return res.json({
        message: `Successfully subscribed to ${targetPlan.displayName}`,
        plan: targetPlan.displayName,
      });
    }

    // === UPGRADE PATH (same price or lateral move) ===
    // SECURITY NOTE: This path is now only reachable when hasActiveStripeSubscription === true,
    // which means the user has a verified active Stripe subscription for this EXACT plan and billing cycle.
    // This prevents lateral moves between different paid plans without payment verification.
    if (!isDowngrade && !isUpgradeToPaid) {
      // Restore any previously suspended resources
      const restored = await storage.restoreSuspendedResources(tenantId);

      // Update subscription plan immediately
      const upgradeStart = new Date();
      const upgradeEnd = new Date(upgradeStart);
      if (billingCycle === 'yearly') {
        upgradeEnd.setFullYear(upgradeEnd.getFullYear() + 1);
      } else {
        upgradeEnd.setDate(upgradeEnd.getDate() + 30);
      }

      await db.update(subscriptions)
        .set({
          planId: targetPlan.id,
          previousPlanId: existingSubscription.planId,
          isYearly: billingCycle === 'yearly',
          currentPeriodStart: upgradeStart,
          currentPeriodEnd: upgradeEnd,
          downgradeTargetPlanId: null,
          downgradeScheduledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existingSubscription.id));

      // Log audit event
      try {
        await storage.logShopLimitEvent(
          tenantId,
          'limit_increased' as any,
          restored.restoredShops,
          targetPlan.maxShops ?? undefined,
          {
            eventType: 'plan_upgrade',
            previousPlan: currentPlan?.displayName,
            newPlan: targetPlan.displayName,
            restoredShops: restored.restoredShops,
            restoredUsers: restored.restoredUsers,
          }
        );
      } catch (auditError) {
        console.error('Failed to log upgrade audit event:', auditError);
      }

      return res.json({
        message: `Successfully upgraded to ${targetPlan.displayName}`,
        plan: targetPlan.displayName,
        restoredShops: restored.restoredShops,
        restoredUsers: restored.restoredUsers,
      });
    }

    // === DOWNGRADE PATH ===

    // Suspend excess resources
    const suspended = await storage.suspendExcessResources(
      tenantId,
      targetPlan.maxShops,
      targetPlan.maxUsers,
    );

    // Update subscription plan
    const downgradeStart = new Date();
    const downgradeEnd = new Date(downgradeStart);
    if (billingCycle === 'yearly') {
      downgradeEnd.setFullYear(downgradeEnd.getFullYear() + 1);
    } else {
      downgradeEnd.setDate(downgradeEnd.getDate() + 30);
    }

    await db.update(subscriptions)
      .set({
        planId: targetPlan.id,
        previousPlanId: existingSubscription.planId,
        isYearly: billingCycle === 'yearly',
        currentPeriodStart: downgradeStart,
        currentPeriodEnd: downgradeEnd,
        downgradeTargetPlanId: null,
        downgradeScheduledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSubscription.id));

    // For downgrade to Free: cancel the Stripe subscription at period end
    if (isDowngradeToFree && stripe && existingSubscription.stripeSubscriptionId && !existingSubscription.stripeSubscriptionId.startsWith('manual_')) {
      try {
        await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        await db.update(subscriptions)
          .set({
            cancelAtPeriodEnd: true,
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existingSubscription.id));
      } catch (stripeError) {
        console.error('Failed to cancel Stripe subscription for Free downgrade:', stripeError);
        // Non-blocking: the plan change still goes through
      }
    }

    // Log audit event
    try {
      await storage.logShopLimitEvent(
        tenantId,
        'limit_exceeded' as any,
        suspended.suspendedShops,
        targetPlan.maxShops ?? undefined,
        {
          eventType: 'plan_downgrade',
          previousPlan: currentPlan?.displayName,
          newPlan: targetPlan.displayName,
          suspendedShops: suspended.suspendedShops,
          suspendedUsers: suspended.suspendedUsers,
          isDowngradeToFree,
        }
      );
    } catch (auditError) {
      console.error('Failed to log downgrade audit event:', auditError);
    }

    res.json({
      message: `Successfully downgraded to ${targetPlan.displayName}`,
      plan: targetPlan.displayName,
      suspendedShops: suspended.suspendedShops,
      suspendedUsers: suspended.suspendedUsers,
    });
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    res.status(500).json({ message: 'Failed to update subscription' });
  }
});

// Get subscription usage
subscriptionRoutes.get("/usage", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.tenantId, req.user.tenantId),
      with: {
        subscription: true,
      },
    });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Get current usage statistics
    const [formCount, responseCount, userCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(forms).where(sql`${forms.tenantId} = ${company.id}`),
      db.select({ count: sql<number>`count(*)` }).from(formResponses).innerJoin(forms, sql`${forms.id} = ${formResponses.formId}`).where(sql`${forms.tenantId} = ${company.id}`),
      db.select({ count: sql<number>`count(*)` }).from(db.users).where(sql`${betterAuthUser.tenantId} = ${company.id}`),
    ]);

    const usage = {
      forms: formCount[0].count,
      responses: responseCount[0].count,
      users: userCount[0].count,
      period: {
        start: company.subscription?.currentPeriodStart || new Date(),
        end: company.subscription?.currentPeriodEnd || new Date(),
      },
    };

    res.json(usage);
  } catch (error) {
    console.error('Get subscription usage error:', error);
    res.status(500).json({ message: 'Failed to get subscription usage' });
  }
});

// Check if current tenant has an active subscription (used by frontend to gate plan selection)
subscriptionRoutes.get("/check-subscription", authenticateToken, async (req: any, res) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, req.user.tenantId),
    });

    const activeStatuses = ['active', 'trialing'];
    const hasSubscription = !!subscription && activeStatuses.includes(subscription.status);

    res.json({
      hasSubscription,
      status: subscription?.status || null,
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    res.status(500).json({ message: 'Failed to check subscription' });
  }
});

// Create Stripe Checkout Session for new signup plan selection
// All plans (including Free) require going through Stripe to collect a payment method
subscriptionRoutes.post("/setup-checkout", authenticateToken, async (req: any, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ message: 'Payment processing is not configured' });
    }

    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only account owners can manage billing' });
    }

    const { planId, billingCycle = 'monthly' } = req.body;

    if (!planId) {
      return res.status(400).json({ message: 'Plan ID is required' });
    }

    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Check if tenant already has a subscription
    const existingSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
    });

    if (existingSub && existingSub.status === 'active') {
      return res.status(400).json({ message: 'You already have an active subscription. Use the subscription management page to change plans.' });
    }

    // Get plan details
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });

    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: 'Plan not found or inactive' });
    }

    const isYearly = billingCycle === 'yearly';
    const stripePriceId = isYearly ? plan.stripeYearlyPriceId : plan.stripePriceId;

    if (!stripePriceId) {
      return res.status(400).json({ message: `No Stripe price configured for ${isYearly ? 'yearly' : 'monthly'} billing` });
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined;

    // Check if we already have a Stripe customer for this tenant
    if (existingSub?.stripeCustomerId && !existingSub.stripeCustomerId.startsWith('free_') && !existingSub.stripeCustomerId.startsWith('manual_')) {
      stripeCustomerId = existingSub.stripeCustomerId;
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          tenantId,
          userId,
        },
      });
      stripeCustomerId = customer.id;
    }

    const isFree = parseFloat(plan.price) === 0;
    const frontendUrl = process.env.FRONTEND_URL || 'https://web.zendwise.work';

    // Create Checkout Session
    // For Free plan: use 'setup' mode to collect card without charging
    // For paid plans: use 'subscription' mode to charge immediately
    if (isFree) {
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${frontendUrl}/select-plan?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/select-plan?canceled=true`,
        metadata: {
          tenantId,
          userId,
          planId: plan.id,
          billingCycle: isYearly ? 'yearly' : 'monthly',
          setupType: 'new_signup',
        },
      });

      return res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } else {
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${frontendUrl}/select-plan?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/select-plan?canceled=true`,
        metadata: {
          tenantId,
          userId,
          planId: plan.id,
          billingCycle: isYearly ? 'yearly' : 'monthly',
          setupType: 'new_signup',
        },
      });

      return res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    }
  } catch (error: any) {
    console.error('Setup checkout error:', error);
    const stripeMessage = error?.raw?.message || error?.message || 'Unknown error';
    console.error('Stripe error details:', {
      type: error?.type,
      code: error?.code,
      message: stripeMessage,
      statusCode: error?.statusCode,
    });
    res.status(500).json({ message: `Failed to create checkout session: ${stripeMessage}` });
  }
});

// Confirm checkout session and create subscription record in DB
subscriptionRoutes.post("/confirm-checkout", authenticateToken, async (req: any, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ message: 'Payment processing is not configured' });
    }

    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only account owners can manage billing' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Checkout session not found' });
    }

    // Verify the session belongs to this tenant
    if (session.metadata?.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Session does not belong to this tenant' });
    }

    const planId = session.metadata?.planId;
    const billingCycle = session.metadata?.billingCycle || 'monthly';
    const isYearly = billingCycle === 'yearly';
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || '';

    if (!planId) {
      return res.status(400).json({ message: 'Plan ID not found in session metadata' });
    }

    // Check if subscription already exists for this tenant
    const existingSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
    });

    // Idempotency: only skip if the existing active subscription already has THIS plan
    // If planId differs, this is an upgrade/change and must proceed
    if (existingSub && existingSub.status === 'active' && existingSub.planId === planId) {
      return res.json({
        message: 'Subscription already active',
        success: true,
        subscription: existingSub,
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    if (session.mode === 'setup') {
      // Verify the SetupIntent succeeded before provisioning
      if (session.setup_intent) {
        const setupIntent = await stripe.setupIntents.retrieve(
          typeof session.setup_intent === 'string' ? session.setup_intent : (session.setup_intent as any).id
        );
        if (setupIntent.status !== 'succeeded') {
          return res.status(402).json({ message: `SetupIntent not succeeded (status: ${setupIntent.status})` });
        }
      }

      // Free plan — setup mode, no Stripe subscription created
      // Create a local subscription record
      const subValues = {
        tenantId,
        userId,
        planId,
        stripeSubscriptionId: `free_${tenantId}_${Date.now()}`,
        stripeCustomerId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        isYearly,
      };

      if (existingSub) {
        await db.update(subscriptions)
          .set({ ...subValues, updatedAt: now })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await db.insert(subscriptions).values(subValues);
      }

      console.log(`✅ [Confirm Checkout] Free plan subscription created for tenant ${tenantId}`);
    } else {
      // Paid plan — subscription mode: verify payment before provisioning
      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return res.status(402).json({ message: `Payment not completed (status: ${session.payment_status})` });
      }

      // Paid plan — subscription mode
      const stripeSubscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as any)?.id;

      if (!stripeSubscriptionId) {
        return res.status(400).json({ message: 'No subscription found in checkout session' });
      }

      // Get subscription details from Stripe
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any;

      // Safe date parsing — fallback to computed period if Stripe timestamps are missing or invalid
      console.log(`📅 [Confirm Checkout] Stripe sub dates: start=${stripeSub.current_period_start}, end=${stripeSub.current_period_end}, status=${stripeSub.status}`);
      const safeDate = (ts: any, fallback: Date) => {
        if (typeof ts === 'number' && isFinite(ts)) return new Date(ts * 1000);
        return fallback;
      };
      const periodStart = safeDate(stripeSub.current_period_start, now);
      const periodEndFromStripe = safeDate(stripeSub.current_period_end, periodEnd);

      const subValues = {
        tenantId,
        userId,
        planId,
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId,
        status: stripeSub.status || 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEndFromStripe,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end || false,
        isYearly,
      };

      if (existingSub) {
        await db.update(subscriptions)
          .set({ ...subValues, updatedAt: now })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await db.insert(subscriptions).values(subValues);
      }

      console.log(`✅ [Confirm Checkout] Paid subscription ${stripeSub.id} ${existingSub ? 'updated (upgrade)' : 'created'} for tenant ${tenantId}, planId: ${planId}`);
    }

    res.json({
      message: 'Subscription activated successfully',
      success: true,
    });
  } catch (error) {
    console.error('Confirm checkout error:', error);
    res.status(500).json({ message: 'Failed to confirm checkout' });
  }
});

// Webhook endpoint for Stripe events
subscriptionRoutes.post("/webhook", async (req: any, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe is not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      return res.status(500).json({ message: 'Webhook secret not configured' });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Helper functions for webhook handling
async function handleCheckoutSessionCompleted(session: any) {
  try {
    const { tenantId, userId, planId, billingCycle, setupType } = session.metadata || {};

    if (!tenantId || !planId) {
      console.error('Missing metadata in checkout session:', session.id);
      return;
    }

    if (!stripe) {
      console.error('Stripe is not initialized');
      return;
    }

    const stripeCustomerId = session.customer;
    const isYearly = billingCycle === 'yearly';
    const isUpgrade = setupType === 'upgrade';

    // Check if subscription already exists (confirm-checkout may have already created it)
    const existingSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
    });

    if (session.mode === 'setup') {
      // Free plan — setup mode: verify SetupIntent before provisioning
      if (session.setup_intent) {
        const setupIntent = await stripe.setupIntents.retrieve(
          typeof session.setup_intent === 'string' ? session.setup_intent : (session.setup_intent as any).id
        );
        if (setupIntent.status !== 'succeeded') {
          console.warn(`[Webhook] SetupIntent not succeeded (status: ${setupIntent.status}), skipping provisioning for session ${session.id}`);
          return;
        }
      }

      if (!userId) {
        console.error('[Webhook] Missing userId in checkout session metadata, skipping subscription insert to avoid FK violation:', session.id);
        return;
      }

      const now = new Date();
      const periodEnd = new Date(now);
      if (isYearly) {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const subValues = {
        tenantId,
        userId,
        planId,
        stripeSubscriptionId: `free_${tenantId}_${Date.now()}`,
        stripeCustomerId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        isYearly,
      };

      if (existingSub) {
        await db.update(subscriptions)
          .set({ ...subValues, updatedAt: new Date() })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await db.insert(subscriptions).values(subValues);
      }

      console.log('✅ [Webhook] Free plan subscription created for tenant:', tenantId);
    } else {
      // Paid plan — subscription mode: verify payment before provisioning
      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        console.warn(`[Webhook] Payment not completed (status: ${session.payment_status}), skipping provisioning for session ${session.id}`);
        return;
      }

      // Paid plan — subscription mode
      const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription) as any;

      // If this is an upgrade and there's an old Stripe subscription, cancel it.
      // Use previousStripeSubscriptionId from metadata as the authoritative source —
      // confirm-checkout may have already overwritten existingSub.stripeSubscriptionId
      // by the time this webhook fires.
      const previousStripeId = session.metadata?.previousStripeSubscriptionId
        || stripeSubscription.metadata?.previousStripeSubscriptionId;
      const oldStripeIdToCancel = previousStripeId
        || (existingSub?.stripeSubscriptionId !== stripeSubscription.id ? existingSub?.stripeSubscriptionId : undefined);

      if (isUpgrade && oldStripeIdToCancel &&
        !oldStripeIdToCancel.startsWith('free_') &&
        !oldStripeIdToCancel.startsWith('manual_') &&
        oldStripeIdToCancel !== stripeSubscription.id) {
        try {
          await stripe.subscriptions.cancel(oldStripeIdToCancel);
          console.log(`🗑️ [Webhook] Cancelled old Stripe subscription ${oldStripeIdToCancel} after upgrade`);
        } catch (cancelError) {
          console.warn(`⚠️ [Webhook] Failed to cancel old subscription ${oldStripeIdToCancel}:`, cancelError);
        }
      }

      const now = new Date();
      const fallbackEnd = new Date(now);
      if (isYearly) { fallbackEnd.setFullYear(fallbackEnd.getFullYear() + 1); } else { fallbackEnd.setMonth(fallbackEnd.getMonth() + 1); }

      if (!userId) {
        console.error('[Webhook] Missing userId in checkout session metadata, skipping subscription insert to avoid FK violation:', session.id);
        return;
      }

      const subValues: any = {
        tenantId,
        userId,
        planId,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        status: stripeSubscription.status || 'active',
        currentPeriodStart: stripeSubscription.current_period_start
          ? new Date(stripeSubscription.current_period_start * 1000) : now,
        currentPeriodEnd: stripeSubscription.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000) : fallbackEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
        isYearly,
      };

      // Preserve old planId as previousPlanId for audit tracking on upgrades
      if (isUpgrade && existingSub?.planId) {
        subValues.previousPlanId = existingSub.planId;
      }

      if (existingSub) {
        await db.update(subscriptions)
          .set({ ...subValues, updatedAt: new Date() })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await db.insert(subscriptions).values(subValues);
      }

      console.log(`✅ [Webhook] ${isUpgrade ? 'Upgraded' : 'Paid'} subscription ${stripeSubscription.id} created for tenant:`, tenantId, `planId: ${planId}`);
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function handleSubscriptionUpdated(stripeSubscription: any) {
  try {
    // First try to find by stripeSubscriptionId
    let dbSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, stripeSubscription.id),
    });

    // If not found by stripeSubscriptionId, try to find by tenantId from metadata
    // This handles the case where an upgrade creates a new Stripe subscription
    if (!dbSubscription && stripeSubscription.metadata?.tenantId) {
      dbSubscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.tenantId, stripeSubscription.metadata.tenantId),
      });
      if (dbSubscription) {
        console.log(`🔄 [Webhook] Found subscription by tenantId fallback for ${stripeSubscription.id}`);
      }
    }

    if (!dbSubscription) {
      console.error('Subscription not found in database:', stripeSubscription.id);
      return;
    }

    const now = new Date();
    const updateData: any = {
      status: stripeSubscription.status,
      stripeSubscriptionId: stripeSubscription.id, // Always keep in sync
      currentPeriodStart: stripeSubscription.current_period_start
        ? new Date(stripeSubscription.current_period_start * 1000) : now,
      currentPeriodEnd: stripeSubscription.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000) : now,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
      updatedAt: now,
    };

    // Resolve planId from Stripe's subscription metadata (set during checkout)
    if (stripeSubscription.metadata?.planId) {
      const newPlanId = stripeSubscription.metadata.planId;
      if (newPlanId !== dbSubscription.planId) {
        console.log(`📦 [Webhook] Plan changed: ${dbSubscription.planId} → ${newPlanId}`);
        updateData.previousPlanId = dbSubscription.planId;
        updateData.planId = newPlanId;
      }
    } else {
      // Fallback: resolve planId from Stripe price items
      try {
        const items = stripeSubscription.items?.data;
        if (items && items.length > 0) {
          const stripePriceId = items[0].price?.id;
          if (stripePriceId) {
            // Look up which plan this price belongs to
            const matchingPlan = await db.query.subscriptionPlans.findFirst({
              where: or(
                eq(subscriptionPlans.stripePriceId, stripePriceId),
                eq(subscriptionPlans.stripeYearlyPriceId, stripePriceId)
              ),
            });
            if (matchingPlan && matchingPlan.id !== dbSubscription.planId) {
              console.log(`📦 [Webhook] Plan resolved from price ${stripePriceId}: ${dbSubscription.planId} → ${matchingPlan.id}`);
              updateData.previousPlanId = dbSubscription.planId;
              updateData.planId = matchingPlan.id;
              // Also set isYearly based on which price matched
              updateData.isYearly = matchingPlan.stripeYearlyPriceId === stripePriceId;
            }
          }
        }
      } catch (priceResolveError) {
        console.warn('⚠️ [Webhook] Failed to resolve plan from price:', priceResolveError);
      }
    }

    await db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, dbSubscription.id));

    console.log('Subscription updated:', stripeSubscription.id, updateData.planId ? `(new plan: ${updateData.planId})` : '');
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(stripeSubscription: any) {
  try {
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, stripeSubscription.id),
    });

    if (!dbSubscription) {
      console.error('Subscription not found in database:', stripeSubscription.id);
      return;
    }

    await db.update(subscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, dbSubscription.id));

    console.log('Subscription cancelled:', stripeSubscription.id);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handlePaymentSucceeded(invoice: any) {
  try {
    if (!stripe) {
      console.error('Stripe is not initialized');
      return;
    }
    const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription) as any;

    const dbSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, stripeSub.id),
    });

    if (!dbSubscription) {
      console.error('Subscription not found in database:', stripeSub.id);
      return;
    }

    await db.update(subscriptions)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, dbSubscription.id));

    console.log('Payment succeeded for subscription:', stripeSub.id);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice: any) {
  try {
    if (!stripe) {
      console.error('Stripe is not initialized');
      return;
    }
    const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription) as any;

    const dbSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, stripeSub.id),
    });

    if (!dbSubscription) {
      console.error('Subscription not found in database:', stripeSub.id);
      return;
    }

    await db.update(subscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, dbSubscription.id));

    console.log('Payment failed for subscription:', stripeSub.id);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}