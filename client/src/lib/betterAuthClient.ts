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
  language?: string;
  avatarUrl?: string | null;
  timezone?: string | null;
}

// Dynamically determine the base URL based on the current environment
const getBaseURL = () => {
  // Use environment variable if set
  if (import.meta.env.VITE_BETTER_AUTH_URL) {
    return import.meta.env.VITE_BETTER_AUTH_URL;
  }
  
  // In browser, determine based on current location
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    
    // If accessing via localhost, use relative URLs (Vite proxy handles it)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return window.location.origin;
    }
    
    // If accessing via IP address, point directly to the API server port
    const apiPort = import.meta.env.VITE_API_PORT || '5000';
    return `${protocol}//${hostname}:${apiPort}`;
  }
  
  // Final fallback for localhost development
  return "http://localhost:5000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(), // Dynamically determined backend API URL
});

export const { useSession, signIn, signOut, signUp } = authClient;
