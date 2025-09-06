import { useState } from 'react';
import { use2FA } from '@/hooks/use2FA';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface TwoFactorGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface TwoFactorFormData {
  token: string;
}

export function TwoFactorGuard({ children, fallback }: TwoFactorGuardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { 
    requiresTwoFactor, 
    twoFactorEnabled, 
    verified, 
    loading, 
    error,
    verify2FA,
    check2FARequirement 
  } = use2FA();

  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<TwoFactorFormData>({
    defaultValues: {
      token: ''
    }
  });

  // Show loading state while checking authentication or 2FA status
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // User not authenticated - this should be handled by auth guards upstream
  if (!isAuthenticated) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600">
              Please log in to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2FA is not enabled or already verified - show children
  if (!twoFactorEnabled || verified || !requiresTwoFactor) {
    return <>{children}</>;
  }

  // 2FA verification required
  const onSubmit = async (data: TwoFactorFormData) => {
    if (isVerifying) return;

    setIsVerifying(true);
    form.clearErrors();

    try {
      const success = await verify2FA(data.token);
      if (success) {
        form.reset();
        // Children will be shown automatically due to state update
      }
    } catch (error: any) {
      form.setError('token', {
        type: 'manual',
        message: error.message || 'Verification failed'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRetry = () => {
    check2FARequirement();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Two-Factor Authentication Required
          </CardTitle>
          <p className="text-sm text-gray-600">
            Please enter your 6-digit authentication code to continue
          </p>
        </CardHeader>

        <CardContent className="p-6 pt-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="token" className="sr-only">
                Authentication Code
              </Label>
              <Input
                id="token"
                type="text"
                placeholder="000000"
                maxLength={6}
                className="text-center text-xl tracking-widest font-mono"
                {...form.register('token', {
                  required: 'Authentication code is required',
                  pattern: {
                    value: /^\d{6}$/,
                    message: 'Please enter a valid 6-digit code'
                  }
                })}
                disabled={isVerifying}
                autoComplete="one-time-code"
                autoFocus
              />
              {form.formState.errors.token && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.token.message}
                </p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              onClick={handleRetry}
              className="text-sm text-gray-600 hover:text-gray-800"
              disabled={isVerifying}
            >
              Having trouble? Try again
            </Button>
          </div>

          <Alert className="mt-4">
            <Shield className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Open your authenticator app to get your verification code. If you don't have access to your device, contact your administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

export default TwoFactorGuard;
