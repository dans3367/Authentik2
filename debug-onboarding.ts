import "./server/config";
import { db } from "./server/db";
import { companies } from "@shared/schema";
import { sql } from "drizzle-orm";

async function debugOnboarding() {
  try {
    console.log("🔍 Checking onboarding status...\n");

    // Check if companies table exists and has data
    const allCompanies = await db.select({
      id: companies.id,
      name: companies.name,
      setupCompleted: companies.setupCompleted,
      geographicalLocation: companies.geographicalLocation,
      language: companies.language,
      businessDescription: companies.businessDescription,
      createdAt: companies.createdAt,
    }).from(companies).orderBy(sql`${companies.createdAt} DESC`);

    console.log(`📊 Found ${allCompanies.length} companies:`);
    
    if (allCompanies.length === 0) {
      console.log("❌ No companies found! This could be why onboarding isn't showing.");
      console.log("💡 Possible issues:");
      console.log("   - No company was created during user registration");
      console.log("   - User is not associated with a company");
      console.log("   - Database migration failed");
      return;
    }

    allCompanies.forEach((company, index) => {
      console.log(`\n${index + 1}. Company: ${company.name}`);
      console.log(`   ID: ${company.id}`);
      console.log(`   Setup Completed: ${company.setupCompleted}`);
      console.log(`   Geographical Location: ${company.geographicalLocation || 'Not set'}`);
      console.log(`   Language: ${company.language || 'Not set'}`);
      console.log(`   Business Description: ${company.businessDescription ? 'Set' : 'Not set'}`);
      console.log(`   Created At: ${company.createdAt}`);
      
      if (company.setupCompleted === false) {
        console.log(`   🎯 This company SHOULD show onboarding modal`);
      } else if (company.setupCompleted === true) {
        console.log(`   ✅ This company has completed onboarding`);
      } else if (company.setupCompleted === null) {
        console.log(`   ⚠️  This company has NULL setupCompleted (should be false by default)`);
      }
    });

    // Check for companies that should show onboarding
    const needsOnboarding = allCompanies.filter(c => c.setupCompleted === false || c.setupCompleted === null);
    
    console.log(`\n📋 Summary:`);
    console.log(`   - Total companies: ${allCompanies.length}`);
    console.log(`   - Companies needing onboarding: ${needsOnboarding.length}`);
    console.log(`   - Companies completed onboarding: ${allCompanies.filter(c => c.setupCompleted === true).length}`);

    if (needsOnboarding.length > 0) {
      console.log(`\n💡 Expected behavior: Onboarding modal should appear for companies with setupCompleted = false`);
    } else {
      console.log(`\n🤔 All companies have completed onboarding, so modal won't show`);
    }

  } catch (error) {
    console.error("❌ Error checking onboarding status:", error);
    if (error instanceof Error) {
      if (error.message.includes('relation "companies" does not exist')) {
        console.log("💡 The companies table doesn't exist. Run database migrations:");
        console.log("   npm run db:push");
      } else if (error.message.includes('column "setup_completed" does not exist')) {
        console.log("💡 The setup_completed column is missing. Run database migrations:");
        console.log("   npm run db:push");
      }
    }
  } finally {
    process.exit(0);
  }
}

debugOnboarding();