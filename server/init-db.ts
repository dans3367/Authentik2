import "./config";
import { db } from "./db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
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

    console.log("🎉 Database initialization completed successfully!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Note: Direct execution removed to prevent interference with main server process
// To run initialization standalone, use: node -e "import('./init-db.js').then(m => m.initializeDatabase())"

export { initializeDatabase };