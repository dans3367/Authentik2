import "./server/config";
import { db } from "./server/db";
import { betterAuthUser, tenants, companies } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

/**
 * This script creates company records for users who have tenants but no companies.
 * This fixes the issue where existing users don't see the onboarding modal.
 */
async function fixMissingCompanies() {
  try {
    console.log("🔍 Checking for users with tenants but no companies...\n");

    // Get all users with their tenant info
    const users = await db.select({
      id: betterAuthUser.id,
      email: betterAuthUser.email,
      name: betterAuthUser.name,
      tenantId: betterAuthUser.tenantId,
    }).from(betterAuthUser);

    console.log(`📊 Found ${users.length} total users`);

    let companiesCreated = 0;
    let companiesSkipped = 0;

    for (const user of users) {
      // Check if company already exists for this tenant
      const existingCompany = await db.query.companies.findFirst({
        where: eq(companies.tenantId, user.tenantId),
      });

      if (existingCompany) {
        console.log(`✅ Company already exists for ${user.email} (${user.tenantId})`);
        companiesSkipped++;
        continue;
      }

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      });

      if (!tenant) {
        console.log(`❌ No tenant found for user ${user.email} (tenantId: ${user.tenantId})`);
        continue;
      }

      // Create company record
      const companyName = tenant.name || (user.name ? `${user.name}'s Organization` : "My Organization");
      
      await db.insert(companies).values({
        tenantId: user.tenantId,
        ownerId: user.id,
        name: companyName,
        setupCompleted: false, // This will trigger the onboarding modal
        isActive: true,
      });

      console.log(`🎉 Created company for ${user.email}: ${companyName}`);
      companiesCreated++;
    }

    console.log(`\n📋 Summary:`);
    console.log(`   - Total users: ${users.length}`);
    console.log(`   - Companies created: ${companiesCreated}`);
    console.log(`   - Companies skipped (already exist): ${companiesSkipped}`);

    if (companiesCreated > 0) {
      console.log(`\n✨ Success! ${companiesCreated} users will now see the onboarding modal on next login.`);
    }

  } catch (error) {
    console.error("❌ Error fixing missing companies:", error);
  } finally {
    process.exit(0);
  }
}

fixMissingCompanies();

