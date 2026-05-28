// ---------------------------------------------------------------------------
// SECURITY NOTE (session token storage):
//
// Better Auth stores the session token's raw value in
// better_auth_session.token — the same value sent to the browser as the
// session cookie. A read-only DB compromise therefore yields full session
// hijack for every active user (no offline cracking required).
//
// Switching to a server-side hash (e.g. SHA-256 of the token) would be the
// ideal mitigation but requires forking Better Auth's session-lookup path,
// which is out of scope here. To compensate, this codebase MUST:
//
//   1. Keep all session cookies HttpOnly + Secure (in prod) + SameSite=Lax
//      or stricter so the cookie can't be exfiltrated via XSS / cross-site.
//      (See cookie options on every `res.cookie('better-auth.session_token',
//      …)` call site.)
//   2. Encrypt the database at rest, and tightly restrict who/what can run
//      read-only queries against better_auth_session.
//   3. Rotate BETTER_AUTH_SECRET on suspicion of leak — doing so invalidates
//      every existing session because Better Auth signs cookies with this
//      secret, forcing a global re-login.
//   4. Prefer mass-revoking sessions via the existing
//      `db.delete(betterAuthSession).where(eq(userId, …))` paths on any
//      meaningful security event (password reset, deactivation, email
//      change, etc.) so the read-only-DB-leak window is short-lived.
// ---------------------------------------------------------------------------
import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "./db";
import { betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification } from "@shared/schema";
import { triggerTransactionalEmail } from "./lib/trigger";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { cookiesShouldBeSecure } from "./utils/cookieSecurity";

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
  // Trusted origins.
  //
  // In production this is FAIL-CLOSED: only origins explicitly provided
  // via TRUSTED_ORIGINS (comma-separated) or the BASE_URL itself are
  // trusted. The hard-coded `https://weby.zendwise.work` etc. defaults
  // that lived here historically have been removed from the production
  // path so a misconfigured deploy can't silently trust the wrong host.
  //
  // The plain-HTTP development entries below are gated on NODE_ENV ===
  // 'development' (NOT just "!= production"), so if NODE_ENV is ever
  // unset in a deployment those origins do NOT become trusted.
  trustedOrigins: [
    process.env.BASE_URL,
    // Additional trusted origins from environment (comma-separated)
    ...(process.env.TRUSTED_ORIGINS?.split(",").map(o => o.trim()) || []),
    // Development-only convenience entries. NOTE: scoped to NODE_ENV
    // === 'development' explicitly — NOT "!= production" — so an
    // unset NODE_ENV doesn't accidentally trust plain-HTTP hosts.
    ...(process.env.NODE_ENV === "development" ? [
      `http://localhost:${process.env.PORT || "5002"}`,
      "http://localhost:5173",
      "http://127.0.0.1:35145",
      "http://weby.zendwise.work:3001",
      "http://websy.zendwise.work:3001",
      "http://webx.zendwise.work",
      process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "",
    ] : []),
  ].filter(Boolean) as string[],
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
      // Centralised in server/utils/cookieSecurity.ts so every Set-Cookie
      // site in the codebase agrees. See that file for the derivation
      // rules (COOKIES_SECURE env, BASE_URL scheme, NODE_ENV fallback).
      secure: cookiesShouldBeSecure(),
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
        input: false, // SECURITY: Prevent client-side modification via /api/auth/update-user
      },
      tenantId: {
        type: "string",
        defaultValue: "00000000-0000-0000-0000-000000000000", // Temporary placeholder, MUST be updated by signup hook
        required: false,
        input: false, // SECURITY: Prevent client-side modification via /api/auth/update-user
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
        input: false, // SECURITY: Prevent client-side modification via /api/auth/update-user
      },
      language: {
        type: "string",
        defaultValue: "en",
        required: false,
      },
      pendingCompanyName: {
        type: "string",
        required: false,
        // Writable from the signup client so the company name entered on the
        // signup form is persisted atomically on the user row and read later
        // by tenant provisioning (see provisionTenantForUser).
      },
    },
  },
  // Hooks — pre-signup: enforce password complexity; post-signup: parse name.
  // Tenant + company creation is DEFERRED until Stripe payment is confirmed
  // (handled by confirm-checkout and the checkout.session.completed webhook).
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const path = ctx.path || "";
      // Enforce password complexity on sign-up (Better Auth only checks length)
      if (path.includes("sign-up") && ctx.body?.password) {
        const pw: string = ctx.body.password;
        const errors: string[] = [];
        if (!/[A-Z]/.test(pw)) errors.push("one uppercase letter");
        if (!/[a-z]/.test(pw)) errors.push("one lowercase letter");
        if (!/[0-9]/.test(pw)) errors.push("one number");
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) errors.push("one special character");
        if (errors.length > 0) {
          throw new APIError("BAD_REQUEST", {
            message: `Password must contain at least ${errors.join(", ")}`,
          });
        }
      }

      // Sanitize the pendingCompanyName signup field — mirrors the guards in
      // /api/signup/store-company-name (trim + 200 char cap) since the field
      // now flows directly through Better Auth's additionalFields and bypasses
      // that endpoint's validation.
      if (path.includes("sign-up") && ctx.body?.pendingCompanyName != null) {
        const raw = ctx.body.pendingCompanyName;
        if (typeof raw !== "string") {
          delete ctx.body.pendingCompanyName;
        } else {
          const trimmed = raw.trim();
          if (!trimmed) {
            delete ctx.body.pendingCompanyName;
          } else if (trimmed.length > 200) {
            throw new APIError("BAD_REQUEST", { message: "Company name too long" });
          } else {
            ctx.body.pendingCompanyName = trimmed;
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      try {
        const path = ctx.path || "";

        // Post sign-in: update lastLoginAt
        if (path.includes("sign-in")) {
          const returned = ctx.context.returned as any;
          const userId = returned?.user?.id || returned?.body?.user?.id;
          const email = ctx.body?.email || returned?.user?.email || returned?.body?.user?.email;
          if (userId) {
            await db.update(betterAuthUser)
              .set({ lastLoginAt: new Date(), updatedAt: new Date() })
              .where(eq(betterAuthUser.id, userId));
          } else if (email) {
            await db.update(betterAuthUser)
              .set({ lastLoginAt: new Date(), updatedAt: new Date() })
              .where(eq(betterAuthUser.email, email.toLowerCase()));
          }
          return;
        }

        // Post sign-up: parse name into firstName/lastName
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

        // Persist the pending company name captured via /api/signup/store-company-name
        // onto the user row so tenant/company provisioning (which may run minutes later
        // after Stripe checkout) can read it reliably — the in-memory Map has a short
        // TTL and a tight capacity, so we must copy it to durable storage immediately.
        if (!userRecord.pendingCompanyName) {
          const hmacKey = process.env.BETTER_AUTH_SECRET || '';
          const pendingStoreKey = crypto
            .createHmac('sha256', hmacKey)
            .update(userRecord.email.toLowerCase())
            .digest('hex');
          const pendingEntry = (global as any).pendingCompanyNames?.get?.(pendingStoreKey);
          const pendingName =
            pendingEntry && pendingEntry.expiresAt > Date.now() ? pendingEntry.name : null;
          if (pendingName) {
            await db.update(betterAuthUser)
              .set({ pendingCompanyName: pendingName, updatedAt: new Date() })
              .where(eq(betterAuthUser.id, userRecord.id));
            (global as any).pendingCompanyNames?.delete?.(pendingStoreKey);
            console.log(`📝 [Signup Hook] Persisted pending company name for ${email}`);
          }
        }

        console.log(`✅ [Signup Hook] User created: ${email} (tenant will be created after payment)`);
      } catch (error) {
        console.error('❌ [Signup Hook] Error in post-signup/signin hook:', error);
        // Don't throw — auth should still succeed
      }
    }),
  },
});

// For Express integration, we need to extract the handler
export const auth = authInstance;
