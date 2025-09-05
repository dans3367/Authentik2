import { useEffect, useState } from "react";
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
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const [isResending, setIsResending] = useState(false);

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setError("Invalid verification link. Please check your email and try again.");
      setIsVerifying(false);
      return;
    }

    console.log("🔍 [VerifyEmail] Starting verification with token:", token);

    // Verify the email token
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(async (response) => {
        const data = await response.json();
        
        console.log("🔍 [VerifyEmail] Verification response:", {
          status: response.status,
          ok: response.ok,
          data
        });
        
        if (response.ok) {
          setIsVerified(true);
          
          const responseData = await response.json();
          console.log("🔍 [VerifyEmail] Verification response data:", responseData);
          
          // Better Auth handles session management automatically
          // If the response includes access token, the session should be established
          if (responseData.accessToken) {
            console.log("🔍 [VerifyEmail] Automatic login detected, Better Auth will handle session...");

            // Invalidate user cache to refresh the verification status
            console.log("🔍 [VerifyEmail] Invalidating user queries...");
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            
            // Force a refetch of the user data
            await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
            
            // Refresh the authentication state in Redux
            console.log("🔍 [VerifyEmail] Refreshing authentication state...");
            await dispatch(checkAuthStatus());
            
            console.log("🔍 [VerifyEmail] User queries invalidated and auth state refreshed");
            
            toast({
              title: "Email Verified!",
              description: "Your account has been successfully verified and you are now logged in.",
            });

            // Wait a moment for the state to update, then redirect
            setTimeout(() => {
              console.log("🔍 [VerifyEmail] Redirecting to dashboard after verification");
              setLocation("/dashboard");
            }, 1000);
          } else {
            // Fallback for older verification flow
            console.log("🔍 [VerifyEmail] Manual login required after verification");
            
            // Invalidate user cache to refresh the verification status
            console.log("🔍 [VerifyEmail] Invalidating user queries...");
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            
            // Force a refetch of the user data
            await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
            
            // Refresh the authentication state in Redux
            console.log("🔍 [VerifyEmail] Refreshing authentication state...");
            await dispatch(checkAuthStatus());
            
            console.log("🔍 [VerifyEmail] User queries invalidated and auth state refreshed");
            
            toast({
              title: "Email Verified!",
              description: "Your account has been successfully verified. You can now log in.",
            });

            // Wait a moment for the state to update, then redirect
            setTimeout(() => {
              console.log("🔍 [VerifyEmail] Redirecting to dashboard after verification");
              setLocation("/dashboard");
            }, 1000);
          }
        } else {
          setError(data.message || "Failed to verify email");
        }
      })
      .catch((error) => {
        console.error("🔍 [VerifyEmail] Verification error:", error);
        setError("An error occurred while verifying your email. Please try again.");
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [toast, queryClient, setLocation, dispatch]);

  // If user is already verified and authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      console.log("🔍 [VerifyEmail] User already verified and authenticated, redirecting to dashboard");
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user?.emailVerified, setLocation]);

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

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verifying Your Email</h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Please wait while we verify your email address...
            </p>
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
            <Button
              onClick={() => setLocation("/dashboard")}
              className="w-full"
            >
              Continue to Dashboard
            </Button>
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