import { db } from "./db";
import { users, tenants } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function updateUserToOwner() {
  try {
    console.log("🔧 Updating dan@zendwise.com to Owner role...");

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

    // Find the user by email in the default tenant
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, "dan@zendwise.com"), eq(users.tenantId, defaultTenant.id)))
      .limit(1);

    if (!user) {
      console.error("❌ User dan@zendwise.com not found in default tenant");
      return;
    }

    console.log("📝 Found user:", user.id);

    // Update the user's role to Owner
    const [updatedUser] = await db
      .update(users)
      .set({ 
        role: "Owner",
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))
      .returning();

    if (updatedUser) {
      console.log("✅ Successfully updated dan@zendwise.com to Owner role");
      console.log("📊 Updated user details:", {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId
      });
    } else {
      console.error("❌ Failed to update user role");
    }

  } catch (error) {
    console.error("❌ Error updating user role:", error);
    throw error;
  }
}

// Run the update if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateUserToOwner()
    .then(() => {
      console.log("✅ User role update completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ User role update failed:", error);
      process.exit(1);
    });
}

export { updateUserToOwner }; 