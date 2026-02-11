import './config';
import { db } from './db';
import { subscriptionPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Subscription plans: Free, Plus, Pro
const defaultPlans = [
  {
    name: 'Free',
    displayName: 'Free Plan',
    description: 'Get started with the essentials — single user, single login',
    price: '0.00',
    yearlyPrice: '0.00',
    stripePriceId: 'price_1Sz4wQFKvavhLWPgJVSuidDp',
    stripeYearlyPriceId: 'price_1Sz4wQFKvavhLWPgOkRA34yt',
    features: [
      '1 user (Owner only)',
      '100 emails/month',
      'No shops',
      'Basic email support',
    ],
    maxUsers: 1,
    maxProjects: null,
    maxShops: 0,
    storageLimit: 5,
    monthlyEmailLimit: 100,
    allowUsersManagement: false,
    allowRolesManagement: false,
    supportLevel: 'email',
    trialDays: 0,
    isPopular: false,
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Plus',
    displayName: 'Plus Plan',
    description: 'For growing businesses — add team members and shops',
    price: '49.00',
    yearlyPrice: '470.40',
    stripePriceId: 'price_1Sz4wQFKvavhLWPgiMUztAdb',
    stripeYearlyPriceId: 'price_1Sz4wQFKvavhLWPgrvvuxhHj',
    features: [
      'Up to 3 users',
      '500 emails/month',
      'Up to 3 shops',
      'User & role management',
      'Priority email support',
    ],
    maxUsers: 3,
    maxProjects: null,
    maxShops: 3,
    storageLimit: 25,
    monthlyEmailLimit: 500,
    allowUsersManagement: true,
    allowRolesManagement: true,
    supportLevel: 'priority',
    trialDays: 14,
    isPopular: true,
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Pro',
    displayName: 'Pro Plan',
    description: 'For established businesses — full power with more capacity',
    price: '79.00',
    yearlyPrice: '758.40',
    stripePriceId: 'price_1Sz4wRFKvavhLWPg1vogU8PN',
    stripeYearlyPriceId: 'price_1Sz4wSFKvavhLWPgT92tDeuL',
    features: [
      'Up to 20 users',
      '1,000 emails/month',
      'Up to 10 shops',
      'User & role management',
      'Dedicated support',
      'Advanced analytics',
    ],
    maxUsers: 20,
    maxProjects: null,
    maxShops: 10,
    storageLimit: 100,
    monthlyEmailLimit: 1000,
    allowUsersManagement: true,
    allowRolesManagement: true,
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
            allowUsersManagement: plan.allowUsersManagement,
            allowRolesManagement: plan.allowRolesManagement,
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

    // Deactivate old plans that are not part of the new system
    const validPlanNames = defaultPlans.map(p => p.name);
    const allExistingPlans = await db.query.subscriptionPlans.findMany();
    for (const plan of allExistingPlans) {
      if (!validPlanNames.includes(plan.name) && plan.isActive) {
        console.log(`Deactivating old plan '${plan.name}'...`);
        await db.update(subscriptionPlans)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(subscriptionPlans.id, plan.id));
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