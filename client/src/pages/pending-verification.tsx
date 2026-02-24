import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, Clock, CheckCircle, Pencil, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export default function PendingVerificationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isResending, setIsResending] = useState(false);
  const [nextAllowedTime, setNextAllowedTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Change email state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Force light theme on verification page regardless of user preference
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

  // Redirect if user is already verified
  useEffect(() => {
    if (user?.emailVerified) {
      window.location.href = "/dashboard";
    }
  }, [user]);

  // Periodically check for verification status updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Refresh user data to check if email was verified
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [queryClient]);

  // Countdown timer for rate limiting
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (nextAllowedTime) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const targetTime = nextAllowedTime.getTime();
        const difference = targetTime - now;

        if (difference > 0) {
          setTimeRemaining(Math.ceil(difference / 1000));
        } else {
          setTimeRemaining(0);
          setNextAllowedTime(null);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [nextAllowedTime]);

  const handleResendVerification = async () => {
    if (!user?.email || timeRemaining > 0 || user?.emailVerified) return;

    setIsResending(true);

    try {
      const response = await apiRequest("POST", "/api/auth/resend-verification", {
        email: user.email,
      });

      const data = await response.json();

      if (response.ok) {
        // Check if user was already verified
        if (data.alreadyVerified) {
          toast({
            title: "Already Verified",
            description: "Your email is already verified. Redirecting to dashboard...",
          });
          // Full page reload to get fresh auth state
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 1500);
          return;
        }

        toast({
          title: "Verification Email Sent",
          description: "Please check your inbox for the new verification email.",
        });

        // Set the next allowed time for rate limiting
        if (data.nextAllowedAt) {
          setNextAllowedTime(new Date(data.nextAllowedAt));
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send verification email",
          variant: "destructive",
        });

        // Handle rate limiting response
        if (response.status === 429 && data.retryAfter) {
          const nextTime = new Date(Date.now() + (data.retryAfter * 60 * 1000));
          setNextAllowedTime(nextTime);
        }
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

  const handleChangeEmail = async () => {
    setEmailError("");

    if (!newEmail.trim()) {
      setEmailError("Please enter an email address");
      return;
    }

    // Basic client-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError("Please enter a valid email address");
      return;
    }

    // Don't allow submitting the same email
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setEmailError("New email is the same as your current email");
      return;
    }

    setIsSubmittingEmail(true);

    try {
      const response = await apiRequest("POST", "/api/auth/change-email-unverified", {
        newEmail: newEmail.trim(),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Email Changed",
          description: `A verification email has been sent to ${data.email}.`,
        });
        setIsChangingEmail(false);
        setNewEmail("");
        // Refresh session data to show the new email
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        await queryClient.invalidateQueries({ queryKey: ["better-auth"] });
      } else {
        setEmailError(data.message || "Failed to change email");
      }
    } catch (error) {
      setEmailError("An error occurred while changing your email");
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification email to <strong>{user?.email}</strong>.
            Please check your inbox and click the verification link to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Check your spam folder</p>
                <p>Sometimes verification emails end up in spam or promotional folders.</p>
              </div>
            </div>
          </div>

          {/* Change Email Section */}
          {isChangingEmail ? (
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Change Email Address</p>
                <button
                  onClick={() => {
                    setIsChangingEmail(false);
                    setNewEmail("");
                    setEmailError("");
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                type="email"
                placeholder="Enter your new email address"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSubmittingEmail) {
                    handleChangeEmail();
                  }
                }}
                disabled={isSubmittingEmail}
                className={emailError ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {emailError && (
                <p className="text-xs text-red-500">{emailError}</p>
              )}
              <Button
                onClick={handleChangeEmail}
                disabled={isSubmittingEmail || !newEmail.trim()}
                className="w-full"
                size="sm"
              >
                {isSubmittingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Email & Resend Verification"
                )}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsChangingEmail(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors py-1"
            >
              <Pencil className="h-3.5 w-3.5" />
              Wrong email? Change it
            </button>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleResendVerification}
              disabled={isResending || timeRemaining > 0 || user?.emailVerified}
              className="w-full"
              variant="outline"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : timeRemaining > 0 ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Resend in {formatTime(timeRemaining)}
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

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Verification emails are sent every 5 minutes to prevent spam.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}