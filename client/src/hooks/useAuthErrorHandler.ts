import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { signOut } from '@/lib/betterAuthClient';
import { clearAllAuthState, clearClientCaches } from '@/lib/clearAuthState';

export interface AuthErrorHandlerOptions {
  showToast?: boolean;
  customMessage?: string;
}

export function useAuthErrorHandler() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleAuthError = async (options: AuthErrorHandlerOptions = {}) => {
    const { showToast = true, customMessage } = options;
    
    console.log('🔄 [Auth] Handling authentication error - clearing all state and redirecting to login');
    
    try {
      await clearAllAuthState();
    } catch (error) {
      console.warn('⚠️ [Auth] Error during full cleanup:', error);
      clearClientCaches();
    }

    // Show user-friendly message
    if (showToast) {
      toast({
        title: "Session Expired",
        description: customMessage || "Your session has expired. Please log in again.",
        variant: "destructive",
      });
    }

    // Redirect to login page
    setTimeout(() => {
      setLocation('/auth');
    }, 100); // Small delay to ensure toast is shown
  };

  return { handleAuthError };
}

// Global auth error handler for programmatic use
let globalAuthErrorHandler: ((options?: AuthErrorHandlerOptions) => Promise<void>) | null = null;

export function setGlobalAuthErrorHandler(handler: (options?: AuthErrorHandlerOptions) => Promise<void>) {
  globalAuthErrorHandler = handler;
}

export function triggerGlobalAuthError(options?: AuthErrorHandlerOptions) {
  if (globalAuthErrorHandler) {
    globalAuthErrorHandler(options);
  } else {
    console.warn('⚠️ [Auth] Global auth error handler not set');
    // Fallback redirect
    window.location.href = '/auth';
  }
}