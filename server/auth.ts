import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification, tenants } from "@shared/schema";
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
        defaultValue: "2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff", // Temporary default, will be updated by signup hook
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
    },
  },
  // Hooks to create tenant automatically on user signup
  hooks: {
    after: [
      {
        matcher: () => true,
        handler: async (context: any) => {
          // Only run on user creation (sign up)
          if (context.type === "user.created") {
            try {
              const user = context.user;
              console.log(`🔧 Creating tenant for new user: ${user.email}`);

              // Create a tenant for the new user
              const companyName = user.name ? `${user.name}'s Organization` : "My Organization";
              
              // Generate a unique slug
              let baseSlug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
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

              const [newTenant] = await db.insert(tenants).values({
                name: companyName,
                slug: slug,
                isActive: true,
                maxUsers: 10,
              }).returning();

              // Update the user with the new tenant ID
              await db.update(betterAuthUser)
                .set({
                  tenantId: newTenant.id,
                  role: 'Owner',
                  updatedAt: new Date(),
                })
                .where(eq(betterAuthUser.id, user.id));

              console.log(`✅ Tenant created for ${user.email}:`, {
                tenantId: newTenant.id,
                tenantName: newTenant.name,
                tenantSlug: newTenant.slug,
              });
            } catch (error) {
              console.error('❌ Failed to create tenant for new user:', error);
              // Don't throw - allow signup to complete even if tenant creation fails
              // User will be assigned to default tenant and can be manually migrated later
            }
          }
        },
      },
    ],
  },
});

// For Express integration, we need to extract the handler
export const auth = authInstance;
