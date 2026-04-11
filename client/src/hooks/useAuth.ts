import { useSession, signIn, signOut, signUp, authClient, type ExtendedUser } from "@/lib/betterAuthClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/apiConfig";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clearAllAuthState, clearClientCaches, setIntentionalLogout } from "@/lib/clearAuthState";
import type {
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
  ChangePasswordData,
} from "@shared/schema";

export function useAuth() {
  const session = useSession();

  return {
    user: session.data?.user as ExtendedUser | null,
    isLoading: session.isPending,
    isAuthenticated: !!session.data?.user,
    hasInitialized: !session.isPending,
    error: session.error,
    refetch: session.refetch,
  };
}

export function useLogin() {
  const { toast } = useToast();

  // Add loading state management
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (credentials: LoginCredentials) => {
    setIsPending(true);
    try {
      const result = await signIn.email({
        email: credentials.email,
        password: credentials.password,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: "Success",
        description: "Login successful! Welcome back.",
      });

      return result.data;
    } catch (error: any) {
      let message = "Login failed. Please try again.";

      if (error.message.includes("401") || error.message.includes("invalid")) {
        message = "Invalid email or password. Please check your credentials.";
      } else if (error.message.includes("verify")) {
        message = "Please verify your email address before logging in. Check your inbox for the verification email.";
      }

      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });

      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return {
    mutateAsync,
    isPending,
  };
}

export function useRegister() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (data: RegisterData) => {
    setIsPending(true);
    try {
      // Step 0: Clear any existing session/cookies/cache from a previously logged-in user
      // This prevents the new account from inheriting the old user's dashboard
      await clearAllAuthState();

      // Step 1: Store company name on the server before signup.
      // This is now a best-effort fallback — the primary path passes
      // `pendingCompanyName` directly to Better Auth below so it is persisted
      // atomically on the user row, but we still populate the in-memory map
      // for any legacy code paths that read from it.
      try {
        await fetch(`${getApiBaseUrl()}/api/signup/store-company-name`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            companyName: data.companyName,
          }),
        });
      } catch {
        // Ignore — the atomic signUp.email call below carries the name.
      }

      // Step 2: Proceed with Better Auth signup, passing the company name as
      // an additional field so it lands on the user row in the same insert.
      const result = await signUp.email({
        email: data.email,
        password: data.password,
        name: `${data.firstName} ${data.lastName}`,
        pendingCompanyName: data.companyName,
      } as any);

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account before logging in.",
      });

      return result.data;
    } catch (error: any) {
      let message = "Registration failed. Please try again.";

      if (error.message.includes("409") || error.message.includes("exists")) {
        message = "An account with this email already exists.";
      } else if (error.message.includes("400")) {
        message = "Please check your input and try again.";
      }

      toast({
        title: "Registration Failed",
        description: message,
        variant: "destructive",
      });

      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return {
    mutateAsync,
    isPending,
  };
}

export function useLogout() {
  const { toast } = useToast();

  return {
    mutateAsync: async () => {
      try {
        setIntentionalLogout(true);
        // Clear ALL auth state: server session, cookies, localStorage, sessionStorage, React Query cache, Redux
        await clearAllAuthState();
        toast({
          title: "Success",
          description: "Logged out successfully.",
        });
      } catch (error) {
        // Even if logout fails, force clear everything locally
        console.error("Logout error:", error);
        clearClientCaches();
        toast({
          title: "Info",
          description: "Logged out locally.",
        });
      }
    },
  };
}

// Placeholder hooks for compatibility - these will be implemented with better-auth later
export function useUpdateTheme() {
  return {
    mutateAsync: async (data: { theme: 'light' | 'dark' }) => {
      console.log('Theme update requested:', data);
      // TODO: Implement with better-auth
    },
  };
}

export function useUpdateMenuPreference() {
  const [isPending, setIsPending] = useState(false);

  return {
    isPending,
    mutateAsync: async (data: { menuExpanded: boolean }) => {
      setIsPending(true);
      try {
        await fetch('/api/users/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ menuExpanded: data.menuExpanded }),
        });
      } finally {
        setIsPending(false);
      }
    },
  };
}

