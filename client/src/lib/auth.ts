import { apiRequest } from "./queryClient";

export interface AuthTokens {
  accessToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  menuExpanded?: boolean;
  theme?: 'light' | 'dark';
  avatarUrl?: string | null;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  user: AuthUser;
  emailVerificationRequired?: boolean;
}

export interface RefreshResponse {
  message: string;
  user: AuthUser;
}

// Create a simple event system for auth state changes
type AuthStateListener = (token: string | null) => void;
const authListeners: AuthStateListener[] = [];

export const addAuthStateListener = (listener: AuthStateListener) => {
  authListeners.push(listener);
};

export const removeAuthStateListener = (listener: AuthStateListener) => {
  const index = authListeners.indexOf(listener);
  if (index > -1) {
    authListeners.splice(index, 1);
  }
};

const notifyAuthStateChange = (token: string | null) => {
  authListeners.forEach(listener => listener(token));
};

class AuthManager {
  private readonly ACCESS_TOKEN_KEY = "auth_access_token";
  private refreshPromise: Promise<string> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  getAccessToken(): string | null {
    try {
      const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
      if (token) {
        console.log("Retrieved token from localStorage successfully");
      } else {
        console.log("No token found in localStorage");
      }
      return token;
    } catch (error) {
      console.error("Error accessing localStorage for token:", error);
      return null;
    }
  }

  setAccessToken(token: string): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
      console.log("Token stored in localStorage successfully");
      this.scheduleTokenRefresh(token);
      
