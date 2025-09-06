import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useAuth";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { TrendingUp, LogOut, Calendar, Mail, Send, Eye, MousePointer, FileText, RefreshCw, Bug } from "lucide-react";
import { useLocation } from "wouter";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { HighlightsCard } from "@/components/ui/highlights-card";
import { Test401Button } from "@/components/Test401Button";
import { useSession } from "@/lib/betterAuthClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useReduxAuth();
  const logoutMutation = useLogout();
  const { toast } = useToast();
  const { data: session, refetch: refetchSession } = useSession();
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [apiRequests] = useState(1247);
  const [emailStats] = useState({
    totalSent: 23847,
    totalOpened: 13894,
    totalClicked: 5182,
    avgOpenRate: 58.3,
    avgClickRate: 21.7
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/auth");
  };

  const handleSessionRefresh = async () => {
    setIsRefreshingSession(true);
    try {
      await refetchSession();
      toast({
        title: "Session Refreshed",
        description: "Your session has been successfully refreshed.",
      });
    } catch (error) {
      console.error("Session refresh failed:", error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingSession(false);
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
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Welcome back, {user.name || user.email}
              </p>
            </div>
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
        
        {/* Development Testing Section - Only show in development */}
        {import.meta.env.DEV && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Debug Panel
            </h2>

            {/* Session Debug Panel */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Session Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Session Validity Status */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Session Status:</span>
                  {(() => {
                    if (!session?.session?.expiresAt) {
                      return (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md text-xs">
                          Unknown
                        </span>
                      );
                    }

                    const expiresAt = new Date(session.session.expiresAt);
                    const now = new Date();
                    const isValid = expiresAt > now;
                    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
                    const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60));

                    return (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          isValid
                            ? minutesUntilExpiry > 30
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {isValid ? 'Valid' : 'Expired'}
                        </span>
                        {isValid && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Expires in {minutesUntilExpiry > 60
                              ? `${Math.floor(minutesUntilExpiry / 60)}h ${minutesUntilExpiry % 60}m`
                              : `${minutesUntilExpiry}m`
                            }
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">User ID:</span>
                    <p className="font-mono text-xs mt-1">{user?.id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Session Expires:</span>
                    <p className="font-mono text-xs mt-1">
                      {session?.session?.expiresAt
                        ? new Date(session.session.expiresAt).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Last Updated:</span>
                    <p className="font-mono text-xs mt-1">
                      {session?.session?.updatedAt
                        ? new Date(session.session.updatedAt).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Session ID:</span>
                    <p className="font-mono text-xs mt-1 break-all">
                      {session?.session?.id || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSessionRefresh}
                    disabled={isRefreshingSession}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingSession ? 'animate-spin' : ''}`} />
                    {isRefreshingSession ? 'Refreshing...' : 'Refresh Session'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Other Development Tools */}
            <Test401Button />
          </div>
        )}
      </div>


      </div>
    </div>
    );
  }
