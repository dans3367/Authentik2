import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authClient } from "./betterAuthClient";
import { triggerGlobalAuthError } from "@/hooks/useAuthErrorHandler";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle 401 authentication errors globally
    if (res.status === 401) {
      console.log('🚨 [API] 401 Unauthorized detected, triggering auth error handler');
      
      // Trigger global auth error handler with a small delay to prevent race conditions
      setTimeout(() => {
        triggerGlobalAuthError({
          showToast: true,
          customMessage: 'Your session has expired. Please log in again.'
        });
      }, 100);
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Use relative URLs for same-domain requests or environment variable for different domains
  const baseURL = import.meta.env.VITE_BETTER_AUTH_URL || "";
  const fullUrl = url.startsWith('http') ? url : baseURL ? `${baseURL}${url}` : url;
  
  try {
    
    console.log('🌐 [API Request] Making request:', {
      method,
      originalUrl: url,
      baseURL: baseURL || 'relative',
      fullUrl,
      hasData: !!data
    });

    const headers: Record<string, string> = {
      ...(data ? { "Content-Type": "application/json" } : {}),
    };

    const res = await fetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log('📨 [API Response] Received response:', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      url: res.url,
      headers: {
        contentType: res.headers.get('content-type'),
        accessControlAllowOrigin: res.headers.get('access-control-allow-origin')
      }
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error('❌ [API Request] Failed:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      url: fullUrl,
      method,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const url = queryKey.join("/");
      // Use authClient.$fetch only for better-auth endpoints (/api/auth/*)
      // Use regular apiRequest for other API endpoints
      let data;
      if (url.startsWith("/api/auth/")) {
        // Better Auth handles session validation automatically
        // authClient.$fetch returns parsed JSON directly, not a Response object
        data = await authClient.$fetch(url);
      } else {
        // Use apiRequest for regular API endpoints
        const response = await apiRequest("GET", url);
        data = await response.json();
      }
      return data;
    } catch (error: any) {
      // Handle 401 errors globally through our error handler
      if (error.message?.includes("401") || error.message?.includes("Authentication failed")) {
        console.log('🚨 [Query] 401 error detected in query:', queryKey.join("/"));
        
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        
        // Trigger global auth error handler
        setTimeout(() => {
          triggerGlobalAuthError({
            showToast: true,
            customMessage: 'Authentication required. Please log in to continue.'
          });
        }, 100);
        
        throw error;
      }
      
      // Log 403 errors but don't throw them in console
      if (error.message?.includes("403")) {
        console.debug("Access forbidden:", queryKey.join("/"));
        throw error;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes default stale time
      retry: (failureCount, error: any) => {
        // Don't retry for auth errors and trigger global handler
        if (
          error?.message?.includes("401") ||
          error?.message?.includes("Authentication failed")
        ) {
          console.log('🚨 [Query Retry] 401 detected, triggering global auth handler');
          setTimeout(() => {
            triggerGlobalAuthError({
              showToast: true,
              customMessage: 'Session expired. Please log in again.'
            });
          }, 100);
          return false;
        }
        
        // Don't retry for 403 errors
        if (
          error?.message?.includes("403") ||
          error?.message?.includes("Forbidden")
        ) {
          return false;
        }
        
        return failureCount < 1;
      },
      retryDelay: 1000,
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        // Handle 401 errors in mutations globally
        if (error?.message?.includes("401") || error?.message?.includes("Authentication failed")) {
          console.log('🚨 [Mutation] 401 error detected, triggering global auth handler');
          setTimeout(() => {
            triggerGlobalAuthError({
              showToast: true,
              customMessage: 'Your session has expired. Please log in again.'
            });
          }, 100);
        }
      },
    },
  },
});
