import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "./db";
import { betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification, tenants, companies } from "@shared/schema";
import { triggerTransactionalEmail } from "./lib/trigger";
import { eq, sql } from "drizzle-orm";

export function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET environment variable is not set. Refusing to start with an insecure fallback.");
  }
  return secret;
}

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
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Password reset functionality will be handled by custom implementation
    // Better Auth hooks will manage tenant synchronization
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      try {
        // Persist the token on the user row so the verify-email endpoint can
        // enforce single-use (cleared after consumption).
        await db.update(betterAuthUser)
          .set({
            emailVerificationToken: token,
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(betterAuthUser.id, user.id));

        console.log(`📧 [Auth] Dispatching verification email via Trigger.dev + SES for: ${user.email}`);
        const result = await triggerTransactionalEmail({
          type: "verification",
          recipientEmail: user.email,
          recipientName: (user as any).firstName || user.name?.split(' ')[0],
          verificationToken: token,
          baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || "5002"}`,
          appName: process.env.APP_NAME || "Zendwise",
        });
        if (result.success) {
          console.log(`✅ [Auth] Verification email task dispatched, runId: ${result.runId}`);
        } else {
          console.error(`❌ [Auth] Failed to dispatch verification email task:`, result.error);
          // Don't block signup — user can resend via /resend-verification
        }
      } catch (error) {
        console.error("❌ [Auth] Failed to send verification email:", error);
        // Don't block signup — user can resend via /resend-verification
      }
    },
  },
  socialProviders: {
    // Configure social providers as needed
    // Example: google, github, etc.
  },
  baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || "5002"}`,
  secret: getAuthSecret(),
  trustedOrigins: [
    `http://localhost:${process.env.PORT || "5002"}`,
    "http://localhost:5173",
    "https://weby.zendwise.work",
    "https://websy.zendwise.work",
    "https://webx.zendwise.work",
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "",
    // Additional trusted origins from environment (comma-separated)
    ...(process.env.TRUSTED_ORIGINS?.split(",").map(o => o.trim()) || []),
    // Development-only: allow local network access
    ...(process.env.NODE_ENV !== "production" ? [
      "http://127.0.0.1:35145",
      "http://weby.zendwise.work:3001",
      "http://websy.zendwise.work:3001",
      "http://webx.zendwise.work",
    ] : []),
  ].filter(Boolean),
  // Add session callback to include custom user fields
  session: {
    updateAge: 24 * 60 * 60, // 24 hours
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: false, // Disable cookie caching to ensure profile updates are reflected immediately
    },
  },
  // Cookie configuration for cross-origin/IP access
  advanced: {
    cookiePrefix: "better-auth",
    crossSubDomainCookies: {
      enabled: false, // Disable for IP access
    },
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
    },
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
      timezone: {
        type: "string",
        defaultValue: "America/Chicago",
        required: false,
      },
    },
  },
  // Hooks to create tenant automatically on user signup
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Declare variables outside try block for accessibility in catch
      let userRecord: any = null;
      let email = '';

      try {
        // Only run after sign-up endpoints
        const path = ctx.path || "";
        if (!path.includes("sign-up")) return;

        // Determine user email
        email = ctx.body?.email || (ctx.context.returned as any)?.user?.email;
        if (!email) {
          console.log('⚠️  [Signup Hook] No email found in context');
          return;
        }

        // Fetch the created user
        userRecord = await db.query.betterAuthUser.findFirst({
          where: eq(betterAuthUser.email, email.toLowerCase())
        });

        if (!userRecord) {
          console.log(`⚠️  [Signup Hook] User not found: ${email}`);
          return;
        }

        // Check if user already has a valid tenant (not a placeholder)
        const placeholderTenantIds = [
          '00000000-0000-0000-0000-000000000000', // New placeholder
          '29c69b4f-3129-4aa4-a475-7bf892e5c5b9', // Old default tenant
          '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff', // Old temp default tenant
        ];

        if (userRecord.tenantId && !placeholderTenantIds.includes(userRecord.tenantId)) {
          console.log(`✅ [Signup Hook] User ${userRecord.email} already has valid tenant: ${userRecord.tenantId}`);
          return;
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
      } catch (error) {
        console.error('❌ ❌ ❌ [Signup Hook] CRITICAL ERROR - Failed to create tenant for new user:', error);
        console.error('❌ [Signup Hook] User email:', userRecord?.email || email || 'unknown');
        console.error('❌ [Signup Hook] Error details:', error);
        // Don't throw - allow signup to complete even if tenant creation fails
        // User will be assigned to default tenant and can be manually migrated later
      }
    }),
  },
});

// For Express integration, we need to extract the handler
export const auth = authInstance;
