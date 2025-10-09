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
  
  // In browser, check if we're in a browser preview (127.0.0.1:35145) and redirect to localhost:5000
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin === 'http://127.0.0.1:35145') {
      return 'http://localhost:5000';
    }
    return origin;
  }
  
  // Fallback for localhost development
  return "http://localhost:5000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(), // Dynamically determined backend API URL
});

export const { useSession, signIn, signOut, signUp } = authClient;
