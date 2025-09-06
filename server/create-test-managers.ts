import dotenv from "dotenv";
dotenv.config();

import { db } from "./db";
import { users, tenants } from "@shared/schema";
// Note: bcrypt removed - better-auth handles password hashing
import { eq } from "drizzle-orm";

async function createTestManagers() {
  try {
    console.log("🔧 Creating test managers...");
    
    // Get default tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, "default"))
      .limit(1);
      
    if (!tenant) {
      console.error("❌ Default tenant not found!");
      return;
    }
    
    console.log("✅ Found tenant:", tenant.name);
    
    // Test users to create
    const testUsers = [
      {
        email: "manager1@example.com",
        firstName: "John",
        lastName: "Manager",
        role: "Manager" as const,
      },
      {
        email: "manager2@example.com", 
        firstName: "Jane",
        lastName: "Smith",
        role: "Manager" as const,
      },
      {
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "User",
        role: "Administrator" as const,
      },
      {
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User", 
        role: "Owner" as const,
      }
    ];
    
    // Note: Password hashing removed - better-auth handles authentication
    
    for (const userData of testUsers) {
      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);
        
      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists, skipping...`);
        continue;
      }
      
      // Create user
      // Note: password field removed - better-auth handles authentication
      await db.insert(users).values({
        id: crypto.randomUUID(),
        email: userData.email,
        // Note: password field removed - better-auth handles authentication
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        isActive: true,
        emailVerified: true,
        tenantId: tenant.id,
      });
      
      console.log(`✅ Created ${userData.role}: ${userData.email}`);
    }
    
    console.log("✅ Test managers created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test managers:", error);
    process.exit(1);
  }
}

createTestManagers();