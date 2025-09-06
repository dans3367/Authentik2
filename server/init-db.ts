import "./config";
import { db } from "./db";
import { tenants, subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";

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

    // Check if subscription plans exist
    const existingPlans = await db
      .select()
      .from(subscriptionPlans)
      .limit(1);

    if (existingPlans.length === 0) {
      console.log("📝 Creating subscription plans...");
      
      // Create basic subscription plans
      await db.insert(subscriptionPlans).values([
        {
          name: "basic",
          displayName: "Basic Plan",
          description: "Perfect for small teams getting started",
          price: "19.99",
          yearlyPrice: "199.99",
          stripePriceId: "price_1RowinFJFJPRMbUMov3E6jzj",
          stripeYearlyPriceId: "price_basic_yearly",
          features: ["Up to 10 users", "Up to 10 shops", "Basic forms", "Email support"],
          maxUsers: 10,
          maxShops: 10,
          maxProjects: 5,
          storageLimit: 5,
          supportLevel: "email",
          trialDays: 14,
          isPopular: false,
          isActive: true,
          sortOrder: 1,
        },
        {
          name: "pro",
          displayName: "Pro Plan",
          description: "Great for growing businesses",
          price: "29.99",
          yearlyPrice: "299.99",
          stripePriceId: "price_pro_monthly",
          stripeYearlyPriceId: "price_pro_yearly",
          features: ["Up to 50 users", "Up to 25 shops", "Advanced forms", "Priority support", "Custom branding"],
          maxUsers: 50,
          maxShops: 25,
          maxProjects: 25,
          storageLimit: 25,
          supportLevel: "priority",
          trialDays: 14,
          isPopular: true,
          isActive: true,
          sortOrder: 2,
        },
        {
          name: "enterprise",
          displayName: "Enterprise Plan",
          description: "For large organizations with advanced needs",
          price: "99.99",
          yearlyPrice: "999.99",
          stripePriceId: "price_enterprise_monthly",
          stripeYearlyPriceId: "price_enterprise_yearly",
          features: ["Unlimited users", "Unlimited shops", "Unlimited forms", "Dedicated support", "Custom integrations", "Advanced analytics"],
          maxUsers: null, // Unlimited
          maxShops: null, // Unlimited
          maxProjects: null, // Unlimited
          storageLimit: null, // Unlimited
          supportLevel: "dedicated",
          trialDays: 30,
          isPopular: false,
          isActive: true,
          sortOrder: 3,
        },
      ]);
      
      console.log("✅ Subscription plans created successfully");
    } else {
      console.log("✅ Subscription plans already exist");
    }

    console.log("🎉 Database initialization completed successfully!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Note: Direct execution removed to prevent interference with main server process
// To run initialization standalone, use: node -e "import('./init-db.js').then(m => m.initializeDatabase())"

export { initializeDatabase };