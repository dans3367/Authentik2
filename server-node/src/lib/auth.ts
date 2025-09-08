import { betterAuth } from "better-auth";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Better Auth configuration for server-node
let authInstance: any;

function initializeAuth() {
  if (!authInstance) {
    const databaseUrl = process.env.DATABASE_URL || "postgresql://localhost:5432/authentik";
    
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for better-auth initialization");
    }
    
    try {
      authInstance = betterAuth({
        database: {
          provider: "pg",
          url: databaseUrl,
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
    } catch (error) {
      console.error("Failed to initialize better-auth:", error);
      throw error;
    }
  }
  return authInstance;
}

// Export a getter function instead of the auth instance directly
export function getAuth() {
  return initializeAuth();
}

// For backwards compatibility and type inference
export const auth = new Proxy({} as any, {
  get(target, prop) {
    return getAuth()[prop];
  }
});

export type Session = any; // Will be properly typed when auth is initialized
export type User = any;   // Will be properly typed when auth is initialized


