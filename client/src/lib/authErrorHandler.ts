import { signOut } from "@/lib/betterAuthClient";
import { store } from "@/store";
import { clearAuth } from "@/store/authSlice";

// Global navigation function - will be set by the App component
let globalNavigate: ((path: string) => void) | null = null;

export function setGlobalNavigate(navigate: (path: string) => void) {
  globalNavigate = navigate;
}

/**
 * Handles 401 authentication errors globally
 * - Signs out from Better Auth
 * - Clears Redux auth state
 * - Redirects to login page
 */
export async function handle401Error(source = 'API') {
  console.warn(`🚨 [Auth] 401 Unauthorized detected from ${source} - initiating logout`);
  
  try {
    // Clear Redux auth state first
    store.dispatch(clearAuth());
    
    // Sign out from Better Auth (this also clears cookies/session)
    await signOut();
    
    console.log('✅ [Auth] Successfully logged out user');
  } catch (error) {
    console.error('❌ [Auth] Error during logout:', error);
    // Even if logout fails, we still need to clear local state and redirect
    store.dispatch(clearAuth());
  }
  
  // Redirect to auth page
  if (globalNavigate) {
    console.log('🔄 [Auth] Redirecting to /auth');
    globalNavigate('/auth');
  } else {
    console.warn('⚠️ [Auth] Global navigate not available, using window.location');
    window.location.href = '/auth';
  }
}

/**
 * Checks if an error is a 401 authentication error
 */
export function is401Error(error: any): boolean {
  if (error?.status === 401) return true;
  if (error?.message?.includes('401')) return true;
  if (error?.message?.includes('Authentication failed')) return true;
  if (error?.message?.includes('Unauthorized')) return true;
  return false;
}

/**
 * Checks if a Response object indicates a 401 error
 */
export function is401Response(response: Response): boolean {
  return response.status === 401;
}
