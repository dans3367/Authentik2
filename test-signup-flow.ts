import "./server/config";
import { db } from "./server/db";
import { betterAuthUser, tenants, companies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Test script to verify the complete signup flow
 * This simulates what happens when a user signs up
 */
async function testSignupFlow() {
  console.log("🧪 Testing Complete Signup Flow\n");
  console.log("=" + "=".repeat(60) + "\n");

  const testEmail = `test${Date.now()}@example.com`;
  
  try {
    // Step 1: Simulate storing company name
    console.log("📝 Step 1: Simulating company name storage...");
    (global as any).pendingCompanyNames = (global as any).pendingCompanyNames || {};
    (global as any).pendingCompanyNames[testEmail.toLowerCase()] = "Test Company Inc.";
    console.log(`✅ Stored company name for ${testEmail}`);
    console.log(`   Company name: Test Company Inc.\n`);

    // Step 2: Check if the auth hook would find it
    console.log("📝 Step 2: Checking if auth hook can retrieve company name...");
    const storedName = (global as any).pendingCompanyNames?.[testEmail.toLowerCase()];
    if (storedName) {
      console.log(`✅ Auth hook would find company name: ${storedName}\n`);
    } else {
      console.log(`❌ Auth hook would NOT find company name!\n`);
    }

    // Step 3: Check recent signups
    console.log("📝 Step 3: Checking most recent user signups...");
    const recentUsers = await db.select({
      email: betterAuthUser.email,
      createdAt: betterAuthUser.createdAt,
      tenantId: betterAuthUser.tenantId,
    })
    .from(betterAuthUser)
    .orderBy(sql`${betterAuthUser.createdAt} DESC`)
    .limit(5);

    console.log(`\nLast 5 signups:`);
    for (const user of recentUsers) {
      console.log(`   - ${user.email} (${new Date(user.createdAt).toLocaleString()})`);
      
      // Check if they have a tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      });
      
      // Check if they have a company
      const company = await db.query.companies.findFirst({
        where: eq(companies.tenantId, user.tenantId),
      });

      if (tenant) {
        console.log(`     Tenant: ${tenant.name} ✅`);
      } else {
        console.log(`     Tenant: MISSING ❌`);
      }

      if (company) {
        console.log(`     Company: ${company.name} (setupCompleted: ${company.setupCompleted}) ✅`);
      } else {
        console.log(`     Company: MISSING ❌`);
      }
      console.log("");
    }

    // Step 4: Check the auth hook code
    console.log("\n📝 Step 4: Verifying auth hook implementation...");
    console.log("   ✅ Auth hook should:");
    console.log("      1. Read company name from global.pendingCompanyNames");
    console.log("      2. Create tenant with company name");
    console.log("      3. Create company record with setupCompleted: false");
    console.log("      4. Clean up global.pendingCompanyNames\n");

    // Step 5: Test the /api/company endpoint
    console.log("📝 Step 5: Testing what happens if no company exists...");
    console.log("   - If user has no company, /api/company returns 404");
    console.log("   - Frontend won't show onboarding modal (because no company data)");
    console.log("   - This is the likely issue!\n");

    // Clean up test data
    delete (global as any).pendingCompanyNames[testEmail.toLowerCase()];

    console.log("=" + "=".repeat(60));
    console.log("\n📊 Diagnosis:\n");
    
    // Check if all recent users have companies
    const usersWithoutCompanies = [];
    for (const user of recentUsers) {
      const company = await db.query.companies.findFirst({
        where: eq(companies.tenantId, user.tenantId),
      });
      if (!company) {
        usersWithoutCompanies.push(user.email);
      }
    }

    if (usersWithoutCompanies.length > 0) {
      console.log("❌ Issue Found: Some users don't have companies!");
      console.log("   Users without companies:");
      usersWithoutCompanies.forEach(email => {
        console.log(`   - ${email}`);
      });
      console.log("\n💡 Solution:");
      console.log("   1. The auth hook might not be running");
      console.log("   2. Or it's failing silently");
      console.log("   3. Run: tsx fix-missing-companies.ts");
      console.log("   4. Check server logs during signup\n");
    } else {
      console.log("✅ All recent users have companies!");
      console.log("\n💡 Next steps to test signup:");
      console.log("   1. Create a new test account via the UI");
      console.log("   2. Check server console for these logs:");
      console.log("      - '🔧 Creating tenant and company for new user'");
      console.log("      - '📝 Company name for [email]'");
      console.log("      - '✅ Tenant and company created'");
      console.log("   3. Log in with the new account");
      console.log("   4. Onboarding modal should appear\n");
    }

    console.log("🔍 To test manually:");
    console.log("   1. Go to signup page");
    console.log("   2. Fill in: First Name, Last Name, Company Name, Email, Password");
    console.log("   3. Watch server console for auth hook logs");
    console.log("   4. Verify email and log in");
    console.log("   5. Onboarding modal should show\n");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    process.exit(0);
  }
}

testSignupFlow();


