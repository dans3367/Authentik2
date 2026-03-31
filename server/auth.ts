import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "./db";
import { betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification } from "@shared/schema";
import { triggerTransactionalEmail } from "./lib/trigger";
import { eq } from "drizzle-orm";

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
      isActive: {
        type: "boolean",
        defaultValue: true,
        required: false,
      },
      language: {
        type: "string",
        defaultValue: "en",
        required: false,
      },
    },
  },
  // Hooks — post-signup: parse name into firstName/lastName only.
  // Tenant + company creation is DEFERRED until Stripe payment is confirmed
  // (handled by confirm-checkout and the checkout.session.completed webhook).
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      try {
        const path = ctx.path || "";
        if (!path.includes("sign-up")) return;

        const email = ctx.body?.email || (ctx.context.returned as any)?.user?.email;
        if (!email) return;

        const userRecord = await db.query.betterAuthUser.findFirst({
          where: eq(betterAuthUser.email, email.toLowerCase())
        });

        if (!userRecord) return;

        // Parse firstName / lastName from full name if not already set
        if (!userRecord.firstName && userRecord.name) {
          const parts = userRecord.name.trim().split(/\s+/);
          const firstName = parts[0] || '';
          const lastName = parts.slice(1).join(' ') || '';
          await db.update(betterAuthUser)
            .set({ firstName, lastName, updatedAt: new Date() })
            .where(eq(betterAuthUser.id, userRecord.id));
          console.log(`📝 [Signup Hook] Parsed name for ${email}: firstName=${firstName}, lastName=${lastName}`);
        }

        console.log(`✅ [Signup Hook] User created: ${email} (tenant will be created after payment)`);
      } catch (error) {
        console.error('❌ [Signup Hook] Error in post-signup hook:', error);
        // Don't throw — signup should still succeed
      }
    }),
  },
});

// For Express integration, we need to extract the handler
export const auth = authInstance;
