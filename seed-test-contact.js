// Load environment variables first
import "./server/config.ts";

import { db } from "./server/db";
import { emailContacts, tenants } from "./shared/schema";
import { eq } from "drizzle-orm";

// Seed a test contact for dan@zendwise.com
async function seedTestContact() {
  console.log("🌱 Seeding test contact for dan@zendwise.com...");

  try {
    // Use the default tenant ID from schema
    const tenantId = '29c69b4f-3129-4aa4-a475-7bf892e5c5b9';
    const testEmail = 'dan@zendwise.com';

    console.log(`📍 Using default tenant: ${tenantId}`);
    console.log('Checking for existing contact:', testEmail);

    // Check if contact already exists
    const existingContact = await db.query.emailContacts.findFirst({
      where: eq(emailContacts.email, testEmail),
    });

    if (existingContact) {
      console.log('✅ Contact already exists:', existingContact);
      return existingContact;
    }

    console.log('Creating new test contact for:', testEmail);

    // Create new contact
    const newContact = {
      tenantId,
      email: testEmail,
      firstName: 'Dan',
      lastName: 'Test',
      status: 'active',
      emailsSent: 0,
      emailsOpened: 0,
      consentGiven: true,
      consentMethod: 'manual_add',
      addedByUserId: null,
    };

    const result = await db.insert(emailContacts).values(newContact).returning();

    console.log('✅ Created test contact:', result[0]);
    console.log('🎉 Test contact seeding completed for dan@zendwise.com!');
    return result[0];

  } catch (error) {
    console.error('❌ Error seeding test contact:', error);
    throw error;
  }
}

// Run the seed function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestContact()
    .then(() => {
      console.log("✅ Seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}

export { seedTestContact };
