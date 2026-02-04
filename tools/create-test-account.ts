import "./server/config";
import { db } from "./server/db";
import { betterAuthUser, tenants, companies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

/**
 * Creates a test account to verify the signup flow
 * This simulates what the auth hook should do
 */
async function createTestAccount() {
  const testEmail = `testuser${Date.now()}@example.com`;
  const testCompanyName = "Test Company for Onboarding";
  
  console.log("🧪 Creating Test Account for Onboarding Verification\n");
  console.log("=" + "=".repeat(60) + "\n");

  try {
    // Step 1: Check if user already exists
    console.log(`📝 Step 1: Checking if ${testEmail} exists...`);
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, testEmail),
    });

    if (existingUser) {
      console.log(`❌ User ${testEmail} already exists!`);
      console.log(`   Delete it first or use a different email.\n`);
      return;
    }
    console.log(`✅ Email is available\n`);

    // Step 2: Create tenant
    console.log(`📝 Step 2: Creating tenant "${testCompanyName}"...`);
    const [newTenant] = await db.insert(tenants).values({
      name: testCompanyName,
      slug: `test-company-${Date.now()}`,
      isActive: true,
      maxUsers: 10,
    }).returning();
    console.log(`✅ Tenant created:`, {
      id: newTenant.id,
      name: newTenant.name,
      slug: newTenant.slug,
    });
    console.log("");

    // Step 3: Create user
    console.log(`📝 Step 3: Creating user ${testEmail}...`);
    const userId = randomUUID();
    
    const [newUser] = await db.insert(betterAuthUser).values({
      id: userId,
      email: testEmail,
      name: "Test User",
      emailVerified: true, // Pre-verify for easier testing
      role: 'Owner',
      tenantId: newTenant.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    console.log(`✅ User created:`, {
      id: newUser.id,
      email: newUser.email,
      tenantId: newUser.tenantId,
    });
    console.log("");

    // Step 4: Create company with setupCompleted: false
    console.log(`📝 Step 4: Creating company record with setupCompleted: false...`);
    const [newCompany] = await db.insert(companies).values({
      tenantId: newTenant.id,
      ownerId: newUser.id,
      name: testCompanyName,
      setupCompleted: false, // This should trigger the onboarding modal
      isActive: true,
    }).returning();
    console.log(`✅ Company created:`, {
      id: newCompany.id,
      name: newCompany.name,
      setupCompleted: newCompany.setupCompleted,
      tenantId: newCompany.tenantId,
    });
    console.log("");

    // Step 5: Verify everything is correct
    console.log("=" + "=".repeat(60));
    console.log("\n✅ Test Account Created Successfully!\n");
    console.log("📋 Account Details:");
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: Test123!`);
    console.log(`   Company: ${testCompanyName}`);
    console.log(`   Setup Completed: ${newCompany.setupCompleted}\n`);

    console.log("🧪 Testing Instructions:");
    console.log("   1. Start the server: npm run dev");
    console.log("   2. Open browser and go to login page");
    console.log(`   3. Log in with: ${testEmail} / Test123!`);
    console.log("   4. Watch browser console for:");
    console.log("      🏢 [Onboarding] Checking onboarding status");
    console.log("      🏢 [Onboarding] Company data: { setupCompleted: false }");
    console.log("      🎯 [Onboarding] Showing onboarding modal");
    console.log("   5. Watch server console for:");
    console.log("      🏢 [GET /api/company] Found company: { setupCompleted: false }");
    console.log("   6. ✅ Onboarding modal should appear!\n");

    console.log("🔍 Verification Queries:");
    console.log(`   SELECT * FROM better_auth_user WHERE email = '${testEmail}';`);
    console.log(`   SELECT * FROM companies WHERE tenant_id = '${newTenant.id}';`);
    console.log("");

  } catch (error) {
    console.error("❌ Failed to create test account:", error);
  } finally {
    process.exit(0);
  }
}

createTestAccount();

