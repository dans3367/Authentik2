import { db } from "./server/db";
import { betterAuthUser, betterAuthAccount, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

const usersToCreate = [
  {
    email: "owner@example.com",
    password: "password123",
    name: "Owner User",
  },
  {
    email: "owner2@example2.com",
    password: "password123",
    name: "Owner User 2",
  }
];

async function createMultipleOwners() {
  console.log("🔧 Creating multiple owner users using better-auth practices...");

  try {
    // First, ensure we have a default tenant
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, "default"))
      .limit(1);

    if (existingTenant.length === 0) {
      console.log("📝 Creating default tenant...");
      await db.insert(tenants).values({
        name: "Default Organization",
        slug: "default",
        isActive: true,
        maxUsers: 50,
      });
      console.log("✅ Default tenant created");
    }

    // Get the default tenant ID
    const defaultTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, "default"))
      .limit(1);

    if (defaultTenant.length === 0) {
      throw new Error("Default tenant not found");
    }

    const tenantId = defaultTenant[0].id;

    // Create each user
    for (const userData of usersToCreate) {
      console.log(`\n📝 Processing user: ${userData.email}`);

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(betterAuthUser)
        .where(eq(betterAuthUser.email, userData.email))
        .limit(1);

      if (existingUser.length > 0) {
        console.log(`✅ User ${userData.email} already exists`);
        continue;
      }

      console.log(`📝 Creating user ${userData.email} using better-auth API...`);

      // Create user directly in database to bypass email verification
      console.log(`📝 Creating user ${userData.email} directly in database...`);

      // Hash the password using the same method as better-auth
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Insert user directly
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.insert(betterAuthUser).values({
        id: userId,
        name: userData.name,
        email: userData.email,
        emailVerified: true, // Skip verification for testing
        role: "Owner",
        tenantId: tenantId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create the account entry with hashed password
      await db.insert(betterAuthAccount).values({
        id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`✅ User ${userData.email} created successfully!`);
      console.log(`📧 Email: ${userData.email}`);
      console.log(`🔑 Password: ${userData.password}`);
      console.log(`👤 Role: Owner`);
      console.log(`🏢 Tenant: Default Organization`);
    }

  } catch (error) {
    console.error("❌ Error creating multiple owners:", error);
    throw error;
  }
}

// Execute the script if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createMultipleOwners()
    .then(() => {
      console.log("\n🎉 Multiple owners creation completed successfully!");
      console.log("\n📋 Summary:");
      console.log("✅ owner@example.com - Owner role");
      console.log("✅ owner2@example2.com - Owner role");
      console.log("\n🔐 Both users have password: password123");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Multiple owners creation failed:", error);
      process.exit(1);
    });
}

export { createMultipleOwners };
