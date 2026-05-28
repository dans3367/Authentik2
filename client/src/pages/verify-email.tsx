import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Mail, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useAppDispatch } from "@/store";
// Note: Auth status checking will be handled by better-auth
// Note: Removed old JWT authentication imports - Better Auth handles authentication

export default function VerifyEmailPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useReduxAuth();
  const dispatch = useAppDispatch();
  // Verification is a two-step UX now to avoid email-scanner / link-preview
  // services consuming the single-use token before the real user clicks:
  //   1. On mount we do a GET /api/auth/verify-email which only validates
  //      the token signature (no side effects).
  //   2. The user clicks "Verify my email" which POSTs to the same path to
  //      actually consume the token.
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5); // 5 second countdown
  const [token, setToken] = useState<string | null>(null);

  // Force light theme on email verification page regardless of user preference
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    
    // Cleanup: restore previous theme when leaving
    const originalTheme = localStorage.getItem('theme');
    return () => {
      if (originalTheme === 'dark') {
        root.classList.remove('light');
        root.classList.add('dark');
      }
    };
  }, []);

  // Step 1: on mount, GET the token — server validates signature only
  // and never consumes / never sets a session cookie.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const t = urlParams.get("token");

    if (!t) {
      setError("Invalid verification link. Please check your email and try again.");
      setTokenStatus('invalid');
      return;
    }
    setToken(t);

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(t)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.tokenValid) {
          setTokenStatus('valid');
        } else {
          setError(data?.message || "Verification link is invalid or has expired.");
          setTokenStatus('invalid');
        }
      })
      .catch(() => {
        setError("An error occurred while checking your verification link. Please try again.");
        setTokenStatus('invalid');
      });
  }, []);

  // Step 2: explicit user-driven POST to actually consume the token.
  const handleConfirmVerification = useCallback(async () => {
    if (!token || isVerifying) return;
    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setIsVerified(true);
        toast({
          title: "Email Verified!",
          description: "Your account has been successfully verified. Please log in to continue.",
        });
      } else {
        setError(data?.message || "Failed to verify email");
        setTokenStatus('invalid');
      }
    } catch (err) {
      setError("An error occurred while verifying your email. Please try again.");
      setTokenStatus('invalid');
    } finally {
      setIsVerifying(false);
    }
  }, [token, isVerifying, toast]);

  // If user is already verified and authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      console.log("🔍 [VerifyEmail] User already verified and authenticated, redirecting to dashboard");
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user?.emailVerified, setLocation]);

  // Function to handle redirect to login with cache refresh
  const handleRedirectToLogin = useCallback(async () => {
    console.log("🔄 [VerifyEmail] Clearing auth cache before redirect to login");
    
    // Clear auth queries to ensure fresh login
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    await queryClient.invalidateQueries({ queryKey: ["better-auth"] });
    queryClient.clear();
    
    // Force navigation to login page
    console.log("🔍 [VerifyEmail] Redirecting to login page");
    window.location.href = "/auth"; // Force full page reload with clean state
  }, [queryClient]);

  // Countdown timer for auto-redirect to login
  useEffect(() => {
    if (isVerified && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isVerified && redirectCountdown === 0) {
      console.log("🔍 [VerifyEmail] Auto-redirecting to login");
      handleRedirectToLogin();
    }
  }, [isVerified, redirectCountdown, handleRedirectToLogin]);

  const handleResendVerification = async () => {
    const email = prompt("Please enter your email address to resend verification:");
    if (!email) return;

    setIsResending(true);
    
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Verification Email Sent",
          description: "Please check your inbox for the new verification email.",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send verification email",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while sending the verification email",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  if (tokenStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Checking Verification Link</h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Please wait...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token is valid but not yet consumed — show explicit verify button so
  // the single-use token is only burned by a real user click.
  if (tokenStatus === 'valid' && !isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Mail className="h-16 w-16 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Verify your email</CardTitle>
            <CardDescription>
              Click the button below to confirm your email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <Button onClick={handleConfirmVerification} disabled={isVerifying} className="w-full">
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>Verify my email</>
              )}
            </Button>
            <Button onClick={() => setLocation("/auth")} variant="ghost" className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {isVerified ? (
              <CheckCircle className="h-16 w-16 text-green-600" />
            ) : (
              <XCircle className="h-16 w-16 text-red-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isVerified ? "Email Verified!" : "Verification Failed"}
          </CardTitle>
          <CardDescription>
            {isVerified
              ? "Your account has been successfully verified."
              : error || "There was an issue verifying your email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {isVerified ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Redirecting to login in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
              </p>
              <Button
                onClick={handleRedirectToLogin}
                className="w-full"
              >
                Proceed to Login
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full"
                variant="outline"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
              <Button
                onClick={() => setLocation("/auth")}
                variant="ghost"
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}