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
  // Always use window.location.origin if available (prevents CORS issues)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Server-side fallback
  if (import.meta.env.VITE_BETTER_AUTH_URL) {
    return import.meta.env.VITE_BETTER_AUTH_URL;
  }
  
  // Final fallback for localhost development
  return "http://localhost:5000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(), // Dynamically determined backend API URL
});

export const { useSession, signIn, signOut, signUp } = authClient;
