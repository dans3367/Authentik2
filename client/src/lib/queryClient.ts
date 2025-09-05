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
    // Use direct fetch to the correct server port to bypass Vite proxy issues
    const baseURL = import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:3001";
    const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;

    const headers: Record<string, string> = {
      ...(data ? { "Content-Type": "application/json" } : {}),
    };

    const res = await fetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
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
