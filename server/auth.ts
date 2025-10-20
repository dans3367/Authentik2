import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification, tenants, companies } from "@shared/schema";
import { emailService } from "./emailService";
import { eq, sql } from "drizzle-orm";

const authInstance = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: betterAuthUser,
      session: betterAuthSession,
      account: betterAuthAccount,
      verification: betterAuthVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Password reset functionality will be handled by custom implementation
    // Better Auth hooks will manage tenant synchronization
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      try {
        await emailService.sendVerificationEmail(user.email, token);
      } catch (error) {
        console.error("Failed to send verification email:", error);
        throw error;
      }
    },
  },
  socialProviders: {
    // Configure social providers as needed
    // Example: google, github, etc.
  },
  baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || "5000"}`,
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-key-change-in-production",
  trustedOrigins: [
    `http://localhost:${process.env.PORT || "5000"}`,
    "http://localhost:5173",
    "http://127.0.0.1:35145", // Browser preview URL
    "https://weby.zendwise.work",
    "http://weby.zendwise.work:3001",
    "http://websy.zendwise.work:3001",
    "https://websy.zendwise.work",
    "http://webx.zendwise.work",
    "https://webx.zendwise.work",
    "https://2850dacc-d7a0-40e0-a90b-43f06888d139-00-18hp2u206zmhk.kirk.replit.dev",
    "https://057ace97-08a0-4add-bf8a-36081a149b23-00-2keem4p96xbcw.janeway.replit.dev",
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : ""
  ].filter(Boolean),
  // Add session callback to include custom user fields
  session: {
    updateAge: 24 * 60 * 60, // 24 hours
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "Owner", // New users are owners of their own tenant
        required: false,
      },
      tenantId: {
        type: "string",
        defaultValue: "00000000-0000-0000-0000-000000000000", // Temporary placeholder, MUST be updated by signup hook
        required: false,
      },
      firstName: {
        type: "string",
        required: false,
      },
      lastName: {
        type: "string",
        required: false,
      },
      theme: {
        type: "string",
        defaultValue: "light",
        required: false,
      },
      menuExpanded: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
      avatarUrl: {
        type: "string",
        required: false,
      },
    },
  },
  // Hooks to create tenant automatically on user signup
  hooks: {
    after: async (ctx: any) => {
      try {
        // Only run after sign-up endpoints
        const path = ctx?.path || "";
        if (!path.includes("sign-up")) return {};

        // Determine user email
        const email = ctx?.body?.email || ctx?.context?.returned?.user?.email;
        if (!email) {
          console.log('⚠️  [Signup Hook] No email found in context');
          return {};
        }

        // Fetch the created user
        const userRecord = await db.query.betterAuthUser.findFirst({
          where: eq(betterAuthUser.email, email.toLowerCase())
        });
        
        if (!userRecord) {
          console.log(`⚠️  [Signup Hook] User not found: ${email}`);
          return {};
        }
        
        // Check if user already has a valid tenant (not a placeholder)
        const placeholderTenantIds = [
          '00000000-0000-0000-0000-000000000000', // New placeholder
          '29c69b4f-3129-4aa4-a475-7bf892e5c5b9', // Old default tenant
          '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff', // Old temp default tenant
        ];
        
        if (userRecord.tenantId && !placeholderTenantIds.includes(userRecord.tenantId)) {
          console.log(`✅ [Signup Hook] User ${userRecord.email} already has valid tenant: ${userRecord.tenantId}`);
          return {};
        }
        
        console.log(`🔧 [Signup Hook] Creating NEW tenant and company for user: ${userRecord.email}`);

          // Get company name from pending signups (stored by /api/signup/store-company-name)
          const pendingCompanyName = (global as any).pendingCompanyNames?.[userRecord.email.toLowerCase()];
          
          // Create a tenant for the new user
          const companyName = pendingCompanyName || (userRecord.name ? `${userRecord.name}'s Organization` : "My Organization");
          
          console.log(`📝 Company name for ${userRecord.email}: ${companyName}${pendingCompanyName ? ' (from signup form)' : ' (auto-generated)'}`);
          
          // Generate a unique slug
          let baseSlug = userRecord.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
          let slug = baseSlug;
          let attempts = 0;
          
          // Check for slug conflicts and add suffix if needed
          while (attempts < 10) {
            const existingTenant = await db.query.tenants.findFirst({
              where: eq(tenants.slug, slug)
            });
            
            if (!existingTenant) break;
            
            attempts++;
            slug = `${baseSlug}-${attempts}`;
          }

          console.log(`📝 [Signup Hook] Inserting tenant with slug: ${slug}`);
          const [newTenant] = await db.insert(tenants).values({
            name: companyName,
            slug: slug,
            isActive: true,
            maxUsers: 10,
          }).returning();

          if (!newTenant || !newTenant.id) {
            throw new Error('Failed to create tenant - no tenant returned');
          }
          
          console.log(`✅ [Signup Hook] Tenant created: ${newTenant.id}`);

          // Update the user with the new tenant ID
          console.log(`📝 [Signup Hook] Updating user ${userRecord.email} with tenant ${newTenant.id}`);
          const updatedUsers = await db.update(betterAuthUser)
            .set({
              tenantId: newTenant.id,
              role: 'Owner',
              updatedAt: new Date(),
            })
            .where(eq(betterAuthUser.id, userRecord.id))
            .returning();

          if (!updatedUsers || updatedUsers.length === 0) {
            throw new Error('Failed to update user with tenant ID');
          }
          
          console.log(`✅ [Signup Hook] User updated with tenant ID`);

          // Create company record for onboarding
          console.log(`📝 [Signup Hook] Creating company record`);
          const [newCompany] = await db.insert(companies).values({
            tenantId: newTenant.id,
            ownerId: userRecord.id,
            name: companyName,
            setupCompleted: false, // This will trigger the onboarding modal
            isActive: true,
          }).returning();

          if (!newCompany) {
            throw new Error('Failed to create company record');
          }
          
          console.log(`✅ [Signup Hook] Company created: ${newCompany.id}`);

          // Clean up the pending company name
          if ((global as any).pendingCompanyNames && (global as any).pendingCompanyNames[userRecord.email.toLowerCase()]) {
            delete (global as any).pendingCompanyNames[userRecord.email.toLowerCase()];
          }

          console.log(`✅ ✅ ✅ [Signup Hook] SUCCESS! Complete tenant setup for ${userRecord.email}:`, {
            userId: userRecord.id,
            tenantId: newTenant.id,
            tenantName: newTenant.name,
            tenantSlug: newTenant.slug,
            companyId: newCompany.id,
            companyName: companyName,
          });
          return {};
      } catch (error) {
        console.error('❌ ❌ ❌ [Signup Hook] CRITICAL ERROR - Failed to create tenant for new user:', error);
        console.error('❌ [Signup Hook] User email:', email);
        console.error('❌ [Signup Hook] Error details:', error);
        // Don't throw - allow signup to complete even if tenant creation fails
        // User will be assigned to default tenant and can be manually migrated later
        return {};
      }
    },
  },
});

// For Express integration, we need to extract the handler
export const auth = authInstance;
