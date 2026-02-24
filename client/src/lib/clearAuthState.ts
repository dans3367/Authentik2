import { signOut } from "@/lib/betterAuthClient";
import { store, persistor } from "@/store";
import { clearAuth } from "@/store/authSlice";
import { queryClient } from "@/lib/queryClient";

/**
 * Clears ALL authentication state across the entire application.
 * Call this on logout, before new account signup, and on 401 errors.
 * 
 * Clears:
 * - Better Auth session (server-side + cookies)
 * - Redux auth state
 * - React Query cache (all cached API responses)
 * - localStorage
 * - sessionStorage
 * - All cookies accessible from JS
 */
export async function clearAllAuthState(): Promise<void> {
  console.log('🧹 [Auth] Clearing all auth state...');

  // 1. Clear Redux auth state and purge persisted storage
  try {
    store.dispatch(clearAuth());
    await persistor.purge();
  } catch (e) {
    console.warn('⚠️ [Auth] Failed to clear Redux state:', e);
  }

  // 2. Clear React Query cache - removes all cached API data from previous user
  try {
    queryClient.cancelQueries();
    queryClient.clear();
  } catch (e) {
    console.warn('⚠️ [Auth] Failed to clear React Query cache:', e);
  }

  // 3. Sign out from Better Auth (clears server session + session cookie)
  try {
    await signOut();
  } catch (e) {
    console.warn('⚠️ [Auth] Better Auth signOut error (non-blocking):', e);
  }

  // 4. Clear localStorage (except non-auth items like theme preference)
  try {
    const keysToPreserve = ['theme', 'i18nextLng'];
    const preserved: Record<string, string | null> = {};
    keysToPreserve.forEach(key => {
      preserved[key] = localStorage.getItem(key);
    });
    localStorage.clear();
    keysToPreserve.forEach(key => {
      if (preserved[key] !== null) {
        localStorage.setItem(key, preserved[key]!);
      }
    });
  } catch (e) {
    console.warn('⚠️ [Auth] Failed to clear localStorage:', e);
  }

  // 5. Clear sessionStorage entirely
  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn('⚠️ [Auth] Failed to clear sessionStorage:', e);
  }

  // 6. Clear all accessible cookies
  try {
    clearAllCookies();
  } catch (e) {
    console.warn('⚠️ [Auth] Failed to clear cookies:', e);
  }

  console.log('✅ [Auth] All auth state cleared');
}

/**
 * Lightweight version that only clears client-side caches without calling signOut.
 * Use this before signup when we just need to wipe the previous user's cached data.
 */
export function clearClientCaches(): void {
  console.log('🧹 [Auth] Clearing client caches...');

  try {
    store.dispatch(clearAuth());
    persistor.purge().catch(() => {});
  } catch (e) { /* ignore */ }

  try {
    queryClient.cancelQueries();
    queryClient.clear();
  } catch (e) { /* ignore */ }

  try {
    const keysToPreserve = ['theme', 'i18nextLng'];
    const preserved: Record<string, string | null> = {};
    keysToPreserve.forEach(key => {
      preserved[key] = localStorage.getItem(key);
    });
    localStorage.clear();
    keysToPreserve.forEach(key => {
      if (preserved[key] !== null) {
        localStorage.setItem(key, preserved[key]!);
      }
    });
  } catch (e) { /* ignore */ }

  try {
    sessionStorage.clear();
  } catch (e) { /* ignore */ }

  console.log('✅ [Auth] Client caches cleared');
}

/**
 * Clears all cookies accessible via JavaScript for current domain and common paths.
 */
function clearAllCookies(): void {
  const cookies = document.cookie.split(';');
  const paths = ['/', '/api', '/auth'];
  
  for (const cookie of cookies) {
    const name = cookie.split('=')[0].trim();
    if (!name) continue;
    
    for (const path of paths) {
      // Clear for current domain
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
      // Clear for domain with leading dot (subdomain cookies)
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${window.location.hostname}`;
      // Clear for parent domain (e.g., .zendwise.com)
      const parts = window.location.hostname.split('.');
      if (parts.length > 2) {
        const parentDomain = '.' + parts.slice(-2).join('.');
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${parentDomain}`;
      }
    }
  }
}
