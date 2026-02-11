import './config';
import { db } from './db';
import { subscriptionPlans, subscriptions, tenants } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Migration script: Assign Pro plan to all existing tenants that don't have a subscription.
 * 
 * Run with: npx tsx server/migrate-existing-tenants-to-pro.ts
 */
async function migrateExistingTenantsToPro() {
  try {
    console.log('🔄 Starting migration: Assign Pro plan to existing tenants...');

    // 1. Find the Pro plan
    const proPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, 'Pro'),
    });

    if (!proPlan) {
      console.error('❌ Pro plan not found in database. Run setup-subscription-plans first.');
      process.exit(1);
    }

    console.log(`✅ Found Pro plan: ${proPlan.displayName} (ID: ${proPlan.id})`);

    // 2. Find all tenants that do NOT have a subscription
    const allTenants = await db.select().from(tenants);
    const existingSubscriptions = await db.select({ tenantId: subscriptions.tenantId }).from(subscriptions);
    const subscribedTenantIds = new Set(existingSubscriptions.map((s: { tenantId: string }) => s.tenantId));

    const tenantsWithoutSubscription = allTenants.filter((t: { id: string }) => !subscribedTenantIds.has(t.id));

    if (tenantsWithoutSubscription.length === 0) {
      console.log('✅ All tenants already have subscriptions. Nothing to migrate.');
      return;
    }

    console.log(`📋 Found ${tenantsWithoutSubscription.length} tenant(s) without a subscription:`);
    tenantsWithoutSubscription.forEach((t: { id: string; name: string }) => {
      console.log(`   - ${t.name} (${t.id})`);
    });

    // 3. Create Pro subscriptions for each tenant
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1); // 1 year end date for migrated tenants

    for (const tenant of tenantsWithoutSubscription) {
      // Find the owner of this tenant to use as the userId
      const ownerResult = await db.execute(
        sql`SELECT id FROM better_auth_user WHERE tenant_id = ${tenant.id} AND role = 'Owner' LIMIT 1`
      );

      const ownerId = (ownerResult as any)?.[0]?.id;
      if (!ownerId) {
        console.warn(`⚠️ No owner found for tenant ${tenant.name} (${tenant.id}), skipping...`);
        continue;
      }

      await db.insert(subscriptions).values({
        tenantId: tenant.id,
        userId: ownerId,
        planId: proPlan.id,
        stripeSubscriptionId: `migrated_pro_${tenant.id}`,
        stripeCustomerId: `migrated_customer_${tenant.id}`,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        isYearly: false,
      });

      console.log(`   ✅ Assigned Pro plan to tenant: ${tenant.name}`);
    }

    console.log(`\n🎉 Migration complete! ${tenantsWithoutSubscription.length} tenant(s) migrated to Pro plan.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateExistingTenantsToPro()
    .then(() => {
      console.log('Migration finished.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

export { migrateExistingTenantsToPro };
