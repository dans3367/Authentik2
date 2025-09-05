import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authClient } from "./betterAuthClient";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    // For auth endpoints, use direct fetch (Better Auth handles these)
    if (
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/refresh")
    ) {
      const headers: Record<string, string> = {
        ...(data ? { "Content-Type": "application/json" } : {}),
      };

      const res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });

      await throwIfResNotOk(res);
      return res;
    }

    // For all other requests, use Better Auth's authenticated fetch
    // Better Auth's $fetch returns parsed JSON, not a Response object
    const result = await authClient.$fetch(url, {
      method,
      body: data ? JSON.stringify(data) : undefined,
      headers: data ? { "Content-Type": "application/json" } : {},
    });

    // Convert the result to a Response-like object for compatibility
    const response = new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    return response;
  } catch (error) {
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
      // Better Auth handles session validation automatically
      // Make authenticated request using Better Auth's fetch method
      // authClient.$fetch returns parsed JSON directly, not a Response object
      const data = await authClient.$fetch(queryKey.join("/") as string);
      return data;
    } catch (error: any) {
      if (
        unauthorizedBehavior === "returnNull" &&
        (error.message?.includes("401") || error.message?.includes("Authentication failed"))
      ) {
        return null;
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
        // Don't retry for auth errors
        if (
          error?.message?.includes("401") ||
          error?.message?.includes("403") ||
          error?.message?.includes("Authentication failed") ||
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
    },
  },
});
