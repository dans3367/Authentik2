import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface TwoFactorStatus {
  requiresTwoFactor: boolean;
  twoFactorEnabled: boolean;
  verified: boolean;
  loading: boolean;
  error: string | null;
}

export function use2FA(): TwoFactorStatus & { 
  verify2FA: (token: string) => Promise<boolean>;
  check2FARequirement: () => Promise<void>;
} {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<TwoFactorStatus>({
    requiresTwoFactor: false,
    twoFactorEnabled: false,
    verified: true,
    loading: true,
    error: null
  });

  const check2FARequirement = async () => {
    if (!isAuthenticated) {
      setStatus(prev => ({ 
        ...prev, 
        loading: false, 
        verified: true, 
        requiresTwoFactor: false 
      }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/auth/2fa-status', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check 2FA status');
      }

      const data = await response.json();

      console.log('🔍 [use2FA] Received 2FA status from API:', data);

      setStatus(prev => ({
        ...prev,
        requiresTwoFactor: data.requiresTwoFactor || false,
        twoFactorEnabled: data.twoFactorEnabled || false,
        verified: data.verified || false,
        loading: false,
        error: null
      }));
    } catch (error: any) {
      console.error('Error checking 2FA requirement:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to check 2FA status',
        // Default to requiring verification on error for security
        requiresTwoFactor: true,
        verified: false
      }));
    }
  };

  const verify2FA = async (token: string): Promise<boolean> => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/auth/verify-session-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid 2FA code');
      }

      const result = await response.json();
      
      if (result.success && result.verified) {
        setStatus(prev => ({
          ...prev,
          verified: true,
          requiresTwoFactor: false,
          loading: false,
          error: null
        }));
        return true;
      } else {
        throw new Error('2FA verification failed');
      }
    } catch (error: any) {
      console.error('2FA verification error:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to verify 2FA code'
      }));
      return false;
    }
  };

  // Check 2FA requirement when component mounts or authentication changes
  useEffect(() => {
    check2FARequirement();
  }, [isAuthenticated]);

  return {
    ...status,
    verify2FA,
    check2FARequirement
  };
}
