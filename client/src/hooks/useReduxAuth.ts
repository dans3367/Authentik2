import { useAuth, useLogin, useLogout } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSelector, useDispatch } from "react-redux";
import { setError, clearAuth } from "@/store/authSlice";
import type { RootState } from "@/store/index";

// Main authentication hook - now uses better-auth
export function useReduxAuth() {
  const auth = useAuth();

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    isInitialized: auth.hasInitialized,
    error: auth.error,
    accessToken: null, // Better-auth handles tokens internally
  };
}

// Login hook - placeholder for better-auth integration
export function useReduxLogin() {
  const { toast } = useToast();
  const loginMutation = useLogin();

  const login = async (credentials: {
    email: string;
    password: string;
    twoFactorToken?: string;
    rememberMe?: boolean;
  }) => {
    try {
      toast({
        title: "Info",
        description: "Authentication system is being updated. Please try again later.",
      });
      return null;
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: "Authentication system temporarily unavailable.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    login,
    isLoading: false,
    error: null,
  };
}

// Logout hook - uses better-auth
export function useReduxLogout() {
  const { toast } = useToast();
  const logoutMutation = useLogout();

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return { logout };
}

// Profile update hook - placeholder
export function useReduxUpdateProfile() {
  const { toast } = useToast();

  const updateProfile = async (profileData: any) => {
    toast({
      title: "Info",
      description: "Profile update coming soon with better-auth integration.",
    });
  };

  return { updateProfile };
}


// Auth error management hook
export function useAuthError() {
  const dispatch = useDispatch();
  const error = useSelector((state: RootState) => state.auth.error);

  const clearAuthError = () => {
    dispatch(setError(null));
  };

  const setAuthError = (message: string) => {
    dispatch(setError(message));
  };

  return {
    error,
    clearAuthError,
    setAuthError,
  };
}

// Force logout (for when token refresh fails definitively)
export function useForceLogout() {
  const dispatch = useDispatch();

  const forceLogout = () => {
    dispatch(clearAuth());
  };

  return { forceLogout };
}
