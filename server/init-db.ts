import "./config";
import { db } from "./db";
import { tenants, shops } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { setupSubscriptionPlans } from "./setup-subscription-plans";

async function initializeDatabase() {
  try {
    console.log("🔧 Initializing database...");

    // Check if default tenant exists
    const existingDefaultTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, "default"))
      .limit(1);

    if (existingDefaultTenant.length === 0) {
      console.log("📝 Creating default tenant...");
      
      // Create default tenant
      await db.insert(tenants).values({
        name: "Default Organization",
        slug: "default",
        isActive: true,
        maxUsers: 50, // Higher limit for default tenant
      });
      
      console.log("✅ Default tenant created successfully");
    } else {
      console.log("✅ Default tenant already exists");
    }

    // Setup subscription plans (Free/Plus/Pro with real Stripe price IDs)
    // This creates or updates plans on every startup to keep them in sync
    await setupSubscriptionPlans();

    // NOTE: Default shop backfill disabled — new tenants get a default shop at signup.
    // This was a one-time migration guard that should not run on every startup in production.
    // const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
    // for (const tenant of allTenants) {
    //   const existingDefault = await db
    //     .select({ id: shops.id })
    //     .from(shops)
    //     .where(and(eq(shops.tenantId, tenant.id), eq(shops.isDefault, true)))
    //     .limit(1);
    //
    //   if (existingDefault.length === 0) {
    //     await db.insert(shops).values({
    //       tenantId: tenant.id,
    //       name: tenant.name || 'Default Shop',
    //       email: 'default@placeholder.local',
    //       phone: '',
    //       country: 'United States',
    //       status: 'active',
    //       isActive: true,
    //       isDefault: true,
    //     });
    //     console.log(`🏪 Default shop created for tenant: ${tenant.name || tenant.id}`);
    //   }
    // }

    console.log("🎉 Database initialization completed successfully!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Note: Direct execution removed to prevent interference with main server process
// To run initialization standalone, use: node -e "import('./init-db.js').then(m => m.initializeDatabase())"

export { initializeDatabase };