      // Notify listeners about the token change
      notifyAuthStateChange(token);
    } catch (error) {
      console.error("Error storing token in localStorage:", error);
      // Still schedule refresh even if storage fails
      this.scheduleTokenRefresh(token);
      
      // Notify listeners even if localStorage fails
      notifyAuthStateChange(token);
    }
  }

  clearTokens(): void {
    console.log(
      "🔴 CLEARING TOKENS - This should only happen on logout or definitive auth failure",
    );
    console.trace("Token clear stack trace:");
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    this.clearRefreshTimer();
    
    // Notify listeners about the token clear
    notifyAuthStateChange(null);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private scheduleTokenRefresh(token: string): void {
    // Clear any existing timer
    this.clearRefreshTimer();

    try {
      // Parse token to get expiry time
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expTime - now;

      // Schedule refresh 2 minutes before expiry (with minimum 30 seconds)
      const refreshTime = Math.max(timeUntilExpiry - 120000, 30000);

      if (refreshTime > 0 && timeUntilExpiry > 150000) {
        // Only schedule if more than 2.5 minutes left
        this.refreshTimer = setTimeout(async () => {
          try {
            console.log("Executing automatic token refresh...");
            const newToken = await this.refreshAccessToken();
            console.log("Token refreshed successfully");

            // Re-schedule the next refresh with the new token
            this.scheduleTokenRefresh(newToken);
          } catch (error) {
            console.error("Automatic token refresh failed:", error);

            // Only clear tokens if it's a definitive authentication failure
            if (
              error instanceof Error &&
              error.message.includes("authentication required")
            ) {
              console.log("Authentication failed, clearing tokens");
              this.clearTokens();
            } else {
              console.log(
                "Temporary refresh failure, will retry on next request",
              );
              // For temporary errors, try to reschedule refresh with shorter delay
              setTimeout(() => {
                const currentToken = this.getAccessToken();
                if (currentToken) {
                  this.scheduleTokenRefresh(currentToken);
                }
              }, 60000); // Retry in 1 minute
            }
          }
        }, refreshTime);

        console.log(
          `Token refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`,
        );
      }
    } catch (error) {
      console.error("Failed to schedule token refresh:", error);
    }
  }

  // Initialize automatic refresh on app start
  initialize(): void {
    if (this.isInitialized) return;

    const token = this.getAccessToken();
    if (token) {
      console.log("Initializing automatic token refresh system with token");

      // Check if token is about to expire and refresh immediately if needed
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const expTime = payload.exp * 1000;
        const now = Date.now();
        const timeUntilExpiry = expTime - now;

        console.log(
          `Token found, expires in ${Math.round(timeUntilExpiry / 1000)} seconds`,
        );

        // If token expires in less than 3 minutes, refresh immediately
        if (timeUntilExpiry < 180000) {
          console.log(
            "Token expires soon, refreshing immediately on initialization",
          );
          this.refreshAccessToken().catch((error) => {
            console.error("Initial token refresh failed:", error);
            // Only clear tokens if it's a definitive auth failure
            if (error.message?.includes("authentication required")) {
              console.log("Authentication definitely failed, clearing tokens");
              this.clearTokens();
            } else {
              console.log("Temporary refresh failure, will retry later");
              // Don't retry immediately - let normal auth flow handle it
            }
          });
        } else {
          this.scheduleTokenRefresh(token);
        }
      } catch (error) {
        console.error("Error parsing token during initialization:", error);
        // Don't clear tokens on parse errors - they might be recoverable
        console.log(
          "Token parse failed, will keep token and try authentication later",
        );
      }
    } else {
      console.log("No token found during initialization");
    }

    this.isInitialized = true;
  }

  async refreshAccessToken(): Promise<string> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<string> {
    try {
      console.log("🔄 Starting token refresh request...");
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include", // Include httpOnly cookies
      });

      console.log("🔄 Refresh response status:", response.status);
      console.log("🔄 Refresh response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("🔄 Refresh error response:", errorText);

        if (response.status === 401 || response.status === 403) {
          // Authentication definitively failed - clear tokens
          console.log("Refresh failed with auth error, clearing tokens");
          this.clearTokens();
          throw new Error("Token refresh failed - authentication required");
        } else {
          // Server error or network issue - don't clear tokens yet
          console.log(
            `Refresh failed with status ${response.status}, keeping tokens for retry`,
          );
          throw new Error("Token refresh failed - temporary error");
        }
      }

      const data: RefreshResponse = await response.json();
      console.log("🔄 Token refresh successful");
      console.log("🔄 User data from refresh:", data.user);

      // Extract access token from the new cookie (set by server)
      // Since we can't directly read httpOnly cookies, we'll derive it from the response
      // The cookie will be automatically available for future requests

      return data.user;
    } catch (error) {
      console.error("🔄 Token refresh error:", error);
      // Only clear tokens on authentication failures, not network issues
      if (
        error instanceof Error &&
        error.message.includes("authentication required")
      ) {
        console.log("Clearing tokens due to authentication failure");
        this.clearTokens();
      } else {
        console.log("Keeping tokens due to temporary error:", error);
      }
      throw error;
    }
  }

  async makeAuthenticatedRequest(
    method: string,
    url: string,
    data?: unknown,
  ): Promise<Response> {
    let token = this.getAccessToken();

    const makeRequest = async (accessToken: string) => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };

      if (data) {
        headers["Content-Type"] = "application/json";
      }

      console.log(`📡 Making ${method} request to ${url}`);
      console.log("📡 Request headers:", headers);

      return fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    };

    if (!token) {
      throw new Error("No access token available");
    }

    let response = await makeRequest(token);
    console.log(`📡 Response status for ${url}:`, response.status);

    // If token expired, try to refresh and retry once
    if (response.status === 401) {
      try {
        console.log("Token expired, attempting refresh...");
        token = await this.refreshAccessToken();
        response = await makeRequest(token);
        console.log("Request successful after token refresh");
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        this.clearTokens();
        throw new Error("Authentication failed");
      }
    }

    return response;
  }

  async login(
    email: string,
    password: string,
    twoFactorToken?: string,
    rememberMe?: boolean,
  ): Promise<AuthResponse | { requires2FA: boolean; tempLoginId: string }> {
    const response = await apiRequest("POST", "/api/auth/login", {
      email,
      password,
      twoFactorToken,
      rememberMe,
    });

    const data = await response.json();

    if (data.requires2FA) {
      return data;
    }

    this.setAccessToken(data.accessToken);
    return data;
  }

  async register(registerData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    confirmPassword: string;
  }): Promise<{ message: string; user: AuthUser }> {
    const response = await apiRequest(
      "POST",
      "/api/auth/register",
      registerData,
    );
    return response.json();
  }

  async logout(): Promise<void> {
    try {
      // Try to call logout endpoint
      const token = this.getAccessToken();
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
      }
    } catch (error) {
      // Even if logout fails, clear local tokens
      console.error("Logout request failed:", error);
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<AuthUser> {
    // First check if we have a token
    const token = this.getAccessToken();
    if (!token) {
      console.log("getCurrentUser: No access token available");
      throw new Error("No access token available");
    }

    console.log(
      "getCurrentUser: Found token, checking expiry and making request",
    );

    // Check if token is about to expire (within 30 seconds)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expTime = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expTime - now;

      // If token expires in less than 2 minutes, refresh it first
      if (timeUntilExpiry < 120000) {
        console.log(
          "getCurrentUser: Token about to expire, refreshing first...",
        );
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error("Pre-request token refresh failed:", error);
          // Continue with request - let makeAuthenticatedRequest handle the retry
        }
      }
    } catch (error) {
      console.error(
        "getCurrentUser: Error checking token expiry, proceeding anyway:",
        error,
      );
    }

    const response = await this.makeAuthenticatedRequest("GET", "/api/auth/me");

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "getCurrentUser: Request failed with status",
        response.status,
        errorText,
      );

      // Only throw authentication error for 401/403, not for server errors
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      } else {
        throw new Error("Failed to fetch user - server error");
      }
    }

    const data = await response.json();
    console.log("getCurrentUser: Successfully retrieved user data");
    console.log(">>>>> Data received from backend on avatar:", data.user?.avatarUrl);
    return data.user;
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiRequest("POST", "/api/auth/forgot-password", {
      email,
    });
    return response.json();
  }

  async updateProfile(data: {
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<{ message: string; user: AuthUser }> {
    const response = await this.makeAuthenticatedRequest(
      "PUT",
      "/api/auth/profile",
      data,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update profile");
    }

    return response.json();
  }

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> {
    const response = await this.makeAuthenticatedRequest(
      "PUT",
      "/api/auth/change-password",
      data,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to change password");
    }

    return response.json();
  }

  async deleteAccount(): Promise<{ message: string }> {
    const response = await this.makeAuthenticatedRequest(
      "DELETE",
      "/api/auth/account",
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete account");
    }

    this.clearTokens();
    return response.json();
  }

  async setup2FA(): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    const response = await this.makeAuthenticatedRequest(
      "POST",
      "/api/auth/2fa/setup",
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to setup 2FA");
    }

    return response.json();
  }

  async enable2FA(token: string): Promise<{ message: string }> {
    const response = await this.makeAuthenticatedRequest(
      "POST",
      "/api/auth/2fa/enable",
      { token },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to enable 2FA");
    }

    return response.json();
  }

  async disable2FA(token: string): Promise<{ message: string }> {
    const response = await this.makeAuthenticatedRequest(
      "POST",
      "/api/auth/2fa/disable",
      { token },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to disable 2FA");
    }

    return response.json();
  }

  isAuthenticated(): boolean {
    console.log("🔍 Checking authentication status...");
    const token = this.getAccessToken();
    if (!token) {
      console.log("❌ No access token found in localStorage");
      return false;
    }

    console.log("✅ Token found in localStorage, validating...");
    try {
      // Check if token is expired
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expTime = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expTime - now;

      // Token is valid if it hasn't expired yet
      const isValid = expTime > now;
      if (!isValid) {
        console.log(
          "⏰ Token has expired, marking as invalid but keeping for refresh attempt",
        );
        // Don't clear tokens immediately - let the refresh mechanism handle it
        return false;
      }

      console.log(
        `✅ Token is valid, expires in ${Math.round(timeUntilExpiry / 1000)} seconds`,
      );
      return true;
    } catch (error) {
      console.error(
        "⚠️ Error validating token, but keeping it for potential recovery:",
        error,
      );
      // Don't clear tokens on parse errors - they might be recoverable
      return false;
    }
  }
}

export const authManager = new AuthManager();