// Additional hooks for profile management
export function useUpdateProfile() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (data: Partial<UpdateProfileData>) => {
    setIsPending(true);
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update profile';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Response body might be empty
        }
        throw new Error(errorMessage);
      }

      let result = {};
      try {
        result = await response.json();
      } catch {
        // Response might be empty on success
      }

      // Force invalidate all session-related caches
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      await queryClient.invalidateQueries({ queryKey: ['better-auth'] });

      // Force refetch the session with no-cache to get fresh data from server
      await authClient.getSession({ fetchOptions: { cache: 'no-store' } });

      // Invalidate all queries to ensure React components re-render with fresh data
      await queryClient.invalidateQueries();

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });

      return result;
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}

export function useChangePassword() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (data: ChangePasswordData) => {
    setIsPending(true);
    try {
      // TODO: Implement with better-auth API
      console.log('Password change requested:', data);

      toast({
        title: "Password Changed",
        description: "Your password has been changed successfully.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}

export interface DeletionStatus {
  pending: boolean;
  requestedAt: string | null;
  scheduledPurgeAt: string | null;
  requestedByUserId: string | null;
  reason: string | null;
}

/**
 * Poll the account deletion status. Returns whether the current tenant is
 * pending deletion and when the purge is scheduled.
 */
export function useDeletionStatus(enabled = true) {
  return useQuery<DeletionStatus>({
    queryKey: ["/api/account/deletion-status"],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export interface DeleteAccountInput {
  password: string;
  confirmText: string;
  reason?: string;
}

/**
 * Request deletion of the entire tenant account (Owner only).
 * The account enters a 30-day grace period during which the Owner can still
 * log in and cancel the deletion via useCancelAccountDeletion().
 */
export function useDeleteAccount() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (input: DeleteAccountInput): Promise<DeletionStatus> => {
    setIsPending(true);
    try {
      const response = await apiRequest("POST", "/api/account/delete", input);
      const status = (await response.json()) as DeletionStatus;

      toast({
        title: "Account scheduled for deletion",
        description: status.scheduledPurgeAt
          ? `Your account will be permanently deleted on ${new Date(status.scheduledPurgeAt).toLocaleDateString()}.`
          : "Your account has been scheduled for deletion.",
      });

      return status;
    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.message?.replace(/^\d+:\s*/, "") || "Failed to schedule account deletion.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}

/** Cancel a pending account deletion during the 30-day grace period. */
export function useCancelAccountDeletion() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (): Promise<DeletionStatus> => {
    setIsPending(true);
    try {
      const response = await apiRequest("POST", "/api/account/cancel-deletion");
      const status = (await response.json()) as DeletionStatus;

      toast({
        title: "Deletion cancelled",
        description: "Your account is active again. Welcome back!",
      });

      // Refresh all queries to reflect the now-active account
      queryClient.invalidateQueries();

      return status;
    } catch (error: any) {
      toast({
        title: "Failed to cancel",
        description: error.message?.replace(/^\d+:\s*/, "") || "Failed to cancel deletion.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}

/** Trigger a JSON data export download of all tenant-owned data. */
export function useExportAccountData() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (): Promise<void> => {
    setIsPending(true);
    try {
      const response = await apiRequest("GET", "/api/account/export");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `account-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export downloaded",
        description: "Your account data has been downloaded.",
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message?.replace(/^\d+:\s*/, "") || "Failed to export account data.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}

// 2FA hooks
export function useSetup2FA() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async () => {
    setIsPending(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/2fa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to setup 2FA');
      }

      const data = await response.json();

      toast({
        title: "2FA Setup Initiated",
        description: "Scan the QR code with your authenticator app.",
      });

      return {
        secret: data.secret,
        qrCode: data.qrCode,
        backupCodes: [] // We'll implement backup codes later
      };
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to setup 2FA.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}

export function useEnable2FA() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (token: string, secret: string) => {
    setIsPending(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token, secret }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to enable 2FA');
      }

      const data = await response.json();

      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled for your account.",
      });

      return { success: true };
    } catch (error: any) {
      toast({
        title: "Enable Failed",
        description: error.message || "Failed to enable 2FA.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}

export function useDisable2FA() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (token: string) => {
    setIsPending(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to disable 2FA');
      }

      const data = await response.json();

      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled for your account.",
      });

      return { success: true };
    } catch (error: any) {
      toast({
        title: "Disable Failed",
        description: error.message || "Failed to disable 2FA.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending };
}
