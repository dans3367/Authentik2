import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Send, Mail, Server, Clock, CheckCircle, XCircle, Zap, BarChart3, Target, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useSession } from "@/lib/betterAuthClient";

interface EmailTrackingEntry {
  id: string;
  userId: string;
  tenantId: string;
  emailId: string;
  status: string;
  timestamp: string;
  temporalWorkflow?: string;
  metadata?: Record<string, any>;
}

interface EmailCampaignData {
  recipient: string;
  subject: string;
  content: string;
  templateType: string;
  priority: string;
  scheduledAt?: string;
  isScheduled?: boolean;
  timezone?: string;
  requiresReviewerApproval?: boolean;
  reviewerId?: string;
}

export default function EmailTestPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  // Use Better Auth session to get external token
  const { data: session } = useSession();
  
  // Query to get external service token when authenticated
  const { data: tokenData, isLoading: tokenLoading, error: tokenError } = useQuery({
    queryKey: ['/api/external-token', session?.user?.id],
    queryFn: async () => {
      console.log('🔑 [Token] Requesting external token for user:', session?.user?.email);
      const response = await apiRequest('POST', '/api/external-token');
      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }
      const data = await response.json();
      console.log('✅ [Token] External token received, length:', data.token?.length);
      return data;
    },
    enabled: !!session?.user,
    staleTime: 30 * 60 * 1000, // Token valid for 30 minutes
    retry: 3,
  });
  
  const accessToken = tokenData?.token;
  
  console.log('🔍 [Auth] Email test auth state:', {
    hasSession: !!session?.user,
    sessionEmail: session?.user?.email,
    tokenLoading,
    hasToken: !!accessToken,
    tokenLength: accessToken?.length,
    tokenError: tokenError?.message
  });
  const [campaignData, setCampaignData] = useState<EmailCampaignData>({
    recipient: "dan@zendwise.com",
    subject: "Test Email Campaign",
    content: "This is a test email sent through the Go backend and Temporal workflow system.",
    templateType: "marketing",
    priority: "normal",
    isScheduled: false,
    scheduledAt: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    requiresReviewerApproval: false,
    reviewerId: "",
  });

  // Query to check Go server health
  const { data: serverHealth, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['/go-server-health'],
    queryFn: async () => {
      const response = await fetch('https://tenginex.zendwise.work/health');
      if (!response.ok) throw new Error('Go server not available');
      return response.json();
    },
    refetchInterval: 10000, // Check health every 10 seconds
  });

  // Query to get email tracking entries from Go server
  const { data: trackingEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ['/go-server-tracking', accessToken],
    queryFn: async () => {
      if (!accessToken) {
        console.log('🔍 [Tracking] No access token available, skipping fetch');
        return { entries: [], count: 0 };
      }
      
      const response = await fetch('https://tenginex.zendwise.work/api/email-tracking', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch tracking entries');
      return response.json();
    },
    enabled: !!accessToken, // Only run query if we have a token
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch managers for reviewer dropdown (from our Node/Express API)
  const { data: managersData, isLoading: managersLoading } = useQuery({
    queryKey: ["/api/managers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/managers");
      return await response.json();
    },
    staleTime: 60_000,
  });
  const managers = managersData?.managers || [];

  // Mutation to clear temporal workflows
  const clearTemporalMutation = useMutation({
    mutationFn: async () => {
      const token = accessToken;
      
      if (!token) {
        throw new Error('No authentication token available. Please make sure you are logged in.');
      }
      
      console.log('🧹 [Cleanup] Starting temporal workflow cleanup');
      
      const response = await fetch('https://tenginex.zendwise.work/api/temporal/clear-workflows', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ [Cleanup] Request failed:', error);
        throw new Error(`Failed to clear workflows: ${error}`);
      }

      const result = await response.json();
      console.log('✅ [Cleanup] Request successful:', result);
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Temporal Cleanup Completed",
        description: `Successfully cleared ${data.clearedWorkflows || 0} workflows from Temporal`,
      });
      // Refresh tracking entries
      queryClient.invalidateQueries({ queryKey: ['/go-server-tracking'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Cleanup Failed",
        description: error.message,
      });
    },
  });

  // Mutation to send email campaign to Go server
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignData: EmailCampaignData) => {
      // Use token from Redux state (passed from component)
      const token = accessToken;
      
      console.log('🔍 [Campaign] Token check:', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'None',
        sessionExists: !!session?.user,
        sessionEmail: session?.user?.email,
        tokenDataExists: !!tokenData,
        tokenLoading,
        tokenError: tokenError?.message
      });
      
      if (!token) {
        console.error('❌ [Campaign] No authentication token available');
        console.error('🔍 [Campaign] Debug info:', {
          sessionUser: session?.user,
          tokenData,
          tokenLoading,
          tokenError
        });
        
        if (tokenLoading) {
          throw new Error('Authentication token is still loading. Please wait a moment and try again.');
        } else if (tokenError) {
          throw new Error(`Authentication failed: ${tokenError.message}`);
        } else if (!session?.user) {
          throw new Error('You are not logged in. Please log in first.');
        } else {
          throw new Error('Failed to obtain authentication token. Please refresh the page and try again.');
        }
      }
      
      const emailId = `campaign-${Date.now()}`;
      
      // Handle datetime-local timezone conversion properly
      let scheduledAtISO = undefined;
      if (campaignData.isScheduled && campaignData.scheduledAt) {
        // Parse the datetime-local input and convert to the selected timezone
        const inputDateTime = campaignData.scheduledAt; // Format: "2025-08-07T15:30"
        const selectedTimezone = campaignData.timezone || 'UTC';
        
        // Create a date object treating the input as being in the selected timezone
        // We need to use a library like date-fns-tz or manually handle timezone conversion
        // For now, let's create the date and adjust for timezone offset
        const localDate = new Date(inputDateTime);
        
        // Convert datetime-local input to UTC considering the selected timezone
         try {
           // Parse the input datetime components
           const [datePart, timePart] = inputDateTime.split('T');
           const [year, month, day] = datePart.split('-').map(Number);
           const [hour, minute] = timePart.split(':').map(Number);
           
           // Create a date string that represents the time in the selected timezone
           // We'll use a trick: create the date as if it's UTC, then adjust
           const tempDate = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00.000Z`);
           
           // Get the offset for the selected timezone at this date
           const testDate = new Date(tempDate.getTime());
           const utcTime = testDate.getTime();
           
           // Use Intl.DateTimeFormat to get the actual time in the target timezone
           const targetFormatter = new Intl.DateTimeFormat('en-CA', {
             timeZone: selectedTimezone,
             year: 'numeric',
             month: '2-digit', 
             day: '2-digit',
             hour: '2-digit',
             minute: '2-digit',
             second: '2-digit',
             hour12: false
           });
           
           // Create a reference date to calculate offset
           const now = new Date();
           const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
           const targetNow = new Date(targetFormatter.format(now));
           const offset = utcNow.getTime() - targetNow.getTime();
           
           // Apply the offset to our target time
           const adjustedTime = new Date(utcTime + offset);
           scheduledAtISO = adjustedTime.toISOString();
           
         } catch (error) {
           console.error('Timezone conversion error:', error);
           // Fallback: treat input as local time and convert to UTC
           scheduledAtISO = new Date(inputDateTime).toISOString();
         }
        
        console.log('🕐 [Campaign] Scheduling time conversion:', {
           originalInput: campaignData.scheduledAt,
           selectedTimezone: selectedTimezone,
           localDate: localDate,
           finalScheduledAtISO: scheduledAtISO,
           currentTime: new Date().toISOString()
         });
      }

      const status = campaignData.requiresReviewerApproval
        ? "awaiting_approval"
        : (campaignData.isScheduled ? "scheduled" : "queued");

      // Get reviewer email from managers data if reviewerId is provided
      let reviewerEmail = undefined;
      if (campaignData.reviewerId && managers.length > 0) {
        const reviewer = managers.find((m: any) => m.id === campaignData.reviewerId);
        reviewerEmail = reviewer?.email;
      }
      // Guard: if approval is required but we cannot resolve a reviewer email, stop early
      if (campaignData.requiresReviewerApproval && !reviewerEmail) {
        throw new Error(
          "Requires reviewer approval, but no reviewer selected or reviewer email unavailable. Please select a reviewer."
        );
      }

      const payload = {
        emailId,
        status,
        temporalWorkflow: `email-workflow-${emailId}`,
        scheduledAt: scheduledAtISO,
        timezone: campaignData.timezone,
        metadata: {
          recipient: campaignData.recipient,
          subject: campaignData.subject,
          content: campaignData.content,
          templateType: campaignData.templateType,
          priority: campaignData.priority,
          requiresReviewerApproval: !!campaignData.requiresReviewerApproval,
          reviewerId: campaignData.reviewerId || undefined,
          reviewerEmail: reviewerEmail,
          to: campaignData.recipient, // Add 'to' field for email activity
          sentAt: scheduledAtISO || new Date().toISOString(),
        }
      };

      console.log('🚀 [Campaign] Sending request to Go server:', {
        url: 'https://tenginex.zendwise.work/api/email-tracking',
        tokenLength: token.length,
        emailId: emailId,
        payload: payload,
        isScheduled: campaignData.isScheduled,
        scheduledAt: campaignData.scheduledAt
      });

      const response = await fetch('https://tenginex.zendwise.work/api/email-tracking', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📡 [Campaign] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ [Campaign] Request failed:', {
          status: response.status,
          error: error
        });
        throw new Error(`Failed to send campaign: ${error}`);
      }

      const result = await response.json();
      console.log('✅ [Campaign] Request successful:', result);
      return result;
    },
    onSuccess: async (data) => {
      toast({
        title: campaignData.isScheduled ? "Campaign Scheduled Successfully" : "Campaign Sent Successfully",
        description: campaignData.isScheduled 
          ? `Email campaign scheduled with ID: ${data.id}`
          : `Email campaign queued with ID: ${data.id}`,
      });
      // Reviewer notification is now handled automatically by the Temporal workflow
      if (campaignData.requiresReviewerApproval) {
        toast({
          title: 'Campaign Awaiting Approval',
          description: 'The reviewer will be notified automatically and the campaign will be sent upon approval.',
        });
      }
      // Refresh tracking entries
      queryClient.invalidateQueries({ queryKey: ['/go-server-tracking'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Campaign Failed",
        description: error.message,
      });
    },
  });

  const handleSendCampaign = () => {
    if (!campaignData.recipient || !campaignData.subject) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in recipient and subject fields.",
      });
      return;
    }

    if (campaignData.isScheduled) {
      if (!campaignData.scheduledAt) {
        toast({
          variant: "destructive",
          title: "Missing Schedule Time",
          description: "Please select a date and time for scheduled sending.",
        });
        return;
      }

      const scheduledTime = new Date(campaignData.scheduledAt);
      const now = new Date();
      
      if (scheduledTime <= now) {
        toast({
          variant: "destructive",
          title: "Invalid Schedule Time",
          description: "Scheduled time must be in the future.",
        });
        return;
      }
    }

    if (campaignData.requiresReviewerApproval && !campaignData.reviewerId) {
      toast({
        variant: "destructive",
        title: "Reviewer Required",
        description: "Select a reviewer when approval is required.",
      });
      return;
    }

    sendCampaignMutation.mutate(campaignData);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'queued': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'scheduled': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'workflow_scheduled': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'sent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'bounced': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'queued': return <Clock className="h-3 w-3" />;
      case 'scheduled': return <Clock className="h-3 w-3" />;
      case 'workflow_scheduled': return <Clock className="h-3 w-3" />;
      case 'sent': return <Send className="h-3 w-3" />;
      case 'delivered': return <CheckCircle className="h-3 w-3" />;
      case 'failed': return <XCircle className="h-3 w-3" />;
      case 'bounced': return <XCircle className="h-3 w-3" />;
      default: return <Mail className="h-3 w-3" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Email Testing
          </h1>
          <p className="text-lg text-muted-foreground">
            Test email campaigns through Go backend and Temporal workflows
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 bg-card rounded-lg border shadow-sm">
            <Server className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Go Server:</span>
            {healthLoading ? (
              <Badge variant="outline" className="gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                Checking...
              </Badge>
            ) : healthError ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Offline
              </Badge>
            ) : serverHealth ? (
              <Badge variant="default" className="bg-green-600 gap-1">
                <CheckCircle className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline">Unknown</Badge>
            )}
          </div>
          <Button variant="outline" onClick={() => setLocation('/email-approvals')} className="gap-2">
            <ShieldCheck className="h-4 w-4" /> View Approvals
          </Button>
        </div>
      </div>

      {/* Temporal Cleanup Section */}
      <Card className="shadow-lg border-l-4 border-l-orange-500">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Trash2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            Temporal Cleanup
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Clear failed or stuck workflows from the Temporal system
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Warning: System Cleanup Operation
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    This will terminate all running workflows in the Temporal system, including old failed workflows 
                    that are causing errors. Only use this in development environments or when experiencing workflow issues.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
              <div>
                <h4 className="text-sm font-semibold">Clear Failed Workflows</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Terminates stuck "EmailProcessingWorkflow" and other problematic workflows
                </p>
              </div>
              <Button
                onClick={() => clearTemporalMutation.mutate()}
                disabled={clearTemporalMutation.isPending || !serverHealth}
                variant="destructive"
                className="gap-2"
              >
                {clearTemporalMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Clear Workflows
                  </>
                )}
              </Button>
            </div>

            {!serverHealth && (
              <div className="flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <XCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  Go server must be online to perform cleanup operations
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 xl:grid-cols-3">
        {/* Campaign Composer - Larger card */}
        <Card className="xl:col-span-2 shadow-lg border-l-4 border-l-blue-500">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              Campaign Composer
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create and send test email campaigns through the Go backend
            </p>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="recipient" className="text-sm font-semibold">Recipient Email</Label>
                <Input
                  id="recipient"
                  type="email"
                  value={campaignData.recipient}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, recipient: e.target.value }))}
                  placeholder="Enter recipient email"
                  className="h-11"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="subject" className="text-sm font-semibold">Subject Line</Label>
                <Input
                  id="subject"
                  value={campaignData.subject}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter email subject"
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="content" className="text-sm font-semibold">Email Content</Label>
              <Textarea
                id="content"
                value={campaignData.content}
                onChange={(e) => setCampaignData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter email content"
                className="min-h-[140px] resize-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="template" className="text-sm font-semibold">Template Type</Label>
                <select
                  id="template"
                  value={campaignData.templateType}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, templateType: e.target.value }))}
                  className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="marketing">📈 Marketing</option>
                  <option value="transactional">🔄 Transactional</option>
                  <option value="newsletter">📰 Newsletter</option>
                  <option value="notification">🔔 Notification</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="priority" className="text-sm font-semibold">Priority Level</Label>
                <select
                  id="priority"
                  value={campaignData.priority}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">🔹 Low</option>
                  <option value="normal">🔸 Normal</option>
                  <option value="high">🔶 High</option>
                  <option value="urgent">🔴 Urgent</option>
                </select>
              </div>
            </div>

            {/* Scheduling Section */}
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isScheduled"
                  checked={campaignData.isScheduled}
                  onChange={(e) => setCampaignData(prev => ({ 
                    ...prev, 
                    isScheduled: e.target.checked,
                    scheduledAt: e.target.checked ? prev.scheduledAt : ""
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="isScheduled" className="text-sm font-semibold cursor-pointer">
                  🗓️ Schedule Email for Later
                </Label>
              </div>

              {campaignData.isScheduled && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="scheduledAt" className="text-sm font-semibold">
                    Schedule Date & Time (with seconds precision)
                  </Label>
                  <input
                    type="datetime-local"
                    id="scheduledAt"
                    step="1"
                    value={campaignData.scheduledAt}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 19)}
                  />
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-sm font-semibold">
                      Timezone
                    </Label>
                    <select
                      id="timezone"
                      value={campaignData.timezone}
                      onChange={(e) => setCampaignData(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Asia/Shanghai">Shanghai (CST)</option>
                      <option value="Australia/Sydney">Sydney (AEST)</option>
                    </select>
                  </div>
                  
                  {campaignData.scheduledAt && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        📅 Scheduled for: {new Date(campaignData.scheduledAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        🌍 Timezone: {campaignData.timezone}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Review & Approval */}
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <Target className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Review & Approval</h3>
                  <p className="text-xs text-muted-foreground">Configure approval workflow for this campaign.</p>
                </div>
              </div>

              <div className="flex flex-row items-start gap-3">
                <input
                  type="checkbox"
                  id="requiresReviewerApproval"
                  checked={!!campaignData.requiresReviewerApproval}
                  onChange={(e) => setCampaignData(prev => ({
                    ...prev,
                    requiresReviewerApproval: e.target.checked,
                    reviewerId: e.target.checked ? prev.reviewerId : "",
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="requiresReviewerApproval" className="text-sm font-medium cursor-pointer">
                    Requires Reviewer Approval
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    This campaign will require approval from a manager before it can be activated.
                  </p>
                </div>
              </div>

              {campaignData.requiresReviewerApproval && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <Label htmlFor="reviewerId" className="text-sm font-semibold">Select Reviewer</Label>
                  <select
                    id="reviewerId"
                    value={campaignData.reviewerId}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, reviewerId: e.target.value }))}
                    disabled={managersLoading || managers.length === 0}
                    className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {managersLoading ? (
                      <option value="" disabled>Loading managers...</option>
                    ) : managers.length === 0 ? (
                      <option value="" disabled>No managers available</option>
                    ) : (
                      <>
                        <option value="">Select a manager</option>
                        {managers.map((manager: any) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName} - {manager.email} ({manager.role})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <Button
                onClick={handleSendCampaign}
                disabled={sendCampaignMutation.isPending || !serverHealth}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
              >
                {sendCampaignMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                    {campaignData.isScheduled ? "Scheduling Campaign..." : "Sending Campaign..."}
                  </>
                ) : (
                  <>
                    {campaignData.isScheduled ? (
                      <>
                        <Clock className="h-5 w-5 mr-3" />
                        Schedule Campaign
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5 mr-3" />
                        Send Campaign Now
                      </>
                    )}
                  </>
                )}
              </Button>

              {!serverHealth && (
                <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Go server must be online to send campaigns
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Server Status & Info */}
        <Card className="shadow-lg border-l-4 border-l-green-500">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Server className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              Backend Status
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Go server and Temporal connectivity
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            {healthLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
                <p className="text-sm text-muted-foreground">Checking server status...</p>
              </div>
            ) : healthError ? (
              <div className="text-center py-6">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-full w-fit mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-red-500 mx-auto" />
                </div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                  Go server is offline or unreachable
                </p>
                <p className="text-xs text-muted-foreground">
                  Make sure the server is accessible at https://tenginex.zendwise.work
                </p>
              </div>
            ) : serverHealth ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <span className="text-sm font-semibold">Server Status:</span>
                  <Badge variant="default" className="bg-green-600 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {serverHealth.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <span className="text-sm font-semibold">Temporal:</span>
                  <Badge variant={serverHealth.temporal?.includes("connected") ? "default" : "secondary"} className="gap-1">
                    {serverHealth.temporal?.includes("connected") ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {serverHealth.temporal}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                  <span className="text-sm font-semibold">Mode:</span>
                  <Badge variant="outline" className="gap-1">
                    <Server className="h-3 w-3" />
                    {serverHealth.mode || "production"}
                  </Badge>
                </div>
                <div className="text-xs text-center text-muted-foreground pt-2 border-t">
                  Last checked: {new Date(serverHealth.time).toLocaleTimeString()}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Email Tracking Entries */}
      <Card className="shadow-lg border-l-4 border-l-purple-500">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            Email Tracking Entries
            {entriesLoading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 ml-2" />
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Real-time tracking of email campaign status and workflow execution
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {entriesLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4" />
              <p className="text-sm text-muted-foreground">Loading tracking entries...</p>
            </div>
          ) : trackingEntries?.entries?.length > 0 ? (
            <div className="space-y-4">
              {trackingEntries.entries.map((entry: EmailTrackingEntry) => (
                <div
                  key={entry.id}
                  className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={`${getStatusColor(entry.status)} gap-1 px-3 py-1`}>
                          {getStatusIcon(entry.status)}
                          <span className="font-medium">{entry.status}</span>
                        </Badge>
                        <span className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                          {entry.emailId}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {entry.metadata?.recipient && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">TO:</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {entry.metadata.recipient}
                            </p>
                          </div>
                        )}
                        {entry.metadata?.subject && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">SUBJECT:</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              {entry.metadata.subject}
                            </p>
                          </div>
                        )}
                      </div>
                      {(entry.status === 'scheduled' || entry.status === 'workflow_scheduled') && entry.metadata?.sentAt && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-semibold text-purple-500 dark:text-purple-400">SCHEDULED FOR:</span>
                          <p className="text-sm text-purple-600 dark:text-purple-400 font-mono">
                            {new Date(entry.metadata.sentAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {entry.temporalWorkflow && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-purple-500">WORKFLOW:</span>
                          <p className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 px-2 py-1 rounded">
                            {entry.temporalWorkflow}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4">
                <Mail className="h-12 w-12 text-gray-400 mx-auto" />
              </div>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
                No email tracking entries found
              </p>
              <p className="text-sm text-muted-foreground">
                Send a campaign to see tracking entries appear here
              </p>
            </div>
          )}
          
          {trackingEntries && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  Total tracking entries: {trackingEntries.count || 0}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}