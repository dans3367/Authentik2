import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Eye,
  Edit,
  Send,
  Clock,
  User,
  Users,
  TrendingUp,
  MousePointer,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
  ShieldOff,
  RefreshCw,
  Newspaper,
  Tag,
  Activity,
  BarChart3,
  List,
  ExternalLink,
  History,
  Loader2,
  Search,
  X,
  ShieldCheck,
  ClipboardCheck,
  MessageSquare,
  KeyRound,
  Hash
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import EmailActivityTimelineModal from "@/components/EmailActivityTimelineModal";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { LiveTrackingPanel } from "@/components/newsletter/LiveTrackingPanel";
import { useNewsletterStats } from "@/hooks/useNewsletterTracking";
import type { NewsletterWithUser, NewsletterTaskStatus } from "@shared/schema";

// Using real task status data from backend via NewsletterTaskStatus type

interface TimelineEvent {
  id: string;
  type: 'created' | 'scheduled' | 'validated' | 'sent' | 'opened' | 'clicked';
  title: string;
  description?: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: Record<string, any>;
}

export default function NewsletterViewPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [trajectoryModalOpen, setTrajectoryModalOpen] = useState(false);
  const [selectedTrajectory, setSelectedTrajectory] = useState<any>(null);
  const tasksInitializedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user } = useReduxAuth();
  const currentUserId = (user as any)?.id;

  // Reviewer workflow state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [approvalCodeError, setApprovalCodeError] = useState("");

  // Detect if reviewer arrived via email link with code in URL
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isReviewerFromEmail = urlParams.get('reviewer') === 'true';
  const emailApprovalCode = urlParams.get('code') || '';

  // Pre-fill approval code from URL if present
  useEffect(() => {
    if (emailApprovalCode && emailApprovalCode.length === 5) {
      setApprovalCode(emailApprovalCode);
    }
  }, [emailApprovalCode]);

  const liveStats = useNewsletterStats(id);

  // Fetch newsletter data with auto-refresh every 10 seconds for sent newsletters
  const { data: newsletterData, isLoading } = useQuery<{ newsletter: NewsletterWithUser }>({
    queryKey: ['/api/newsletters', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/newsletters/${id}`);
      return response.json();
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.newsletter?.status;
      // Auto-refresh every 5 seconds while sending, every 10 seconds when sent
      if (status === 'sending') return 5000;
      if (status === 'sent') return 10000;
      return false;
    },
  });

  const newsletter = (newsletterData as { newsletter: NewsletterWithUser & { opens?: number; totalOpens?: number } } | undefined)?.newsletter;

  const sendNowMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      const response = await apiRequest('POST', `/api/newsletters/${newsletterId}/send`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: "Newsletter Sent",
        description: data.message || "Newsletter is now being sent to recipients.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send newsletter",
        variant: "destructive",
      });
    },
  });

  // Approve newsletter mutation (with code verification)
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes, approvalCode }: { id: string; notes?: string; approvalCode: string }) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/approve`, { notes, approvalCode });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: "Newsletter Approved",
        description: data.message || "The newsletter has been approved and is ready to send.",
      });
    },
    onError: (error: any) => {
      setApprovalCodeError(error.message || "Invalid approval code");
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve newsletter",
        variant: "destructive",
      });
    },
  });

  // Approve & Send mutation (one-step from email link)
  const approveAndSendMutation = useMutation({
    mutationFn: async ({ id, approvalCode }: { id: string; approvalCode: string }) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/approve-and-send`, { approvalCode });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      setApprovalCodeError("");
      // After approval, auto-trigger the send
      if (data.sendReady && id) {
        sendNowMutation.mutate(id);
      }
      toast({
        title: "Newsletter Approved & Sending",
        description: "The newsletter has been approved and is now being sent.",
      });
    },
    onError: (error: any) => {
      setApprovalCodeError(error.message || "Invalid approval code");
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve newsletter",
        variant: "destructive",
      });
    },
  });

  // Reject newsletter mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/reject`, { notes });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      setShowRejectDialog(false);
      setRejectNotes("");
      toast({
        title: "Newsletter Rejected",
        description: data.message || "The newsletter has been returned to draft with your feedback.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject newsletter",
        variant: "destructive",
      });
    },
  });

  // Submit for review mutation
  const submitForReviewMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      const response = await apiRequest('POST', `/api/newsletters/${newsletterId}/submit-for-review`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: "Submitted for Review",
        description: data.message || "Newsletter has been submitted for reviewer approval.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit newsletter for review",
        variant: "destructive"
      });
    },
  });

  // Fetch reviewer settings
  const { data: reviewerSettings } = useQuery<{ enabled: boolean; reviewerId: string | null; reviewer: any }>({
    queryKey: ['/api/newsletters/reviewer-settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletters/reviewer-settings');
      return response.json();
    },
  });

  const reviewerEnabled = reviewerSettings?.enabled ?? false;

  const { data: recipientsData, isLoading: recipientsLoading } = useQuery<{ recipients: Array<{ id: string; email: string; firstName: string; lastName: string; status: string }>; total: number }>({
    queryKey: ['/api/newsletters', id, 'recipients'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/newsletters/${id}/recipients`);
      return response.json();
    },
    enabled: !!id && showRecipientsModal,
  });

  const recipientsList = recipientsData?.recipients || [];
  const filteredRecipients = recipientsList.filter((r) =>
    r.email.toLowerCase().includes(recipientSearch.toLowerCase()) ||
    `${r.firstName} ${r.lastName}`.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  // Fetch task status data
  const { data: taskStatusData, isLoading: isTaskStatusLoading } = useQuery<{ taskStatuses: NewsletterTaskStatus[] }>({
    queryKey: ['/api/newsletters', id, 'task-status'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/newsletters/${id}/task-status`);
      return response.json();
    },
    enabled: !!id,
  });

  const { data: emailDesign } = useQuery<{
    companyName?: string;
    headerMode?: string;
    logoUrl?: string;
    logoSize?: string;
    logoAlignment?: string;
    bannerUrl?: string;
    showCompanyName?: string;
    primaryColor?: string;
    fontFamily?: string;
    headerText?: string;
    footerText?: string;
    socialLinks?: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string } | string;
  }>({
    queryKey: ["/api/master-email-design"],
    queryFn: async () => {
      const response = await fetch("/api/master-email-design", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch email design");
      return response.json();
    },
  });

  const parsedSocialLinks = useMemo(() => {
    const raw = emailDesign?.socialLinks;
    if (!raw) return undefined;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return undefined; }
    }
    return raw;
  }, [emailDesign]);

  const emailPreviewHtml = useMemo(() => {
    if (!newsletter?.content) return "";
    return wrapInEmailPreview(newsletter.content, {
      companyName: emailDesign?.companyName || "",
      headerMode: emailDesign?.headerMode,
      primaryColor: emailDesign?.primaryColor,
      logoUrl: emailDesign?.logoUrl,
      logoSize: emailDesign?.logoSize,
      logoAlignment: emailDesign?.logoAlignment,
      bannerUrl: emailDesign?.bannerUrl,
      showCompanyName: emailDesign?.showCompanyName,
      headerText: emailDesign?.headerText,
      footerText: emailDesign?.footerText,
      fontFamily: emailDesign?.fontFamily,
      socialLinks: parsedSocialLinks,
    });
  }, [newsletter?.content, emailDesign, parsedSocialLinks]);

  interface DetailedStatsData {
    newsletter: { id: string; title: string; status: string };
    totalEmails: number;
    emails: Array<{
      emailId: string;
      resendId?: string;
      recipient: string;
      status: string;
      opens: number;
      clicks: number;
      bounces: number;
      complaints: number;
      lastActivity?: string;
      events: Array<{ type: string; timestamp: string; data?: any }>;
    }>;
  }

  const { data: detailedStatsData, isLoading: isDetailedStatsLoading, error: detailedStatsError } = useQuery<DetailedStatsData>({
    queryKey: ["/api/newsletters", id, "detailed-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/newsletters/${id}/detailed-stats`);
      const data = await response.json();
      return data;
    },
    enabled: !!id && !!newsletter && newsletter.status === "sent",
    refetchInterval: 30000,
    retry: 3,
    retryDelay: 1000,
  });

  // Initialize tasks if they don't exist
  const initializeTasksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/initialize-tasks`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id, 'task-status'] });
    },
  });

  const openTrajectoryModal = (resendId: string) => {
    if (!detailedStatsData?.emails) {
      toast({
        title: "Error",
        description: "Email data not available. Please wait for the data to load.",
        variant: "destructive",
      });
      return;
    }

    // Find the email with matching resendId from detailed stats
    const emailData = detailedStatsData.emails.find(email => email.resendId === resendId);

    if (!emailData) {
      toast({
        title: "Error",
        description: "Email tracking data not found.",
        variant: "destructive",
      });
      return;
    }

    // Transform the detailed stats data into trajectory format
    const trajectory = {
      emailId: resendId,
      from: newsletter?.user?.email || 'Unknown',
      to: emailData.recipient,
      subject: newsletter?.subject || 'Unknown',
      status: emailData.status,
      createdAt: newsletter?.sentAt || newsletter?.createdAt,
      totalEvents: (emailData.events?.length || 0) + 1, // +1 for the sent event
      totalOpens: emailData.opens || 0,
      totalClicks: emailData.clicks || 0,
      events: [
        // Always include a sent event first
        {
          type: 'sent',
          timestamp: newsletter?.sentAt || newsletter?.createdAt,
          description: `Email sent to ${emailData.recipient}`,
          email: emailData.recipient,
          source: 'system'
        },
        // Add all tracked events from the database
        ...(emailData.events?.map((event: any, index: number) => ({
          type: event.type,
          timestamp: event.timestamp,
          description: getEventDescription(event.type, emailData.recipient, event.data),
          email: emailData.recipient,
          userAgent: event.data?.userAgent,
          ipAddress: event.data?.ipAddress,
          activityData: event.data,
          webhookData: event.webhookData,
          source: 'database'
        })) || [])
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      metadata: {
        recipient: emailData.recipient,
        opens: emailData.opens,
        clicks: emailData.clicks,
        bounces: emailData.bounces,
        complaints: emailData.complaints
      }
    };

    setSelectedTrajectory(trajectory);
    setTrajectoryModalOpen(true);
  };

  // Helper function to create descriptive event descriptions
  const getEventDescription = (type: string, email: string, data: any) => {
    switch (type) {
      case 'sent':
        return `Email sent to ${email}`;
      case 'delivered':
        return `Email delivered to ${email}`;
      case 'opened':
        let description = `Email opened by ${email}`;
        if (data?.userAgent) {
          const ua = data.userAgent;
          if (ua.includes('iPhone') || ua.includes('iPad')) {
            description += ' on iOS device';
          } else if (ua.includes('Android')) {
            description += ' on Android device';
          } else if (ua.includes('Windows')) {
            description += ' on Windows';
          } else if (ua.includes('Mac')) {
            description += ' on Mac';
          }
        }
        if (data?.ipAddress) {
          description += ` (IP: ${data.ipAddress})`;
        }
        return description;
      case 'clicked':
        let clickDesc = `Link clicked by ${email}`;
        if (data?.url) {
          clickDesc += ` - ${data.url}`;
        }
        return clickDesc;
      case 'bounced':
        return `Email bounced for ${email}`;
      case 'complained':
        return `Spam complaint from ${email}`;
      case 'suppressed':
        return `Email to ${email} was suppressed by the provider`;
      default:
        return `Email ${type} for ${email}`;
    }
  };

  const taskStatuses = taskStatusData?.taskStatuses || [];

  // Initialize tasks if no task statuses exist (only once per component mount)
  useEffect(() => {
    if (
      newsletter &&
      taskStatuses.length === 0 &&
      !isTaskStatusLoading &&
      !initializeTasksMutation.isPending &&
      !tasksInitializedRef.current
    ) {
      tasksInitializedRef.current = true;
      initializeTasksMutation.mutate();
    }
  }, [newsletter, taskStatuses.length, isTaskStatusLoading, initializeTasksMutation]);

  // Mock timeline events
  const mockTimelineEvents: TimelineEvent[] = [
    {
      id: '1',
      type: 'created' as const,
      title: 'Newsletter Created',
      description: `Created by ${newsletter?.user.firstName} ${newsletter?.user.lastName}`,
      timestamp: newsletter?.createdAt ? new Date(newsletter.createdAt) : new Date(),
      status: 'success' as const
    },
    ...(newsletter?.scheduledAt ? [{
      id: '2',
      type: 'scheduled' as const,
      title: 'Delivery Scheduled',
      description: `Scheduled for ${format(new Date(newsletter.scheduledAt), 'PPP p')}`,
      timestamp: newsletter.updatedAt ? new Date(newsletter.updatedAt) : new Date(),
      status: 'info' as const
    }] : []),
    ...(newsletter?.sentAt ? [{
      id: '3',
      type: 'sent' as const,
      title: 'Newsletter Sent',
      description: `Delivered to ${newsletter.recipientCount || 0} recipients`,
      timestamp: new Date(newsletter.sentAt),
      status: 'success' as const
    }] : []),
    ...((newsletter?.opens && newsletter.opens > 0) || (newsletter?.totalOpens && newsletter.totalOpens > 0) ? [{
      id: '4',
      type: 'opened' as const,
      title: 'Email Opens Detected',
      description: `${newsletter.opens || 0} unique opens, ${newsletter.totalOpens || 0} total opens`,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      status: 'success' as const
    }] : []),
    ...(newsletter?.clickCount && newsletter.clickCount > 0 ? [{
      id: '5',
      type: 'clicked' as const,
      title: 'Link Clicks Detected',
      description: `${newsletter.clickCount} total clicks recorded`,
      timestamp: new Date(Date.now() - Math.random() * 43200000),
      status: 'success' as const
    }] : [])
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Draft', variant: 'secondary' as const, icon: Edit },
      ready_to_send: { label: 'Ready to Send', variant: 'outline' as const, icon: Send, className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
      pending_review: { label: 'Pending Review', variant: 'outline' as const, icon: ShieldCheck, className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
      scheduled: { label: 'Scheduled', variant: 'outline' as const, icon: Clock },
      sending: { label: 'Sending', variant: 'outline' as const, icon: Send },
      sent: { label: 'Sent', variant: 'default' as const, icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;
    const extraClass = 'className' in config ? (config as any).className : '';
    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${extraClass}`}>
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        {config.label}
      </Badge>
    );
  };

  const getTaskStatusIcon = (status: NewsletterTaskStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" strokeWidth={1.5} />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" strokeWidth={1.5} />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" strokeWidth={1.5} />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />;
    }
  };

  const getTimelineIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return <Newspaper className="h-4 w-4" strokeWidth={1.5} />;
      case 'scheduled':
        return <Calendar className="h-4 w-4" strokeWidth={1.5} />;
      case 'sent':
        return <Send className="h-4 w-4" strokeWidth={1.5} />;
      case 'opened':
        return <Eye className="h-4 w-4" strokeWidth={1.5} />;
      case 'clicked':
        return <MousePointer className="h-4 w-4" strokeWidth={1.5} />;
      default:
        return <Activity className="h-4 w-4" strokeWidth={1.5} />;
    }
  };

  const getTimelineColor = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Helper functions for the new 3-step task status workflow
  const getTaskStepStatus = (stepKey: 'validation' | 'delivery' | 'analytics') => {
    if (!newsletter) return 'pending';

    switch (stepKey) {
      case 'validation':
        // Content validation completes once sending begins or newsletter is sent
        if (newsletter.status === 'sent' || newsletter.status === 'sending') return 'completed';
        if (newsletter.status === 'ready_to_send') return 'completed';
        if (newsletter.status === 'scheduled') return 'running';
        return 'pending';

      case 'delivery':
        // Email delivery is completed if newsletter is sent
        if (newsletter.status === 'sent') return 'completed';
        // Delivery is in progress if newsletter is currently sending
        if (newsletter.status === 'sending') return 'running';
        if (newsletter.status === 'ready_to_send') return 'pending';
        if (newsletter.status === 'scheduled') return 'pending';
        return 'pending';

      case 'analytics':
        if (!newsletter.sentAt) return 'pending';

        // Check if 24 hours have passed since sending
        const sentTime = new Date(newsletter.sentAt);
        const now = new Date();
        const hoursSinceSent = (now.getTime() - sentTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceSent >= 24) return 'completed';
        if (newsletter.status === 'sent' || newsletter.status === 'sending') return 'running';
        return 'pending';

      default:
        return 'pending';
    }
  };

  const getCurrentTaskStep = () => {
    if (!newsletter) return 1;

    if (newsletter.status === 'draft') return 1;
    if (newsletter.status === 'ready_to_send') return 1;
    if (newsletter.status === 'scheduled') return 1;
    if (newsletter.status === 'sending') return 2; // Delivery in progress
    if (newsletter.status === 'sent') {
      // Check analytics completion
      if (getTaskStepStatus('analytics') === 'completed') return 4; // All done
      return 3; // Analytics in progress
    }
    return 1;
  };

  const getAnalyticsTimeRemaining = () => {
    if (!newsletter?.sentAt) return 'N/A';

    const sentTime = new Date(newsletter.sentAt);
    const completionTime = new Date(sentTime.getTime() + (24 * 60 * 60 * 1000)); // 24 hours later
    const now = new Date();

    if (now >= completionTime) return 'Complete';

    const msRemaining = completionTime.getTime() - now.getTime();
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hoursRemaining > 0) {
      return `${hoursRemaining}h ${minutesRemaining}m`;
    } else {
      return `${minutesRemaining}m`;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="relative max-w-lg w-full">
          {/* Decorative background elements */}
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-purple-400/20 dark:from-blue-500/10 dark:to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-gradient-to-br from-orange-400/15 to-pink-400/15 dark:from-orange-500/8 dark:to-pink-500/8 rounded-full blur-3xl pointer-events-none" />

          {/* Main card */}
          <div className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/60 dark:border-gray-700/40 rounded-2xl shadow-xl overflow-hidden">
            {/* Top gradient accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

            <div className="p-8 sm:p-10 text-center">
              {/* Animated icon container */}
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-400/15 dark:to-purple-400/15 rounded-2xl rotate-6 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-850 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center">
                  <Newspaper className="h-9 w-9 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent mb-3">
                Newsletter Not Found
              </h2>

              {/* Description */}
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base leading-relaxed max-w-sm mx-auto mb-2">
                The newsletter you're looking for may have been deleted or doesn't exist.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mb-8">
                Please check the URL or head back to your newsletter dashboard.
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={() => navigate('/newsletter')}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 transition-all duration-300 px-6"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  Back to Newsletters
                </Button>
                <Button
                  onClick={() => navigate('/newsletters/create')}
                  variant="outline"
                  className="w-full sm:w-auto border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 px-6"
                >
                  <Edit className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  Create New
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use unique opens for engagement rate calculations (opens = unique opens from API)
  const uniqueOpenRate = (newsletter.recipientCount || 0) > 0
    ? (((newsletter.opens || 0) / (newsletter.recipientCount || 1)) * 100).toFixed(1)
    : '0';

  // Calculate click-through rate based on unique opens
  const clickThroughRate = (newsletter.opens || 0) > 0
    ? (((newsletter.clickCount || 0) / (newsletter.opens || 1)) * 100).toFixed(1)
    : '0';

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/newsletter')}
              className="shrink-0 mt-1"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {newsletter.title}
                </h1>
                {getStatusBadge(newsletter.status)}
              </div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">
                Subject: {newsletter.subject}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end shrink-0 pl-0 sm:pl-4">
            {newsletter.status === 'draft' && (
              <Button
                onClick={() => navigate(`/newsletters/${newsletter.id}/edit`)}
                variant="outline"
                size="sm"
                data-testid="button-edit"
              >
                <Edit className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Edit
              </Button>
            )}
            {reviewerEnabled && (newsletter.status === 'draft' || newsletter.status === 'ready_to_send') && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  submitForReviewMutation.mutate(newsletter.id);
                }}
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                disabled={submitForReviewMutation.isPending}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" strokeWidth={1.5} />
                {submitForReviewMutation.isPending ? "Submitting..." : "Submit for Review"}
              </Button>
            )}
            {newsletter.status === 'ready_to_send' && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  sendNowMutation.mutate(newsletter.id);
                }}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white border-green-700"
                disabled={sendNowMutation.isPending}
                data-testid="button-send-now"
              >
                <Send className="h-4 w-4 mr-2" strokeWidth={1.5} />
                {sendNowMutation.isPending ? "Sending..." : "Send Now"}
              </Button>
            )}
          </div>
        </div>

        {/* Reviewer Workflow Banner */}
        {newsletter.status === 'pending_review' && (
          <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 dark:border-orange-800/40 p-5 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100">Awaiting Reviewer Approval</h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                    This newsletter has been submitted for review. {(newsletter as any).reviewerId === currentUserId ? 'Enter the 5-digit approval code to approve and send.' : 'Waiting for the designated reviewer to approve or reject it.'}
                  </p>
                </div>
              </div>

              {/* Reviewer Actions - Only show to the assigned reviewer */}
              {(newsletter as any).reviewerId === currentUserId && (
                <div className="space-y-4">
                  {/* Approval Code Section */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {isReviewerFromEmail ? 'Approval Code (from email)' : 'Enter Approval Code'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="relative flex-1 max-w-xs">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={5}
                          value={approvalCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
                            setApprovalCode(val);
                            setApprovalCodeError('');
                          }}
                          placeholder="00000"
                          className={`pl-9 text-center text-xl font-bold tracking-[0.3em] font-mono h-12 border-2 ${approvalCodeError
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : approvalCode.length === 5
                              ? 'border-emerald-400 focus-visible:ring-emerald-400'
                              : 'border-amber-300 focus-visible:ring-amber-400'
                            }`}
                          data-testid="input-approval-code"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          if (approvalCode.length !== 5) {
                            setApprovalCodeError('Please enter a valid 5-digit code');
                            return;
                          }
                          approveAndSendMutation.mutate({ id: newsletter.id, approvalCode });
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6"
                        disabled={approvalCode.length !== 5 || approveAndSendMutation.isPending || approveMutation.isPending}
                        data-testid="button-approve-and-send"
                      >
                        {approveAndSendMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Approving...</>
                        ) : (
                          <><Send className="h-4 w-4 mr-2" strokeWidth={1.5} /> Approve & Send</>
                        )}
                      </Button>
                    </div>
                    {approvalCodeError && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {approvalCodeError}
                      </p>
                    )}
                    {!isReviewerFromEmail && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                        Check your email for the 5-digit code that was sent when this newsletter was submitted for review.
                      </p>
                    )}
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => {
                        if (approvalCode.length !== 5) {
                          setApprovalCodeError('Please enter a valid 5-digit code');
                          return;
                        }
                        approveMutation.mutate({ id: newsletter.id, approvalCode });
                      }}
                      size="sm"
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                      disabled={approvalCode.length !== 5 || approveMutation.isPending}
                      data-testid="button-approve-only"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      {approveMutation.isPending ? 'Approving...' : 'Approve Only'}
                    </Button>
                    <Button
                      onClick={() => setShowRejectDialog(true)}
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                      disabled={rejectMutation.isPending}
                      data-testid="button-reject"
                    >
                      <XCircle className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Review status info (for approved/rejected newsletters) */}
        {(newsletter as any).reviewStatus === 'approved' && (newsletter as any).reviewedAt && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/40 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Approved by reviewer</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {format(new Date((newsletter as any).reviewedAt), 'PPP p')}
                  {(newsletter as any).reviewNotes && ` — "${(newsletter as any).reviewNotes}"`}
                </p>
              </div>
            </div>
          </div>
        )}

        {(newsletter as any).reviewStatus === 'rejected' && (newsletter as any).reviewedAt && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/40 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-100">Rejected by reviewer</p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  {format(new Date((newsletter as any).reviewedAt), 'PPP p')}
                </p>
                {(newsletter as any).reviewNotes && (
                  <div className="mt-2 p-2 rounded-md bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-800 dark:text-red-200 italic">"{(newsletter as any).reviewNotes}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Recipients
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold" data-testid="text-recipients-count">
                    {(newsletter.recipientCount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total sent to
                  </p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="text-white w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Unique Opens
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold" data-testid="text-opens-count">
                    {newsletter.opens || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {uniqueOpenRate}% unique rate
                  </p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shrink-0">
                  <Eye className="text-white w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Clicks
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold" data-testid="text-clicks-count">
                    {newsletter.clickCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {clickThroughRate}% CTR
                  </p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <MousePointer className="text-white w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Delivery Issues
                </p>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="text-white w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold" data-testid="text-bounces-count">
                    {liveStats?.bounced ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Bounced</p>
                </div>
                <div>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold" data-testid="text-suppressed-count">
                    {liveStats?.suppressed ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Suppressed</p>
                </div>
                <div>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold" data-testid="text-complaints-count">
                    {liveStats?.complained ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Complaints</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 lg:space-y-8">
          <div className="overflow-x-auto">
            <TabsList className="grid w-full grid-cols-5 min-w-max">
              <TabsTrigger value="overview" className="text-xs sm:text-sm" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="live-tracking" className="text-xs sm:text-sm" data-testid="tab-live-tracking">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </TabsTrigger>
              <TabsTrigger value="content" className="text-xs sm:text-sm" data-testid="tab-content">Content</TabsTrigger>
              <TabsTrigger value="status" className="text-xs sm:text-sm" data-testid="tab-status">Task Status</TabsTrigger>
              <TabsTrigger value="detailed-stats" className="text-xs sm:text-sm" data-testid="tab-detailed-stats">Detailed Stats</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="live-tracking" className="space-y-6 lg:space-y-8">
            <LiveTrackingPanel newsletterId={newsletter.id} />
          </TabsContent>

          <TabsContent value="overview" className="space-y-6 lg:space-y-8">
            <div className="grid gap-4 lg:gap-6 md:grid-cols-2">
              {/* Newsletter Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5" />
                    Newsletter Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Created</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {format(new Date(newsletter.createdAt || ''), 'PPP p')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Updated</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {format(new Date(newsletter.updatedAt || ''), 'PPP p')}
                      </p>
                    </div>
                    {newsletter.scheduledAt && (
                      <>
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scheduled</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {format(new Date(newsletter.scheduledAt), 'PPP p')}
                          </p>
                        </div>
                      </>
                    )}
                    {newsletter.sentAt && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sent</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {format(new Date(newsletter.sentAt), 'PPP p')}
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Author</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {newsletter.user.firstName} {newsletter.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {newsletter.user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Targeting</p>
                    <div className="space-y-2">
                      <Badge variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {newsletter.recipientType === 'all' ? 'All Contacts' :
                          newsletter.recipientType === 'selected' ? 'Selected Contacts' : 'Tagged Contacts'}
                      </Badge>
                      {newsletter.selectedContactIds?.length ? (
                        <p className="text-xs text-gray-500">
                          {newsletter.selectedContactIds.length} specific contacts
                        </p>
                      ) : null}
                      {newsletter.selectedTagIds?.length ? (
                        <p className="text-xs text-gray-500">
                          {newsletter.selectedTagIds.length} tag groups
                        </p>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRecipientsModal(true)}
                        data-testid="button-view-recipients"
                      >
                        <Users className="h-4 w-4 mr-1.5" />
                        View Recipients
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Activity Timeline
                  </CardTitle>
                  <CardDescription>
                    Recent events and status changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockTimelineEvents.map((event, index) => {
                      const Icon = getTimelineIcon(event.type);
                      return (
                        <div key={event.id} className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full ${getTimelineColor(event.status)} flex items-center justify-center text-white`}>
                            {Icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {event.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                              </p>
                            </div>
                            {event.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" strokeWidth={1.5} />
                      Email Preview
                    </CardTitle>
                    <CardDescription>
                      How this newsletter appears in your recipients' inbox
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Mail className="h-3 w-3" strokeWidth={1.5} />
                      {newsletter.subject}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-muted/30 p-3 sm:p-6 lg:p-8">
                  <div className="mx-auto max-w-[640px]">
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span>From: {newsletter.user?.email || "your-company"}</span>
                      <span className="mx-1">|</span>
                      <span>Subject: {newsletter.subject}</span>
                    </div>
                    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                      <iframe
                        ref={iframeRef}
                        srcDoc={emailPreviewHtml}
                        title="Email preview"
                        className="w-full border-0"
                        style={{ minHeight: "600px" }}
                        sandbox="allow-same-origin"
                        onLoad={() => {
                          const iframe = iframeRef.current;
                          if (iframe?.contentDocument?.body) {
                            const height = iframe.contentDocument.body.scrollHeight;
                            iframe.style.height = `${Math.max(height + 20, 600)}px`;
                          }
                        }}
                        data-testid="iframe-email-preview"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Newsletter Processing Status
                </CardTitle>
                <CardDescription>
                  Track the progress of your newsletter through the delivery pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Progress Steps Indicator */}
                <div className="mb-8">
                  <div className="flex items-center justify-between">
                    {([
                      { step: 1, title: 'Content Validation', key: 'validation' as const, icon: CheckCircle, description: 'Validating content and checking for issues' },
                      { step: 2, title: 'Email Delivery', key: 'delivery' as const, icon: Send, description: 'Sending emails to recipients' },
                      { step: 3, title: 'Analytics Collection', key: 'analytics' as const, icon: BarChart3, description: 'Collecting engagement data (completed 24hrs after start)' }
                    ] as const).map((item, index) => {
                      const isCompleted = getTaskStepStatus(item.key) === 'completed';
                      const isActive = getTaskStepStatus(item.key) === 'running';
                      const isPending = getTaskStepStatus(item.key) === 'pending';
                      const Icon = item.icon;

                      return (
                        <div key={item.key} className="flex items-center">
                          {index > 0 && (
                            <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700 mr-4">
                              <div
                                className={`h-full transition-all duration-300 ${isCompleted || getCurrentTaskStep() > item.step ? 'bg-green-500 w-full' : 'bg-transparent w-0'
                                  }`}
                              />
                            </div>
                          )}
                          <div className="flex flex-col items-center text-center min-w-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-colors mb-2 ${isCompleted
                              ? 'bg-green-500 text-white'
                              : isActive
                                ? 'bg-blue-500 text-white'
                                : isPending
                                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                              }`}>
                              {isCompleted ? (
                                <CheckCircle className="w-6 h-6" strokeWidth={1.5} />
                              ) : isActive ? (
                                <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                              ) : (
                                <Icon className="w-5 h-5" strokeWidth={1.5} />
                              )}
                            </div>
                            <div className="max-w-[120px]">
                              <p className={`text-sm font-medium mb-1 ${isActive
                                ? 'text-gray-900 dark:text-gray-100'
                                : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                {item.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 leading-tight">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Status Cards */}
                <div className="space-y-4">
                  {/* Content Validation */}
                  <div className="border rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getTaskStepStatus('validation') === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : getTaskStepStatus('validation') === 'running' ? (
                          <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Content Validation
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Checking content quality, links, and compliance
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        getTaskStepStatus('validation') === 'completed' ? 'default' :
                          getTaskStepStatus('validation') === 'running' ? 'secondary' : 'outline'
                      }>
                        {getTaskStepStatus('validation') === 'completed' ? 'Completed' :
                          getTaskStepStatus('validation') === 'running' ? 'In Progress' : 'Pending'}
                      </Badge>
                    </div>
                    {getTaskStepStatus('validation') === 'running' && (
                      <Progress value={75} className="h-2" />
                    )}
                  </div>

                  {/* Email Delivery */}
                  <div className="border rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getTaskStepStatus('delivery') === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : getTaskStepStatus('delivery') === 'running' ? (
                          <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Email Delivery
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Sending newsletter to {newsletter.recipientCount || 0} recipients
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        getTaskStepStatus('delivery') === 'completed' ? 'default' :
                          getTaskStepStatus('delivery') === 'running' ? 'secondary' : 'outline'
                      }>
                        {getTaskStepStatus('delivery') === 'completed' ? 'Completed' :
                          getTaskStepStatus('delivery') === 'running' ? 'In Progress' : 'Pending'}
                      </Badge>
                    </div>
                    {getTaskStepStatus('delivery') === 'running' && (
                      <Progress value={45} className="h-2" />
                    )}
                  </div>

                  {/* Analytics Collection */}
                  <div className="border rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getTaskStepStatus('analytics') === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : getTaskStepStatus('analytics') === 'running' ? (
                          <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Analytics Collection
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Gathering engagement data - completes 24 hours after sending
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        getTaskStepStatus('analytics') === 'completed' ? 'default' :
                          getTaskStepStatus('analytics') === 'running' ? 'secondary' : 'outline'
                      }>
                        {getTaskStepStatus('analytics') === 'completed' ? 'Completed' :
                          getTaskStepStatus('analytics') === 'running' ? 'Collecting Data' : 'Pending'}
                      </Badge>
                    </div>
                    {getTaskStepStatus('analytics') === 'running' && (
                      <div className="space-y-2">
                        <Progress value={65} className="h-2" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {newsletter.sentAt && `Time remaining: ${getAnalyticsTimeRemaining()}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed-stats" className="space-y-6 lg:space-y-8">
            {/* Analytics Collection Status Banner */}
            {newsletter?.status === 'sent' && getTaskStepStatus('analytics') === 'running' && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                    <RefreshCw className="w-5 h-5 text-white animate-spin" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">Analytics Collection In Progress</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
                      Engagement data is being gathered for 24 hours after sending. Stats below will continue to update in real-time.
                    </p>
                    {newsletter.sentAt && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 bg-blue-200/50 dark:bg-blue-800/30 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, ((Date.now() - new Date(newsletter.sentAt).getTime()) / (24 * 60 * 60 * 1000)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap">
                          {getAnalyticsTimeRemaining()} remaining
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {newsletter?.status === 'sent' && getTaskStepStatus('analytics') === 'completed' && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-emerald-950/40 p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 shadow-md">
                    <CheckCircle className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Analytics Collection Complete</h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                      All engagement data has been gathered. The statistics below reflect the final results.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Aggregate Engagement Metrics */}
            {newsletter?.status === 'sent' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center mx-auto mb-2">
                      <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{liveStats?.delivered ?? 0}</p>
                    <p className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80 mt-0.5">Delivered</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-green-950/40 dark:to-emerald-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-green-500/10 dark:bg-green-400/10 flex items-center justify-center mx-auto mb-2">
                      <Eye className="h-4 w-4 text-green-600 dark:text-green-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{newsletter.opens || 0}</p>
                    <p className="text-xs font-medium text-green-600/80 dark:text-green-400/80 mt-0.5">Unique Opens</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-violet-100/50 dark:from-purple-950/40 dark:to-violet-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center mx-auto mb-2">
                      <MousePointer className="h-4 w-4 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{newsletter.clickCount || 0}</p>
                    <p className="text-xs font-medium text-purple-600/80 dark:text-purple-400/80 mt-0.5">Clicks</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-100/50 dark:from-red-950/40 dark:to-rose-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 dark:bg-red-400/10 flex items-center justify-center mx-auto mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">{liveStats?.bounced ?? 0}</p>
                    <p className="text-xs font-medium text-red-600/80 dark:text-red-400/80 mt-0.5">Bounced</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-100/50 dark:from-orange-950/40 dark:to-amber-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/10 dark:bg-orange-400/10 flex items-center justify-center mx-auto mb-2">
                      <ShieldOff className="h-4 w-4 text-orange-600 dark:text-orange-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{liveStats?.complained ?? 0}</p>
                    <p className="text-xs font-medium text-orange-600/80 dark:text-orange-400/80 mt-0.5">Complaints</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-yellow-50 to-amber-100/50 dark:from-yellow-950/40 dark:to-amber-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-yellow-500/10 dark:bg-yellow-400/10 flex items-center justify-center mx-auto mb-2">
                      <XCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{liveStats?.suppressed ?? 0}</p>
                    <p className="text-xs font-medium text-yellow-600/80 dark:text-yellow-400/80 mt-0.5">Suppressed</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Engagement Rates & Insights */}
            {newsletter?.status === 'sent' && (
              <div className="grid gap-4 lg:gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5 text-indigo-500" strokeWidth={1.5} />
                      Engagement Rates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Open Rate */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-green-500" strokeWidth={1.5} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Unique Open Rate</span>
                        </div>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">{uniqueOpenRate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, parseFloat(uniqueOpenRate))}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{newsletter.opens || 0} unique / {newsletter.recipientCount || 0} sent</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">({(newsletter as any).totalOpens || 0} total opens)</span>
                      </div>
                    </div>

                    {/* Click-through Rate */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MousePointer className="h-4 w-4 text-purple-500" strokeWidth={1.5} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Click-through Rate</span>
                        </div>
                        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{clickThroughRate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-400 to-violet-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, parseFloat(clickThroughRate))}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{newsletter.clickCount || 0} clicks / {newsletter.opens || 0} unique opens</span>
                      </div>
                    </div>

                    {/* Delivery Rate */}
                    {(() => {
                      const deliveryRate = (newsletter.recipientCount || 0) > 0
                        ? (((liveStats?.delivered ?? 0) / (newsletter.recipientCount || 1)) * 100).toFixed(1)
                        : '0';
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Send className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery Rate</span>
                            </div>
                            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{deliveryRate}%</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(100, parseFloat(deliveryRate))}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{liveStats?.delivered ?? 0} delivered / {newsletter.recipientCount || 0} sent</span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
                      Performance Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {parseFloat(uniqueOpenRate) > 25 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-xl">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">Excellent Engagement</p>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                            Your {uniqueOpenRate}% unique open rate is above the industry average of ~21%.
                          </p>
                        </div>
                      </div>
                    )}

                    {parseFloat(uniqueOpenRate) <= 25 && parseFloat(uniqueOpenRate) > 0 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Average Engagement</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            Your {uniqueOpenRate}% open rate can be improved. Try more compelling subject lines.
                          </p>
                        </div>
                      </div>
                    )}

                    {(newsletter.opens === 0 || !newsletter.opens) && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 border border-gray-200 dark:border-gray-700/50 rounded-xl">
                        <Clock className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Awaiting Opens</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            No unique opens recorded yet. Opens usually trickle in over 24-48 hours.
                          </p>
                        </div>
                      </div>
                    )}

                    {parseFloat(clickThroughRate) > 3 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl">
                        <MousePointer className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">Great Click Rate</p>
                          <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                            Your {clickThroughRate}% CTR shows strong content relevance.
                          </p>
                        </div>
                      </div>
                    )}

                    {(liveStats?.bounced ?? 0) > 0 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-red-800 dark:text-red-200">Bounces Detected</p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                            {liveStats?.bounced} email(s) bounced. Consider cleaning your contact list.
                          </p>
                        </div>
                      </div>
                    )}

                    {(liveStats?.bounced ?? 0) === 0 && (newsletter.opens || 0) > 0 && parseFloat(clickThroughRate) <= 3 && parseFloat(uniqueOpenRate) > 25 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl">
                        <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Healthy Delivery</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                            Zero bounces with good opens. Your sender reputation is in great shape.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Per-Recipient Stats Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" strokeWidth={1.5} />
                  Per-Recipient Email Activity
                </CardTitle>
                <CardDescription>
                  Individual delivery status and engagement activity for each recipient
                </CardDescription>
              </CardHeader>
              <CardContent>
                {newsletter?.status !== 'sent' ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-8 w-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Newsletter Not Sent Yet
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      Per-recipient statistics will appear here after the newsletter is sent. You'll see individual open, click, bounce, and complaint data for each email.
                    </p>
                  </div>
                ) : isDetailedStatsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 border rounded-xl">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-3 w-[180px]" />
                        </div>
                        <Skeleton className="h-7 w-20 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : detailedStatsData?.emails?.length ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {detailedStatsData.emails.length} of {detailedStatsData.totalEmails} recipients
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Activity counts include repeat opens and clicks per recipient
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="shrink-0">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                        Refresh
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {detailedStatsData.emails.map((email, index) => {
                        const getStatusColor = (status: string) => {
                          switch (status) {
                            case 'clicked': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
                            case 'opened': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
                            case 'bounced': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
                            case 'complained': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300';
                            case 'suppressed': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
                            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
                          }
                        };

                        const getStatusIcon = (status: string) => {
                          switch (status) {
                            case 'clicked': return <MousePointer className="h-3.5 w-3.5" strokeWidth={1.5} />;
                            case 'opened': return <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />;
                            case 'bounced': return <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />;
                            case 'complained': return <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.5} />;
                            case 'suppressed': return <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />;
                            default: return <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />;
                          }
                        };

                        return (
                          <div key={email.emailId || index} className="group border rounded-xl p-4 hover:border-blue-200 dark:hover:border-blue-800/50 hover:shadow-sm transition-all duration-200">
                            <div className="flex items-center gap-4">
                              {/* Avatar */}
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase">
                                  {email.recipient.charAt(0)}
                                </span>
                              </div>

                              {/* Email & Status */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {email.recipient}
                                  </p>
                                  <Badge className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${getStatusColor(email.status)}`}>
                                    {getStatusIcon(email.status)}
                                    {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {email.opens > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                      <Eye className="h-3 w-3" strokeWidth={1.5} />
                                      {email.opens} {email.opens === 1 ? 'open' : 'opens'}
                                    </span>
                                  )}
                                  {email.clicks > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                                      <MousePointer className="h-3 w-3" strokeWidth={1.5} />
                                      {email.clicks} {email.clicks === 1 ? 'click' : 'clicks'}
                                    </span>
                                  )}
                                  {email.lastActivity && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {formatDistanceToNow(new Date(email.lastActivity + 'Z'), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <EmailActivityTimelineModal
                                  contactEmail={email.recipient}
                                  trigger={
                                    <Button variant="ghost" size="sm" title="View Email Activity Timeline" className="h-8 w-8 p-0">
                                      <History className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    </Button>
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={async () => {
                                    try {
                                      const response = await apiRequest('GET', `/api/email-contacts?search=${encodeURIComponent(email.recipient)}&limit=1`);
                                      const data = await response.json();
                                      if (data.contacts && data.contacts.length > 0) {
                                        navigate(`/email-contacts/view/${data.contacts[0].id}`);
                                      } else {
                                        toast({ title: "Contact Not Found", description: "This email was not found in your contacts.", variant: "destructive" });
                                      }
                                    } catch {
                                      toast({ title: "Error", description: "Failed to find contact.", variant: "destructive" });
                                    }
                                  }}
                                  title="View Contact Profile Page"
                                >
                                  <User className="h-3.5 w-3.5" strokeWidth={1.5} />
                                </Button>
                                {email.resendId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => window.open(`https://resend.com/emails/${email.resendId}`, '_blank')}
                                    title="View in Resend Dashboard"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mx-auto mb-4">
                      <Activity className="h-8 w-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      No Email Data Available Yet
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      Email tracking data is being collected. This typically takes a few minutes after sending begins.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Email Trajectory Modal */}
        <Dialog open={trajectoryModalOpen} onOpenChange={setTrajectoryModalOpen}>
          <DialogContent className="w-[95vw] max-w-2xl h-[85vh] sm:h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" strokeWidth={1.5} />
                Email Trajectory History
                {selectedTrajectory && selectedTrajectory.totalEvents > 1 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedTrajectory.totalEvents} Events
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Complete tracking timeline showing every interaction with this specific email
              </DialogDescription>
            </DialogHeader>

            {selectedTrajectory && (
              <div className="space-y-6">
                {/* Email Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Email Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">From</p>
                        <p className="text-sm">{selectedTrajectory.from}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">To</p>
                        <p className="text-sm">{selectedTrajectory.to}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Subject</p>
                        <p className="text-sm">{selectedTrajectory.subject}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
                        <Badge className="mt-1">
                          {selectedTrajectory.status || 'Unknown'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Created At</p>
                        <p className="text-sm">
                          {selectedTrajectory.createdAt ?
                            format(new Date(selectedTrajectory.createdAt), 'PPP p') :
                            'Unknown'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Engagement Summary */}
                {selectedTrajectory.totalEvents > 1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Engagement Summary</CardTitle>
                      <CardDescription>
                        Quick overview of recipient engagement with this email
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full mx-auto mb-2">
                            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedTrajectory.totalEvents}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">Total Events</p>
                        </div>

                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full mx-auto mb-2">
                            <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{selectedTrajectory.totalOpens || 0}</p>
                          <p className="text-sm text-purple-600 dark:text-purple-400">Opens</p>
                        </div>

                        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="flex items-center justify-center w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full mx-auto mb-2">
                            <MousePointer className="h-4 w-4 text-orange-600 dark:text-orange-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{selectedTrajectory.totalClicks || 0}</p>
                          <p className="text-sm text-orange-600 dark:text-orange-400">Clicks</p>
                        </div>

                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full mx-auto mb-2">
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {selectedTrajectory.totalOpens > 0 ?
                              Math.round((selectedTrajectory.totalClicks / selectedTrajectory.totalOpens) * 100) :
                              0
                            }%
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-400">Click Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Event Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Event Timeline</span>
                      <div className="flex gap-2 text-sm">
                        {selectedTrajectory.totalOpens > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            <Eye className="h-3 w-3" strokeWidth={1.5} />
                            {selectedTrajectory.totalOpens} {selectedTrajectory.totalOpens === 1 ? 'Open' : 'Opens'}
                          </Badge>
                        )}
                        {selectedTrajectory.totalClicks > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            <MousePointer className="h-3 w-3" strokeWidth={1.5} />
                            {selectedTrajectory.totalClicks} {selectedTrajectory.totalClicks === 1 ? 'Click' : 'Clicks'}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Detailed chronological events showing each interaction with this email
                      {selectedTrajectory.totalOpens > 1 && (
                        <span className="text-purple-600 dark:text-purple-400 ml-1">
                          • {selectedTrajectory.totalOpens} individual open events tracked
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedTrajectory.events && selectedTrajectory.events.length > 0 ? (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {selectedTrajectory.events.map((event: any, index: number) => (
                          <div key={`${event.type}-${index}`} className="flex items-start gap-3 pb-4 border-b last:border-b-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${event.type === 'sent' ? 'bg-blue-100 dark:bg-blue-900' :
                              event.type === 'delivered' ? 'bg-green-100 dark:bg-green-900' :
                                event.type === 'opened' ? 'bg-purple-100 dark:bg-purple-900' :
                                  event.type === 'clicked' ? 'bg-orange-100 dark:bg-orange-900' :
                                    event.type === 'bounced' ? 'bg-red-100 dark:bg-red-900' :
                                      event.type === 'complained' ? 'bg-yellow-100 dark:bg-yellow-900' :
                                        event.type === 'suppressed' ? 'bg-yellow-100 dark:bg-yellow-900' :
                                          'bg-gray-100 dark:bg-gray-800'
                              }`}>
                              {event.type === 'sent' && <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                              {event.type === 'delivered' && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
                              {event.type === 'opened' && <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                              {event.type === 'clicked' && <MousePointer className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
                              {event.type === 'bounced' && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                              {event.type === 'complained' && <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
                              {event.type === 'suppressed' && <ShieldOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
                              {!['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'suppressed'].includes(event.type) &&
                                <Activity className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                                      {event.type.replace('_', ' ')}
                                    </p>
                                    {event.source === 'database' && (
                                      <Badge variant="outline" className="text-xs">
                                        Tracked
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                                    {event.description}
                                  </p>

                                  {/* Additional technical details for opens and clicks */}
                                  {(event.type === 'opened' || event.type === 'clicked') && (event.userAgent || event.ipAddress) && (
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                      {event.ipAddress && (
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium">IP:</span>
                                          <span className="font-mono">{event.ipAddress}</span>
                                        </div>
                                      )}
                                      {event.userAgent && (
                                        <div className="flex items-start gap-1">
                                          <span className="font-medium flex-shrink-0">Device:</span>
                                          <span className="break-all text-xs">{event.userAgent}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Click URL details */}
                                  {event.type === 'clicked' && event.activityData?.url && (
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                      <div className="flex items-start gap-1">
                                        <span className="font-medium flex-shrink-0">URL:</span>
                                        <span className="break-all text-blue-600 dark:text-blue-400">{event.activityData.url}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-shrink-0 text-right ml-4">
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {event.timestamp ?
                                      formatDistanceToNow(new Date(event.timestamp + 'Z'), { addSuffix: true }) :
                                      'Unknown time'
                                    }
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">
                                    {event.timestamp ?
                                      format(new Date(event.timestamp + 'Z'), 'MMM d, h:mm a') :
                                      ''
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No event timeline available
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Additional Metadata */}
                {selectedTrajectory.metadata && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {selectedTrajectory.metadata.reply_to && (
                          <div>
                            <p className="font-medium text-gray-600 dark:text-gray-400">Reply To</p>
                            <p>{selectedTrajectory.metadata.reply_to}</p>
                          </div>
                        )}
                        {selectedTrajectory.metadata.cc && (
                          <div>
                            <p className="font-medium text-gray-600 dark:text-gray-400">CC</p>
                            <p>{Array.isArray(selectedTrajectory.metadata.cc) ?
                              selectedTrajectory.metadata.cc.join(', ') :
                              selectedTrajectory.metadata.cc}
                            </p>
                          </div>
                        )}
                        {selectedTrajectory.metadata.bcc && (
                          <div>
                            <p className="font-medium text-gray-600 dark:text-gray-400">BCC</p>
                            <p>{Array.isArray(selectedTrajectory.metadata.bcc) ?
                              selectedTrajectory.metadata.bcc.join(', ') :
                              selectedTrajectory.metadata.bcc}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-600 dark:text-gray-400">Email ID</p>
                          <p className="font-mono text-xs">{selectedTrajectory.emailId}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showRecipientsModal} onOpenChange={(open) => { setShowRecipientsModal(open); if (!open) setRecipientSearch(""); }}>
          <DialogContent
            className="max-w-lg p-6"
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
              overflow: 'visible',
            }}
          >
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" strokeWidth={1.5} />
                Recipients
                {recipientsData && (
                  <Badge variant="secondary" className="ml-1">
                    {recipientsData.total}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {newsletter?.recipientType === 'all' ? 'All active contacts' :
                  newsletter?.recipientType === 'selected' ? 'Individually selected contacts' : 'Contacts matching selected tags'}
              </DialogDescription>
            </DialogHeader>

            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search recipients..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-recipients"
              />
            </div>

            {recipientSearch && (
              <p className="text-xs text-muted-foreground flex-shrink-0">
                {filteredRecipients.length} of {recipientsList.length} shown
              </p>
            )}

            <div style={{ flex: 1, minHeight: 0, maxHeight: '400px', overflowY: 'auto' }} className="rounded-lg border">
              {recipientsLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {recipientSearch ? "No recipients match your search" : "No recipients found"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center gap-3 px-4 py-3"
                      data-testid={`recipient-row-${recipient.id}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {(recipient.firstName?.[0] || recipient.email[0] || '').toUpperCase()}
                        {(recipient.lastName?.[0] || '').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {(recipient.firstName || recipient.lastName) ? (
                          <>
                            <p className="text-sm font-medium text-foreground truncate">
                              {recipient.firstName} {recipient.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-foreground truncate">{recipient.email}</p>
                        )}
                      </div>
                      {recipient.status && recipient.status !== 'active' && (
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${recipient.status === 'suppressed' ? 'border-orange-500 text-orange-600' :
                            recipient.status === 'bounced' ? 'border-red-500 text-red-600' :
                              recipient.status === 'unsubscribed' ? 'border-gray-500 text-gray-600' :
                                'border-muted-foreground text-muted-foreground'
                            }`}
                        >
                          {recipient.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {/* Reject Newsletter Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(false); setRejectNotes(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Reject Newsletter
              </DialogTitle>
              <DialogDescription>
                Please provide feedback explaining why this newsletter is being rejected. The creator will see your notes and can make adjustments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Rejection Notes <span className="text-red-500">*</span></label>
                <Textarea
                  placeholder="Explain what needs to change before this newsletter can be approved..."
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectNotes(""); }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => rejectMutation.mutate({ id: newsletter.id, notes: rejectNotes })}
                  disabled={!rejectNotes.trim() || rejectMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Reject Newsletter"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
