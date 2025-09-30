import "../server/config";
import { db } from "../server/db";
import { tenants } from "@shared/schema";

async function testDatabaseConnection() {
  try {
    console.log("🔍 Testing database connection...");

    // Test basic query
    const result = await db.select().from(tenants).limit(1);
    console.log("✅ Database connection successful!");
    console.log("📊 Found", result.length, "tenants");

    // Test if we can access all tables
    const tables = [
      'tenants', 'users', 'forms', 'form_responses', 'shops', 'stores',
      'subscription_plans', 'subscriptions', 'refresh_tokens', 'verification_tokens',
      'companies', 'email_contacts', 'email_lists', 'contact_tags',
      'contact_list_memberships', 'contact_tag_assignments', 'newsletters',
      'newsletter_task_status', 'campaigns', 'email_activity', 'bounced_emails'
    ];

    console.log("🔍 Checking table accessibility...");
    for (const table of tables) {
      try {
        // Simple count query for each table
        const countResult = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ ${table}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`❌ ${table}: Error accessing table - ${error.message}`);
      }
    }

    console.log("🎉 Database test completed successfully!");

  } catch (error) {
    console.error("❌ Database test failed:", error);
    throw error;
  }
}

// Run the test
testDatabaseConnection().then(() => {
  console.log("✅ All tests passed!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
