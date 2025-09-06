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
  baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || "3500"}`,
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-key-change-in-production",
  trustedOrigins: [
    `http://localhost:${process.env.PORT || "3500"}`,
    "http://localhost:5173",
    "https://weby.zendwise.work",
    "http://weby.zendwise.work:3001",
    "http://websy.zendwise.work:3001",
    "https://websy.zendwise.work",
    "http://webx.zendwise.work",
    "https://webx.zendwise.work",
    "https://2850dacc-d7a0-40e0-a90b-43f06888d139-00-18hp2u206zmhk.kirk.replit.dev"
  ],
  // Better Auth hooks will be implemented separately to avoid type conflicts
  // Tenant synchronization will be handled by the registration endpoints
});

// For Express integration, we need to extract the handler
export const auth = authInstance;
