import { betterAuth } from "better-auth";

// Better Auth configuration for server-node
export const auth = betterAuth({
  database: {
    provider: "pg",
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/authentik",
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieName: "better-auth.session_token",
  },
  trustedOrigins: [
    "http://localhost:5173", // Vite dev server
    "http://localhost:5000", // Main backend
    "http://localhost:3502", // This server-node service
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
