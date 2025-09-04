import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authManager } from "@/lib/auth";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Smartphone, Monitor, Tablet, Globe, Clock, MapPin, LogOut } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  location?: string;
  isCurrent: boolean;
  createdAt: string;
  expiresAt: string;
}

function getDeviceIcon(deviceName: string) {
  const name = deviceName.toLowerCase();
  if (name.includes('mobile') || name.includes('iphone') || name.includes('android')) {
    return <Smartphone className="h-5 w-5" />;
  }
  if (name.includes('tablet') || name.includes('ipad')) {
    return <Tablet className="h-5 w-5" />;
  }
  return <Monitor className="h-5 w-5" />;
}

export default function Sessions() {
  console.log("🔍 [SessionsPage] Component rendered");
  const { user, isLoading: authLoading } = useReduxAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check authentication first
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['/api/auth/sessions'],
    queryFn: async () => {
      const response = await authManager.makeAuthenticatedRequest('GET', '/api/auth/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      return response.json();
    },
    staleTime: 0, // Always consider data stale - fetch fresh data every time
    gcTime: 0, // Don't cache data in memory
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const sessions = (sessionsData as any)?.sessions || [];
  
  console.log('🔍 [SessionsPage] Sessions data:', sessionsData);
  console.log('📊 [SessionsPage] Parsed sessions:', sessions);
  console.log('📊 [SessionsPage] Sessions length:', sessions.length);

  const logoutSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await authManager.makeAuthenticatedRequest('DELETE', '/api/auth/sessions', { sessionId });
      if (!response.ok) {
        throw new Error('Failed to logout session');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast({
        title: "Success",
        description: "Device logged out successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log out device",
        variant: "destructive",
      });
    },
  });

  const logoutAllOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      const response = await authManager.makeAuthenticatedRequest('POST', '/api/auth/logout-all');
      if (!response.ok) {
        throw new Error('Failed to logout all other sessions');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast({
        title: "Success",
        description: "All other devices logged out successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log out other devices",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            <div className="mb-8">
              <div className="flex items-center space-x-4">
                <Monitor className="text-blue-600 dark:text-blue-500 w-8 h-8" />
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                    Active Sessions
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage your active login sessions across different devices
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find((s: Session) => s.isCurrent);
  const otherSessions = sessions.filter((s: Session) => !s.isCurrent);
  
  console.log('🎯 [SessionsPage] Current session:', currentSession);
  console.log('📱 [SessionsPage] Other sessions:', otherSessions);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="mb-8">
              <div className="flex items-center space-x-4">
                <Monitor className="text-blue-600 dark:text-blue-500 w-8 h-8" />
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                    Active Sessions
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage your active login sessions across different devices
                  </p>
                </div>
              </div>
            </div>
            {otherSessions.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-red-200 dark:border-red-700/50 hover:from-red-100 hover:to-red-200 dark:hover:from-red-800/40 dark:hover:to-red-700/40 transition-all duration-300 text-red-700 dark:text-red-300"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out All Other Devices
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Log Out All Other Devices?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will log you out from all other devices except this one. 
                      You'll need to sign in again on those devices.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => logoutAllOtherSessionsMutation.mutate()}
                      disabled={logoutAllOtherSessionsMutation.isPending}
                    >
                      {logoutAllOtherSessionsMutation.isPending ? "Logging out..." : "Log Out All"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Current Session */}
          {currentSession && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Current Session</h2>
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-green-600 dark:text-green-500 w-8 h-8 flex items-center justify-center">
                        {getDeviceIcon(currentSession.deviceName)}
                      </div>
                      <div>
                        <CardTitle className="text-base text-gray-900 dark:text-gray-100">{currentSession.deviceName}</CardTitle>
                        <CardDescription className="flex items-center space-x-4 mt-1">
                          <span className="flex items-center">
                            <Globe className="h-3 w-3 mr-1" />
                            {currentSession.ipAddress}
                          </span>
                          {currentSession.location && (
                            <span className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {currentSession.location}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-700">Current</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    Created {formatDistanceToNow(new Date(currentSession.createdAt), { addSuffix: true })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Other Sessions */}
          {otherSessions.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Other Sessions</h2>
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Device</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">IP Address</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Created</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherSessions.map((session: Session) => (
                          <tr key={session.id} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="text-blue-600 dark:text-blue-500">
                                  {getDeviceIcon(session.deviceName)}
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {session.deviceName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {session.ipAddress}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                                  >
                                    <LogOut className="h-3 w-3 mr-1" />
                                    Log Out
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Log Out Device?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will log you out from "{session.deviceName}". 
                                      You'll need to sign in again on that device.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => logoutSessionMutation.mutate(session.id)}
                                      disabled={logoutSessionMutation.isPending}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      {logoutSessionMutation.isPending ? "Logging out..." : "Log Out"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Other Sessions</h2>
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    No other active sessions found
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* No sessions found */}
          {sessions.length === 0 && (
            <div>
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <Monitor className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No Active Sessions</h3>
                      <p className="text-muted-foreground mt-2">
                        No active sessions found. This might indicate a temporary issue.
                      </p>
                      <Button 
                        onClick={() => window.location.reload()} 
                        variant="outline" 
                        className="mt-4"
                      >
                        Refresh Page
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}