import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2, Clock, CheckCircle } from "lucide-react";
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