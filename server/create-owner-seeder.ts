import { db } from "./db";
import { betterAuthUser, tenants } from "@shared/schema";
import { auth } from "./auth";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";

async function createOwnerSeeder() {
  console.log("🔧 Creating owner seeder using better-auth practices...");

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

    // Check if owner user already exists
    const existingOwner = await db
      .select()
      .from(betterAuthUser)
      .where(eq(betterAuthUser.email, "owner@example.com"))
      .limit(1);

    if (existingOwner.length > 0) {
      console.log("✅ Owner user already exists");
      return;
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

    console.log("📝 Creating owner user using better-auth API...");

    // Use better-auth's API to create the user properly
    // This follows better-auth best practices by using the framework's own methods
    const createUserRequest = new Request("http://localhost:3001/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "password123",
        name: "Owner User",
      }),
    });

    // Call the better-auth sign-up endpoint
    const response = await auth.handler(createUserRequest);

    if (response.status === 200) {
      console.log("✅ Owner user created successfully via better-auth API!");
      console.log("📧 Email: owner@example.com");
      console.log("🔑 Password: password123");
      console.log("👤 Role: Owner (will be set after login)");
      console.log("🏢 Tenant: Default Organization");

      // Now update the user to set the role and tenant
      const user = await db
        .select()
        .from(betterAuthUser)
        .where(eq(betterAuthUser.email, "owner@example.com"))
        .limit(1);

      if (user.length > 0) {
        await db
          .update(betterAuthUser)
          .set({
            role: "Owner",
            tenantId: defaultTenant[0].id,
            updatedAt: new Date(),
          })
          .where(eq(betterAuthUser.id, user[0].id));

        console.log("✅ User role and tenant updated successfully!");
      }
    } else {
      const responseText = await response.text();
      console.error("❌ Failed to create user via better-auth API:", response.status, responseText);
      throw new Error(`Failed to create user: ${response.status}`);
    }

  } catch (error) {
    console.error("❌ Error creating owner seeder:", error);
    throw error;
  }
}

// Execute the seeder if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createOwnerSeeder()
    .then(() => {
      console.log("🎉 Owner seeder completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Owner seeder failed:", error);
      process.exit(1);
    });
}

export { createOwnerSeeder };
