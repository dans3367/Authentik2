import { config } from "dotenv";
import { readFileSync } from "fs";

// Load environment variables first
config();

// Read .env file and set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  try {
    const envContent = readFileSync('.env', 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('DATABASE_URL=')) {
        process.env.DATABASE_URL = line.split('=')[1];
        break;
      }
    }
  } catch (error) {
    console.error('Error reading .env file:', error);
  }
}

import { db } from "../server/db";
import { betterAuthUser, betterAuthAccount, tenants, companies } from "@shared/schema";
import { auth } from "../server/auth";
import { eq, sql } from "drizzle-orm";

interface OwnerUserConfig {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface CompanyConfig {
  name: string;
  slug: string;
  description: string;
  website?: string;
  industry: string;
  maxUsers: number;
}

const COMPANY_CONFIG: CompanyConfig = {
  name: "Example Corporation",
  slug: "example-corp",
  description: "Example Corporation - Demo company for Owner users",
  website: "https://example.com",
  industry: "Technology",
  maxUsers: 100
};

const OWNER_USERS: OwnerUserConfig[] = [
  {
    email: "owner@example.com",
    name: "Owner User",
    firstName: "Owner",
    lastName: "User",
    password: "password123"
  },
  {
    email: "owner2@example.com",
    name: "Owner User 2", 
    firstName: "Owner",
    lastName: "User 2",
    password: "password123"
  }
];

async function createOwnerCompanySeeder() {
  console.log("🚀 Starting Owner Company Seeder...");
  console.log("📋 This seeder will:");
  console.log("   1. Create a separate company/tenant for Owner users");
  console.log("   2. Create two Owner users with proper BetterAuth authentication");
  console.log("   3. Assign users to the new company");
  
  try {
    // Step 1: Check if the company already exists
    console.log(`\n🔍 Checking if company "${COMPANY_CONFIG.name}" already exists...`);
    
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, COMPANY_CONFIG.slug))
      .limit(1);

    let companyTenant;
    
