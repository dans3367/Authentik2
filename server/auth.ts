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
        defaultValue: "Employee",
        required: false,
      },
      tenantId: {
        type: "string",
        defaultValue: "29c69b4f-3129-4aa4-a475-7bf892e5c5b9",
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
  // Better Auth hooks will be implemented separately to avoid type conflicts
  // Tenant synchronization will be handled by the registration endpoints
});

// For Express integration, we need to extract the handler
export const auth = authInstance;
