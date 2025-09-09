import { createAuthClient } from "better-auth/react";

// Extended user type to match our backend schema
export interface ExtendedUser {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  role: string;
  tenantId: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean;
  twoFactorEnabled?: boolean;
  theme?: string;
  menuExpanded?: boolean;
  avatarUrl?: string | null;
}

// Dynamically determine the base URL based on the current environment
const getBaseURL = () => {
  // If VITE_BETTER_AUTH_URL is explicitly set, use it
  if (import.meta.env.VITE_BETTER_AUTH_URL) {
    return import.meta.env.VITE_BETTER_AUTH_URL;
  }
  
  // In browser, use current origin (for Replit and other hosted environments)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Fallback for localhost development
  return "http://localhost:5000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(), // Dynamically determined backend API URL
});

export const { useSession, signIn, signOut, signUp } = authClient;
