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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Emails Sent
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {emailStats.totalSent.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Last 30 days
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Send className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Open Rate
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {emailStats.avgOpenRate}%
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    3.2% vs last month
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Eye className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-orange-200/50 dark:border-orange-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Click Rate
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {emailStats.avgClickRate}%
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center">
                    <span>↓</span>
                    <span className="ml-1">1.8% vs last month</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <MousePointer className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    Active Campaigns
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    7
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    2 scheduled
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Mail className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                size="lg"
                className="h-24 flex flex-col items-center justify-center bg-white/50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-gray-200/50 dark:border-gray-600/50 transition-all duration-300" 
                onClick={() => setLocation('/email-compose')}
              >
                <Mail className="h-6 w-6 mb-2 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-900 dark:text-gray-100">Create Campaign</span>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="h-24 flex flex-col items-center justify-center bg-white/50 dark:bg-gray-700/50 hover:bg-green-50 dark:hover:bg-green-900/30 border-gray-200/50 dark:border-gray-600/50 transition-all duration-300" 
                onClick={() => setLocation('/email-templates')}
              >
                <FileText className="h-6 w-6 mb-2 text-green-600 dark:text-green-400" />
                <span className="text-gray-900 dark:text-gray-100">Design Template</span>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="h-24 flex flex-col items-center justify-center bg-white/50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 border-gray-200/50 dark:border-gray-600/50 transition-all duration-300" 
                onClick={() => setLocation('/email-contacts')}
              >
                <Users className="h-6 w-6 mb-2 text-purple-600 dark:text-purple-400" />
                <span className="text-gray-900 dark:text-gray-100">Import Contacts</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Token Management Section */}
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
              <Shield className="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
              Token Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-200/50 dark:border-gray-600/50 bg-white/50 dark:bg-gray-700/50 p-4">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Access Token</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Expires in {tokenExpiry}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshToken}
                className="bg-white/50 dark:bg-gray-700/50 hover:bg-green-50 dark:hover:bg-green-900/30 border-gray-200/50 dark:border-gray-600/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200/50 dark:border-gray-600/50 bg-white/50 dark:bg-gray-700/50 p-4">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Refresh Token</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Expires in {refreshTokenExpiry}</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                <Shield className="h-3 w-3 mr-1" />
                Secure
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* User Info Section */}
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/30 hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
              <User className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
                  Email
                </label>
                <div className="rounded-lg border border-gray-200/50 dark:border-gray-600/50 bg-white/50 dark:bg-gray-700/50 p-3 text-sm text-gray-900 dark:text-gray-100">{user.email}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <User className="h-4 w-4 mr-2 text-green-500 dark:text-green-400" />
                  Full Name
                </label>
                <div className="rounded-lg border border-gray-200/50 dark:border-gray-600/50 bg-white/50 dark:bg-gray-700/50 p-3 text-sm text-gray-900 dark:text-gray-100">{user.firstName} {user.lastName}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-orange-500 dark:text-orange-400" />
                  User ID
                </label>
                <div className="rounded-lg border border-gray-200/50 dark:border-gray-600/50 bg-white/50 dark:bg-gray-700/50 p-3 text-sm font-mono break-all text-gray-900 dark:text-gray-100">{user.id}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-purple-500 dark:text-purple-400" />
                  Account Status
                </label>
                <div className="pt-1">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Active
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    );
  }
