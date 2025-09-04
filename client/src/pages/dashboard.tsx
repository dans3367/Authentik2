import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLogout } from "@/hooks/useAuth";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import type { UserSubscriptionResponse, RefreshTokenInfo } from "@shared/schema";
import { authManager } from "@/lib/auth";
import { Shield, Users, Clock, TrendingUp, LogOut, RefreshCw, Settings, CreditCard, Calendar, Mail, Send, Eye, MousePointer, FileText, User } from "lucide-react";
import { useLocation } from "wouter";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { HighlightsCard } from "@/components/ui/highlights-card";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useReduxAuth();
  const logoutMutation = useLogout();
  const [tokenExpiry, setTokenExpiry] = useState<string>("--");
  const [refreshTokenExpiry, setRefreshTokenExpiry] = useState<string>("--");
  const [apiRequests] = useState(1247);
  const [emailStats] = useState({
    totalSent: 23847,
    totalOpened: 13894,
    totalClicked: 5182,
    avgOpenRate: 58.3,
    avgClickRate: 21.7
  });

  // Fetch user's subscription (only for Owners)
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<UserSubscriptionResponse>({
    queryKey: ['/api/my-subscription'],
    enabled: !!user && user.role === 'Owner',
  });

  // Fetch user's sessions
  const { data: sessionsData } = useQuery({
    queryKey: ['/api/auth/sessions'],
    queryFn: async () => {
      const response = await authManager.makeAuthenticatedRequest('GET', '/api/auth/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  const sessionCount = (sessionsData as any)?.sessions?.length || 0;

  // DISABLED: Mandatory subscription redirect
  // If user doesn't have subscription, show subscription prompt instead of hard redirect
  // useEffect(() => {
  //   if (!subscriptionLoading && !subscription?.subscription) {
  //     // Only redirect if user has been on dashboard for a moment (not immediate)
  //     const timer = setTimeout(() => {
  //       setLocation('/subscribe');
  //     }, 1500); // Give time for auth to stabilize
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [subscription, subscriptionLoading, setLocation]);

  // Function to fetch refresh token info
  const fetchRefreshTokenInfo = async () => {
    try {
      const response = await fetch('/api/auth/refresh-token-info', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data: RefreshTokenInfo = await response.json();
        if (data.isExpired) {
          setRefreshTokenExpiry("Expired");
        } else {
          const { days, hours, minutes } = data;
          if (days > 0) {
            setRefreshTokenExpiry(`${days} day${days !== 1 ? 's' : ''}`);
          } else if (hours > 0) {
            setRefreshTokenExpiry(`${hours} hour${hours !== 1 ? 's' : ''}`);
          } else {
            setRefreshTokenExpiry(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
          }
        }
      } else {
        // Handle different error responses
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        if (errorData.message === "Malformed refresh token") {
          setRefreshTokenExpiry("Invalid Token");
        } else if (errorData.message === "Refresh token expired") {
          setRefreshTokenExpiry("Expired");
        } else {
          setRefreshTokenExpiry("No Token");
        }
      }
    } catch (error) {
      console.error("Failed to fetch refresh token info:", error);
      setRefreshTokenExpiry("Network Error");
    }
  };

  useEffect(() => {
    // Token countdown simulation
    let interval: NodeJS.Timeout;
    
    const updateTokenExpiry = () => {
      const token = authManager.getAccessToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expTime = payload.exp * 1000;
          const now = Date.now();
          const timeLeft = expTime - now;
          
          if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            setTokenExpiry(`${minutes}m ${seconds}s`);
          } else {
            setTokenExpiry("Expired");
          }
        } catch (error) {
          setTokenExpiry("Invalid");
        }
      } else {
        setTokenExpiry("No token");
      }
    };

    updateTokenExpiry();
    interval = setInterval(updateTokenExpiry, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch refresh token expiry info
    fetchRefreshTokenInfo();
    const refreshInterval = setInterval(fetchRefreshTokenInfo, 5 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/auth");
  };

  const handleRefreshToken = async () => {
    try {
      await authManager.refreshAccessToken();
      // Refresh the token expiry displays
      await fetchRefreshTokenInfo();
    } catch (error) {
      console.error("Token refresh failed:", error);
      setLocation("/auth");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Page Header with Free Trial Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Welcome back, {user.firstName} {user.lastName}
              </p>
            </div>
          {/* Free Trial Panel */}
          {subscription?.subscription && subscription.subscription.status === 'trialing' && subscription.subscription.trialEnd && new Date(subscription.subscription.trialEnd) > new Date() && (
            <Card className="p-4 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/30 shadow-lg">
              <p className="text-sm text-gray-900 dark:text-gray-100">
                <strong>🎉 Free Trial Active:</strong> Your trial ends on {new Date(subscription.subscription.trialEnd).toLocaleDateString()}
              </p>
            </Card>
          )}
        </div>
        
        {/* Add minimal spacer after the header section */}
        <div className="h-3"></div>

        {/* Newsletter Creation and Highlights Cards */}
        <div className="flex flex-col lg:flex-row gap-6 max-w-7xl w-full">
          {/* Swift Setup - Wider */}
          <div className="flex-[2]">
            <NewsletterCard />
          </div>
          
          {/* Highlights - Narrower */}
          <div className="flex-[1]">
            <HighlightsCard />
          </div>
        </div>
      </div>

        {/* Subscription Info for Non-Owners */}
        {!subscription?.subscription && user?.role !== "Owner" && (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-orange-200/50 dark:border-orange-700/30 border-l-4 border-l-orange-500 dark:border-l-orange-400 hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
                <CreditCard className="mr-2 h-5 w-5 text-orange-600 dark:text-orange-400" />
                Subscription Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-gray-200/50 dark:border-gray-600/50 bg-white/50 dark:bg-gray-700/50 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>ℹ️ Subscription Management:</strong> Subscription plans and billing are managed by your organization's Owner. 
                  Contact your organization owner if you need to upgrade or modify subscription plans.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Token Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Access Token Status */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
                <Shield className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                Access Token
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {tokenExpiry}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Time until expiry
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefreshToken}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Token
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Refresh Token Status */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
                <Clock className="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
                Refresh Token
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {refreshTokenExpiry}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Time until expiry
                </div>
                <Badge variant={refreshTokenExpiry === "Expired" ? "destructive" : "secondary"} className="w-full justify-center">
                  {refreshTokenExpiry === "Expired" ? "Expired" : 
                   refreshTokenExpiry === "Invalid Token" ? "Invalid" :
                   refreshTokenExpiry === "No Token" ? "Missing" :
                   refreshTokenExpiry === "Network Error" ? "Error" : "Active"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
                <Users className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" />
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {sessionCount}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Current sessions
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation('/sessions')}
                  className="w-full"
                >
                  <User className="mr-2 h-4 w-4" />
                  Manage Sessions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-red-200/50 dark:border-red-700/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
                <Settings className="mr-2 h-5 w-5 text-red-600 dark:text-red-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Account management
                </div>
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLocation('/profile')}
                    className="w-full"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleLogout}
                    className="w-full"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    );
  }
