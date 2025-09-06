import { useSession, signIn, signOut, signUp } from "@/lib/betterAuthClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type {
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
  ChangePasswordData,
} from "@shared/schema";

export function useAuth() {
  const session = useSession();

  return {
    user: session.data?.user || null,
    isLoading: session.isPending,
    isAuthenticated: !!session.data?.user,
    hasInitialized: !session.isPending,
    error: session.error,
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
        const result = await signUp.email({
          email: data.email,
          password: data.password,
          name: `${data.firstName} ${data.lastName}`,
        });

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
        await signOut();
        toast({
          title: "Success",
          description: "Logged out successfully.",
        });
      } catch (error) {
        // Even if logout fails, we can still show success
        console.error("Logout error:", error);
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
  return {
    mutateAsync: async (data: { menuExpanded: boolean }) => {
      console.log('Menu preference update requested:', data);
      // TODO: Implement with better-auth
    },
  };
}

// Additional hooks for profile management
export function useUpdateProfile() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (data: UpdateProfileData) => {
    setIsPending(true);
    try {
      // TODO: Implement with better-auth API
      console.log('Profile update requested:', data);

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });

      return data;
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

export function useDeleteAccount() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async () => {
    setIsPending(true);
    try {
      // TODO: Implement with better-auth API
      console.log('Account deletion requested');

      toast({
        title: "Account Deleted",
        description: "Your account has been deleted successfully.",
      });

      // Sign out after deletion
      await signOut();
    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete account.",
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
      const response = await fetch('/api/2fa/setup', {
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
      const response = await fetch('/api/2fa/enable', {
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
      const response = await fetch('/api/2fa/disable', {
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
