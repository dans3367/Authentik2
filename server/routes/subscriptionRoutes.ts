import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users, subscriptionPlans, forms, formResponses } from '@shared/schema';
import { authenticateToken, requireRole } from './authRoutes';
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
      orderBy: sql`${subscriptionPlans.price} ASC`,
    });

    res.json(plans);
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ message: 'Failed to get subscription plans' });
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
    const existingUser = await db.query.users.findFirst({
      where: sql`${users.email} = ${email}`,
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user with free trial
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('temp-password-' + Date.now(), 12);

    const newUser = await db.insert(users).values({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      role: 'Owner',
      emailVerified: true, // Auto-verify for free trial
      createdAt: new Date(),
    }).returning();

    // Create company
    const newCompany = await db.insert(db.companies).values({
      name: companyName,
      slug: companyName.toLowerCase().replace(/\s+/g, '-'),
      ownerId: newUser[0].id,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      createdAt: new Date(),
    }).returning();

    // Update user with company ID
    await db.update(users)
      .set({ companyId: newCompany[0].id })
      .where(sql`${users.id} = ${newUser[0].id}`);

    res.status(201).json({
      message: 'Free trial account created successfully',
      userId: newUser[0].id,
      companyId: newCompany[0].id,
      trialEndsAt: newCompany[0].trialEndsAt,
    });
  } catch (error) {
    console.error('Free trial signup error:', error);
    res.status(500).json({ message: 'Free trial signup failed' });
  }
});

// Get user's subscription
subscriptionRoutes.get("/my-subscription", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    const company = await db.query.companies.findFirst({
      where: sql`${db.companies.id} = ${req.user.companyId}`,
      with: {
        subscription: true,
      },
    });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    let subscriptionDetails = null;

    if (company.subscription && stripe) {
      try {
        // Get subscription details from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(company.subscription.stripeSubscriptionId);
        
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
        slug: company.slug,
        trialEndsAt: company.trialEndsAt,
        isOnTrial: company.trialEndsAt ? company.trialEndsAt > new Date() : false,
      },
      subscription: company.subscription ? {
        id: company.subscription.id,
        status: company.subscription.status,
        planId: company.subscription.planId,
        stripeCustomerId: company.subscription.stripeCustomerId,
        stripeSubscriptionId: company.subscription.stripeSubscriptionId,
        currentPeriodStart: company.subscription.currentPeriodStart,
        currentPeriodEnd: company.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: company.subscription.cancelAtPeriodEnd,
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

    // Get plan details
    const plan = await db.query.subscriptionPlans.findFirst({
      where: sql`${subscriptionPlans.id} = ${planId}`,
    });

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Get company
    const company = await db.query.companies.findFirst({
      where: sql`${db.companies.id} = ${req.user.companyId}`,
    });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    let customerId = company.subscription?.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: company.name,
        metadata: {
          companyId: company.id,
          userId: req.user.userId,
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

    // Get company
    const company = await db.query.companies.findFirst({
      where: sql`${db.companies.id} = ${req.user.companyId}`,
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
      return_url: returnUrl || `${process.env.FRONTEND_URL}/dashboard/billing`,
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

    // Get company subscription
    const company = await db.query.companies.findFirst({
      where: sql`${db.companies.id} = ${req.user.companyId}`,
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

    // Get company subscription
    const company = await db.query.companies.findFirst({
      where: sql`${db.companies.id} = ${req.user.companyId}`,
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

// Get subscription usage
subscriptionRoutes.get("/usage", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
  try {
    const company = await db.query.companies.findFirst({
      where: sql`${db.companies.id} = ${req.user.companyId}`,
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
      db.select({ count: sql<number>`count(*)` }).from(db.users).where(sql`${users.tenantId} = ${company.id}`),
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
    const { companyId, planId } = session.metadata;
    
    if (!companyId || !planId) {
      console.error('Missing metadata in checkout session:', session.id);
      return;
    }

    // Get subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    // Create or update subscription in database
    await db.insert(db.subscriptions).values({
      companyId,
      planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: db.subscriptions.companyId,
      set: {
        planId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });

    console.log('Subscription created/updated for company:', companyId);
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  try {
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: sql`${db.subscriptions.stripeSubscriptionId} = ${subscription.id}`,
    });

    if (!dbSubscription) {
      console.error('Subscription not found in database:', subscription.id);
      return;
    }

    await db.update(db.subscriptions)
      .set({
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(sql`${db.subscriptions.id} = ${dbSubscription.id}`);

    console.log('Subscription updated:', subscription.id);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  try {
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: sql`${db.subscriptions.stripeSubscriptionId} = ${subscription.id}`,
    });

    if (!dbSubscription) {
      console.error('Subscription not found in database:', subscription.id);
      return;
    }

    await db.update(db.subscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(sql`${db.subscriptions.id} = ${dbSubscription.id}`);

    console.log('Subscription cancelled:', subscription.id);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handlePaymentSucceeded(invoice: any) {
  try {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: sql`${db.subscriptions.stripeSubscriptionId} = ${subscription.id}`,
    });

    if (!dbSubscription) {
      console.error('Subscription not found in database:', subscription.id);
      return;
    }

    await db.update(db.subscriptions)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(sql`${db.subscriptions.id} = ${dbSubscription.id}`);

    console.log('Payment succeeded for subscription:', subscription.id);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice: any) {
  try {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: sql`${db.subscriptions.stripeSubscriptionId} = ${subscription.id}`,
    });

    if (!dbSubscription) {
      console.error('Subscription not found in database:', subscription.id);
      return;
    }

    await db.update(db.subscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date(),
      })
      .where(sql`${db.subscriptions.id} = ${dbSubscription.id}`);

    console.log('Payment failed for subscription:', subscription.id);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}