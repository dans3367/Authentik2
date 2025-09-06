import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

interface TwoFactorCheckProps {
  children: React.ReactNode;
}

export function TwoFactorCheck({ children }: TwoFactorCheckProps) {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setChecking(false);
      return;
    }

    const checkTwoFactor = async () => {
      try {
        // Check if user requires 2FA verification
        const response = await fetch('/api/auth/check-2fa-requirement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (response.ok) {
          const status = await response.json();
          console.log('Dashboard 2FA Check:', status);
          
          if (status.requiresTwoFactor && !status.twoFactorVerified) {
            console.log('User needs 2FA, redirecting to 2FA page...');
            setRequiresTwoFactor(true);
            // Redirect to a dedicated 2FA verification page
            setLocation('/auth/2fa-verify');
          } else {
            setRequiresTwoFactor(false);
          }
        }
      } catch (error) {
        console.error('Error checking 2FA status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkTwoFactor();
  }, [isAuthenticated, setLocation]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Checking security requirements...</p>
        </div>
      </div>
    );
  }

  if (requiresTwoFactor) {
    // Will redirect to 2FA page, show loading
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Redirecting to security verification...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}