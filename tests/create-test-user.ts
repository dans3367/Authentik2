import { config } from "dotenv";
config(); // Load environment variables

import { db } from "../server/db";
import { users, tenants } from "../shared/schema";
import { eq } from "drizzle-orm";
// Note: bcrypt removed - Better Auth handles password hashing

async function createTestUser() {
  try {
    console.log("🔧 Creating test user...");

    // First, get the default tenant
    const [defaultTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, "default"))
      .limit(1);

    if (!defaultTenant) {
      console.error("❌ Default tenant not found");
      return;
    }

    console.log("📝 Found default tenant:", defaultTenant.id);

    // Note: Password hashing removed - Better Auth handles authentication
    // Test user will need to set password through Better Auth registration

    // Create the test user
    const [user] = await db
      .insert(users)
      .values({
        tenantId: defaultTenant.id,
        email: "beats@zendwise.work",
        // Note: password field removed - Better Auth handles authentication
        firstName: "Test",
        lastName: "User",
        role: "Employee",
        emailVerified: true,
        isActive: true,
      })
      .returning();

    if (user) {
      console.log("✅ Successfully created test user:");
      console.log("📊 User details:", {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        emailVerified: user.emailVerified
      });
      console.log("🔑 Password: Use Better Auth registration to set password");
    } else {
      console.error("❌ Failed to create test user");
    }

  } catch (error) {
    console.error("❌ Error creating test user:", error);
    throw error;
  }
}

// Run the creation if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestUser()
    .then(() => {
      console.log("✅ Test user creation completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Test user creation failed:", error);
      process.exit(1);
    });
}

export { createTestUser };