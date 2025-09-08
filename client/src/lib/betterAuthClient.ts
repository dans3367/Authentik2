import { createAuthClient } from "better-auth/react";

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