    if (existingTenant.length > 0) {
      console.log(`✅ Company tenant "${COMPANY_CONFIG.name}" already exists`);
      companyTenant = existingTenant[0];
    } else {
      // Step 2: Create the company tenant
      console.log(`📝 Creating new company tenant: ${COMPANY_CONFIG.name}`);
      
      const [newTenant] = await db.insert(tenants).values({
        name: COMPANY_CONFIG.name,
        slug: COMPANY_CONFIG.slug,
        isActive: true,
        maxUsers: COMPANY_CONFIG.maxUsers,
        settings: JSON.stringify({
          description: COMPANY_CONFIG.description,
          website: COMPANY_CONFIG.website,
          industry: COMPANY_CONFIG.industry,
          created_by_seeder: true
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      companyTenant = newTenant;
      console.log(`✅ Company tenant created with ID: ${companyTenant.id}`);
    }

    // Step 3: Process each Owner user
    let firstOwnerId: string | null = null;
    
    for (const userData of OWNER_USERS) {
      console.log(`\n👤 Processing user: ${userData.email}`);

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(betterAuthUser)
        .where(eq(betterAuthUser.email, userData.email))
        .limit(1);

      if (existingUser.length > 0) {
        console.log(`⚠️  User ${userData.email} already exists, updating tenant and role...`);
        
        // Update existing user to belong to our company tenant
        await db
          .update(betterAuthUser)
          .set({
            tenantId: companyTenant.id,
            role: "Owner",
            emailVerified: true,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(betterAuthUser.id, existingUser[0].id));

        if (!firstOwnerId) {
          firstOwnerId = existingUser[0].id;
        }
        
        console.log(`✅ Updated ${userData.email} - moved to company tenant`);
        continue;
      }

      console.log(`📝 Creating new user ${userData.email} using BetterAuth API...`);

      try {
        // Use BetterAuth's proper API for user creation
        const signUpResult = await auth.api.signUpEmail({
          body: {
            email: userData.email,
            password: userData.password,
            name: userData.name,
          }
        });

        if (signUpResult?.user) {
          console.log(`✅ User ${userData.email} created via BetterAuth API!`);
          
          // Update with Owner role and assign to company tenant
          await db
            .update(betterAuthUser)
            .set({
              role: "Owner",
              tenantId: companyTenant.id,
              emailVerified: true,
              isActive: true,
              firstName: userData.firstName,
              lastName: userData.lastName,
              updatedAt: new Date(),
            })
            .where(eq(betterAuthUser.id, signUpResult.user.id));

          if (!firstOwnerId) {
            firstOwnerId = signUpResult.user.id;
          }

          console.log(`✅ Updated ${userData.email} with Owner role and company assignment`);
          console.log(`   📧 Email: ${userData.email}`);
          console.log(`   🔑 Password: ${userData.password}`);
          console.log(`   👤 Role: Owner`);
          console.log(`   🏢 Company: ${COMPANY_CONFIG.name}`);
          console.log(`   🆔 Tenant ID: ${companyTenant.id}`);
        } else {
          console.error(`❌ Failed to create user ${userData.email} - no user returned from BetterAuth`);
        }

      } catch (authError: any) {
        console.error(`❌ BetterAuth API error for ${userData.email}:`, authError.message);
        console.log(`🔄 Attempting fallback creation method...`);
        
        // Fallback: Try using the handler method
        try {
          const createUserRequest = new Request("http://localhost:5000/api/auth/sign-up/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: userData.email,
              password: userData.password,
              name: userData.name,
            }),
          });

          const response = await auth.handler(createUserRequest);
          
          if (response.status === 200 || response.status === 201) {
            console.log(`✅ User ${userData.email} created via fallback method!`);
            
            // Find the created user and update it
            const newUser = await db
              .select()
              .from(betterAuthUser)
              .where(eq(betterAuthUser.email, userData.email))
              .limit(1);

            if (newUser.length > 0) {
              await db
                .update(betterAuthUser)
                .set({
                  role: "Owner",
                  tenantId: companyTenant.id,
                  emailVerified: true,
                  isActive: true,
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  updatedAt: new Date(),
                })
                .where(eq(betterAuthUser.id, newUser[0].id));

              if (!firstOwnerId) {
                firstOwnerId = newUser[0].id;
              }

              console.log(`✅ Updated ${userData.email} with Owner role`);
            }
          } else {
            console.error(`❌ Fallback method also failed for ${userData.email}`);
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback creation failed for ${userData.email}:`, fallbackError);
        }
      }
    }

    // Step 4: Create company record if we have at least one owner
    if (firstOwnerId) {
      console.log(`\n🏢 Creating company record...`);
      
      const existingCompany = await db
        .select()
        .from(companies)
        .where(sql`${companies.name} = ${COMPANY_CONFIG.name} AND ${companies.tenantId} = ${companyTenant.id}`)
        .limit(1);

      if (existingCompany.length === 0) {
        await db.insert(companies).values({
          tenantId: companyTenant.id,
          ownerId: firstOwnerId,
          name: COMPANY_CONFIG.name,
          description: COMPANY_CONFIG.description,
          website: COMPANY_CONFIG.website,
          companyType: "Corporation",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`✅ Company record created for ${COMPANY_CONFIG.name}`);
      } else {
        console.log(`✅ Company record already exists for ${COMPANY_CONFIG.name}`);
      }
    }

    // Step 5: Verification - Show final status
    console.log(`\n📊 Final Status Report:`);
    console.log(`🏢 Company: ${COMPANY_CONFIG.name}`);
    console.log(`🆔 Tenant ID: ${companyTenant.id}`);
    console.log(`📝 Slug: ${COMPANY_CONFIG.slug}`);
    
    const companyUsers = await db
      .select()
      .from(betterAuthUser)
      .where(sql`${betterAuthUser.tenantId} = ${companyTenant.id} AND ${betterAuthUser.role} = 'Owner'`);

    console.log(`\n👥 Owner Users in Company:`);
    companyUsers.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id}, Verified: ${user.emailVerified}, Active: ${user.isActive})`);
    });

    console.log(`\n🎉 Owner Company Seeder completed successfully!`);
    console.log(`\n📋 Next Steps:`);
    console.log(`   1. Users can login at the frontend with their credentials`);
    console.log(`   2. Both users have full Owner privileges`);
    console.log(`   3. They belong to the separate company: "${COMPANY_CONFIG.name}"`);
    console.log(`   4. Company has its own tenant ID: ${companyTenant.id}`);

  } catch (error) {
    console.error("❌ Error in Owner Company Seeder:", error);
    throw error;
  }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createOwnerCompanySeeder()
    .then(() => {
      console.log("✅ Seeder completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeder failed:", error);
      process.exit(1);
    });
}

export { createOwnerCompanySeeder, COMPANY_CONFIG, OWNER_USERS };
