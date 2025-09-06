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

  return {
    mutateAsync: async (data: RegisterData) => {
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
      }
    },
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

// Note: Additional hooks for profile management, 2FA, etc. will be added as needed
// For now, the core authentication hooks (useAuth, useLogin, useRegister, useLogout) are implemented
