import "./server/config";
import { db } from "./server/db";
import { companies } from "@shared/schema";
import { sql } from "drizzle-orm";

async function resetOnboarding() {
  try {
    console.log("🔄 Resetting onboarding status for all companies...\n");

    // Reset all companies to require onboarding
    const result = await db.update(companies)
      .set({
        setupCompleted: false,
        geographicalLocation: null,
        language: 'en', // Keep language default
        businessDescription: null,
        updatedAt: new Date(),
      })
      .returning({
        id: companies.id,
        name: companies.name,
      });

    console.log(`✅ Successfully reset onboarding for ${result.length} companies:`);
    result.forEach(company => {
      console.log(`   - ${company.name} (${company.id})`);
    });

    console.log(`\n🎯 Now when you reload the app, the onboarding modal should appear!`);
    console.log(`\n📝 What to expect:`);
    console.log(`   1. Refresh your browser`);
    console.log(`   2. The onboarding wizard should appear as a modal`);
    console.log(`   3. You'll go through Step 1 (location & language) and Step 2 (business description)`);
    console.log(`   4. After completion, setupCompleted will be set to true`);

  } catch (error) {
    console.error("❌ Error resetting onboarding:", error);
  } finally {
    process.exit(0);
  }
}

resetOnboarding();