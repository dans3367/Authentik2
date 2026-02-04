import dotenv from 'dotenv';

// Load environment variables BEFORE importing db
dotenv.config();

import { db } from './db';
import { subscriptionPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Default subscription plans with shop limits
const defaultPlans = [
  {
    name: 'Basic',
    displayName: 'Basic Plan',
    description: 'Perfect for small businesses getting started',
    price: '29.99',
    yearlyPrice: '299.99',
    stripePriceId: 'price_basic_monthly', // Replace with actual Stripe price ID
    stripeYearlyPriceId: 'price_basic_yearly', // Replace with actual Stripe price ID
    features: [
      'Up to 5 shops',
      'Up to 10 users',
      'Basic email support',
      '10GB storage',
      'Standard analytics',
      '200 emails/month'
    ],
    maxUsers: 10,
    maxProjects: null,
    maxShops: 5, // Basic plan: 5 shops
    storageLimit: 10,
    monthlyEmailLimit: 200,
    supportLevel: 'email',
    trialDays: 14,
    isPopular: false,
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Professional',
    displayName: 'Professional Plan',
    description: 'Ideal for growing businesses with multiple locations',
    price: '79.99',
    yearlyPrice: '799.99',
    stripePriceId: 'price_pro_monthly', // Replace with actual Stripe price ID
    stripeYearlyPriceId: 'price_pro_yearly', // Replace with actual Stripe price ID
    features: [
      'Up to 10 shops',
      'Up to 25 users',
      'Priority email support',
      '50GB storage',
      'Advanced analytics',
      'Custom branding',
      '500 emails/month'
    ],
    maxUsers: 25,
    maxProjects: null,
    maxShops: 10, // Mid tier: 10 shops
    storageLimit: 50,
    monthlyEmailLimit: 500,
    supportLevel: 'priority',
    trialDays: 14,
    isPopular: true,
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Enterprise',
    displayName: 'Enterprise Plan',
    description: 'For large organizations with extensive needs',
    price: '199.99',
    yearlyPrice: '1999.99',
    stripePriceId: 'price_enterprise_monthly', // Replace with actual Stripe price ID
    stripeYearlyPriceId: 'price_enterprise_yearly', // Replace with actual Stripe price ID
    features: [
      'Up to 20 shops',
      'Unlimited users',
      'Dedicated support',
      '200GB storage',
      'Premium analytics',
      'Custom integrations',
      'White-label options',
      '1000 emails/month'
    ],
    maxUsers: null, // Unlimited
    maxProjects: null,
    maxShops: 20, // Advanced: 20 shops
    storageLimit: 200,
    monthlyEmailLimit: 1000,
    supportLevel: 'dedicated',
    trialDays: 14,
    isPopular: false,
    isActive: true,
    sortOrder: 3
  }
];

async function setupSubscriptionPlans() {
  try {
    console.log('Setting up subscription plans...');

    // Test database connection first
    console.log('Testing database connection...');
    try {
      await db.query.subscriptionPlans.findFirst();
      console.log('Database connection successful!');
    } catch (dbError) {
      console.log('Database connection failed, but continuing with plan setup...');
      console.log('Plans will be created when database is available.');

      // Generate SQL for manual execution
      console.log('\n=== SQL to create subscription plans manually ===');
      for (const plan of defaultPlans) {
        const features = plan.features.map(f => `"${f}"`).join(', ');
        console.log(`INSERT INTO subscription_plans (name, display_name, description, price, yearly_price, stripe_price_id, stripe_yearly_price_id, features, max_users, max_projects, max_shops, storage_limit, monthly_email_limit, support_level, trial_days, is_popular, is_active, sort_order) VALUES ('${plan.name}', '${plan.displayName}', '${plan.description}', ${plan.price}, ${plan.yearlyPrice}, '${plan.stripePriceId}', '${plan.stripeYearlyPriceId}', ARRAY[${features}], ${plan.maxUsers || 'NULL'}, ${plan.maxProjects || 'NULL'}, ${plan.maxShops}, ${plan.storageLimit}, ${plan.monthlyEmailLimit}, '${plan.supportLevel}', ${plan.trialDays}, ${plan.isPopular}, ${plan.isActive}, ${plan.sortOrder}) ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, max_shops = EXCLUDED.max_shops, monthly_email_limit = EXCLUDED.monthly_email_limit;`);
      }
      console.log('=== End SQL ===\n');
      return;
    }

    for (const plan of defaultPlans) {
      // Check if plan already exists
      const existingPlan = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.name, plan.name)
      });

      if (existingPlan) {
        console.log(`Plan '${plan.name}' already exists, updating...`);
        // Update existing plan
        await db.update(subscriptionPlans)
          .set({
            displayName: plan.displayName,
            description: plan.description,
            price: plan.price,
            yearlyPrice: plan.yearlyPrice,
            features: plan.features,
            maxUsers: plan.maxUsers,
            maxProjects: plan.maxProjects,
            maxShops: plan.maxShops,
            storageLimit: plan.storageLimit,
            monthlyEmailLimit: plan.monthlyEmailLimit,
            supportLevel: plan.supportLevel,
            trialDays: plan.trialDays,
            isPopular: plan.isPopular,
            isActive: plan.isActive,
            sortOrder: plan.sortOrder,
            updatedAt: new Date()
          })
          .where(eq(subscriptionPlans.id, existingPlan.id));
      } else {
        console.log(`Creating new plan '${plan.name}'...`);
        // Create new plan
        await db.insert(subscriptionPlans).values(plan);
      }
    }

    console.log('Subscription plans setup completed successfully!');

    // Display the created plans
    const allPlans = await db.query.subscriptionPlans.findMany({
      orderBy: (plans: any, { asc }: { asc: any }) => [asc(plans.sortOrder)]
    });

    console.log('\nCurrent subscription plans:');
    allPlans.forEach((plan: any) => {
      console.log(`- ${plan.displayName}: ${plan.maxShops} shops, $${plan.price}/month`);
    });

  } catch (error) {
    console.error('Error setting up subscription plans:', error);
    if (error instanceof Error) {
      if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
        console.error('\n❌ Database connection failed. Please ensure:');
        console.error('1. PostgreSQL server is running');
        console.error('2. DATABASE_URL in .env is correct');
        console.error('3. Database exists and is accessible');
        console.error('\nCurrent DATABASE_URL:', process.env.DATABASE_URL);
      }
    }
    process.exit(1);
  }
}

// Run the setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSubscriptionPlans()
    .then(() => {
      console.log('Setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export { setupSubscriptionPlans };