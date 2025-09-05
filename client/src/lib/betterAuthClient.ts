import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:3001", // Backend API URL
});

export const { useSession, signIn, signOut, signUp } = authClient;
