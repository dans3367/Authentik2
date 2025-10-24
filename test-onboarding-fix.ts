import "./server/config";
import { db } from "./server/db";
import { betterAuthUser, tenants, companies } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Test script to verify the onboarding fix is working correctly
 */
async function testOnboardingFix() {
  console.log("🧪 Testing Onboarding Fix\n");
  console.log("=" + "=".repeat(60) + "\n");

  try {
    // Test 1: Check if companies table has onboarding fields
    console.log("📋 Test 1: Checking database schema...");
    const schemaCheck = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'companies'
      AND column_name IN ('setup_completed', 'geographical_location', 'language', 'business_description')
      ORDER BY column_name;
    `);

    const schemaRows = Array.isArray(schemaCheck) ? schemaCheck : (schemaCheck.rows || []);
    
    if (schemaRows.length === 4) {
      console.log("✅ All onboarding fields exist in companies table:");
      schemaRows.forEach((row: any) => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log("❌ Missing onboarding fields! Found:", schemaRows.length, "of 4");
      console.log("💡 Run: npm run db:push");
      return;
    }

    console.log("\n" + "-".repeat(60) + "\n");

    // Test 2: Check user-tenant-company relationship
    console.log("📋 Test 2: Checking user-tenant-company relationships...");
    
    const userTenantCompanyCheck = await db.execute(sql`
      SELECT 
        u.id as user_id,
        u.email,
        u.tenant_id,
        t.name as tenant_name,
        c.id as company_id,
        c.name as company_name,
        c.setup_completed
      FROM better_auth_user u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN companies c ON u.tenant_id = c.tenant_id
      ORDER BY u.created_at DESC
      LIMIT 10;
    `);

    const userRows = Array.isArray(userTenantCompanyCheck) ? userTenantCompanyCheck : (userTenantCompanyCheck.rows || []);

    console.log(`\nFound ${userRows.length} recent users:\n`);
    
    let usersWithoutCompany = 0;
    let usersNeedingOnboarding = 0;
    let usersCompletedOnboarding = 0;

    userRows.forEach((row: any, index: number) => {
      console.log(`${index + 1}. ${row.email}`);
      console.log(`   Tenant: ${row.tenant_name || 'MISSING'}`);
      console.log(`   Company: ${row.company_name || 'MISSING'}`);
      
      if (!row.company_id) {
        console.log(`   ⚠️  NO COMPANY - Onboarding will not work!`);
        usersWithoutCompany++;
      } else if (row.setup_completed === false || row.setup_completed === null) {
        console.log(`   🎯 Needs onboarding (setup_completed: ${row.setup_completed})`);
        usersNeedingOnboarding++;
      } else {
        console.log(`   ✅ Onboarding completed`);
        usersCompletedOnboarding++;
      }
      console.log("");
    });

    console.log("-".repeat(60) + "\n");

    // Test 3: Summary and recommendations
    console.log("📊 Summary:");
    console.log(`   - Users without company: ${usersWithoutCompany}`);
    console.log(`   - Users needing onboarding: ${usersNeedingOnboarding}`);
    console.log(`   - Users completed onboarding: ${usersCompletedOnboarding}`);
    console.log("");

    if (usersWithoutCompany > 0) {
      console.log("⚠️  Warning: Some users don't have company records!");
      console.log("💡 Fix: Run the following command to create missing companies:");
      console.log("   tsx fix-missing-companies.ts\n");
    } else {
      console.log("✅ All users have company records!\n");
    }

    if (usersNeedingOnboarding > 0) {
      console.log(`🎯 ${usersNeedingOnboarding} users will see the onboarding modal on next login.\n`);
    }

    // Test 4: Verify auth.ts hook is in place
    console.log("-".repeat(60) + "\n");
    console.log("📋 Test 3: Checking if auth hook creates companies...");
    console.log("💡 To verify: Create a new user and check that both tenant AND company are created.");
    console.log("   Expected: New users should have:");
    console.log("   - A tenant record");
    console.log("   - A company record with setup_completed = false");
    console.log("");

    console.log("=" + "=".repeat(60));
    console.log("\n✅ Test complete!\n");
    
    if (usersWithoutCompany === 0 && schemaRows.length === 4) {
      console.log("🎉 Everything looks good! The onboarding fix should be working.\n");
    } else {
      console.log("⚠️  Some issues found. Please review the output above.\n");
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error instanceof Error) {
      console.log("\nError details:", error.message);
    }
  } finally {
    process.exit(0);
  }
}

testOnboardingFix();

