import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, LogOut } from 'lucide-react';
import { useLogout } from '@/hooks/useAuth';

interface TwoFactorFormData {
  token: string;
}

export default function TwoFactorVerifyPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isVerifying, setIsVerifying] = useState(false);
  const logoutMutation = useLogout();

  const form = useForm<TwoFactorFormData>({
    defaultValues: {
      token: ''
    }
  });

  const onSubmit = async (data: TwoFactorFormData) => {
    if (isVerifying) return;

    setIsVerifying(true);
    form.clearErrors();

    try {
      const response = await fetch('/api/auth/verify-session-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: data.token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid 2FA code');
      }

      const result = await response.json();
      if (result.success && result.verified) {
        // 2FA verification successful, redirect to dashboard
        form.reset();
        setLocation("/dashboard");
      } else {
        throw new Error('Invalid 2FA code');
      }
    } catch (error: any) {
      console.error('2FA verification error:', error);
      form.setError('token', {
        type: 'manual',
        message: error.message || 'Invalid verification code'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation('/auth');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Two-Factor Authentication
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            {user?.email ? `Verifying ${user.email}` : 'Enter your authentication code'}
          </p>
        </CardHeader>

        <CardContent className="p-6 pt-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="token">Authentication Code</Label>
              <Input
                id="token"
                type="text"
                placeholder="000000"
                maxLength={6}
                className="text-center text-xl tracking-widest font-mono mt-2"
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

            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                Open your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code.
              </AlertDescription>
            </Alert>

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
                'Verify & Continue'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full"
              disabled={isVerifying}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}