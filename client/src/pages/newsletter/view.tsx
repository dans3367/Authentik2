import { useLanguage } from "@/hooks/useLanguage";
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
  Hash,
  Smile,
  ThumbsUp,
  ThumbsDown,
  Undo2,
  Info
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
import { usePermissions } from "@/hooks/usePermissions";
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
import { ReactionInsightsSection } from "@/components/newsletter/ReactionInsightsSection";
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
  const { t } = useLanguage();
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
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('newsletters.create');
  const canSend = hasPermission('newsletters.send');

  // Reviewer workflow state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [approvalCodeError, setApprovalCodeError] = useState("");

  // Detect if reviewer arrived via email link
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isReviewerFromEmail = urlParams.get('reviewer') === 'true';

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

  // {t("newsletter.view.approveSend", "Approve & Send")} mutation (one-step from email link)
  const approveAndSendMutation = useMutation({
    mutationFn: async ({ id, approvalCode }: { id: string; approvalCode: string }) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/approve-and-send`, { approvalCode });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      setApprovalCodeError("");
      setApprovalCode("");
      toast({
        title: "Newsletter Approved & Sending",
        description: data.sendMessage || "The newsletter has been approved and is now being sent.",
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

  // Recall from review mutation
  const recallReviewMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      const response = await apiRequest('POST', `/api/newsletters/${newsletterId}/recall-review`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: "Recalled to Draft",
        description: data.message || "Newsletter has been recalled from review and returned to draft.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Recall Failed",
        description: error.message || "Failed to recall newsletter from review",
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
  const isCurrentUserDesignatedReviewer = reviewerSettings?.reviewerId === currentUserId;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsletter, taskStatuses.length, isTaskStatusLoading]);

  // Mock timeline events
  const mockTimelineEvents: TimelineEvent[] = [
    {
      id: '1',
      type: 'created' as const,
      title: 'Newsletter Created',
      description: `Created by ${newsletter?.user?.firstName || ''} ${newsletter?.user?.lastName || ''}`.trim() || 'Unknown',
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
      timestamp: newsletter?.sentAt ? new Date(new Date(newsletter.sentAt).getTime() + 3600000) : new Date(),
      status: 'success' as const
    }] : []),
    ...(newsletter?.clickCount && newsletter.clickCount > 0 ? [{
      id: '5',
      type: 'clicked' as const,
      title: 'Link Clicks Detected',
      description: `${newsletter.clickCount} total clicks recorded`,
      timestamp: newsletter?.sentAt ? new Date(new Date(newsletter.sentAt).getTime() + 7200000) : new Date(),
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
        return Newspaper;
      case 'scheduled':
        return Calendar;
      case 'sent':
        return Send;
      case 'opened':
        return Eye;
      case 'clicked':
        return MousePointer;
      default:
        return Activity;
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
                {t("newsletter.view.newsletterNotFound", "Newsletter Not Found")}
              </h2>

              {/* Description */}
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base leading-relaxed max-w-sm mx-auto mb-2">
                {t("newsletter.view.newsletterNotFoundDesc", "The newsletter you're looking for may have been deleted or doesn't exist.")}
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mb-8">
                {t("newsletter.view.newsletterNotFoundHint", "Please check the URL or head back to your newsletter dashboard.")}
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={() => navigate('/newsletter')}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all duration-300 px-6"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  {t("newsletter.view.backToNewsletters", "Back to Newsletters")}
                </Button>
                <Button
                  onClick={() => navigate('/newsletters/create')}
                  variant="outline"
                  className="w-full sm:w-auto border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 px-6"
                >
                  <Edit className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  {t("newsletter.view.createNew", "Create New")}
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
                {t("newsletter.view.subject", "Subject")}: {newsletter.subject}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end shrink-0 pl-0 sm:pl-4">
            {canCreate && (newsletter.status === 'draft' || newsletter.status === 'ready_to_send') && newsletter.reviewStatus !== 'approved' && (
              <Button
                onClick={() => navigate(`/newsletter/create/${newsletter.id}`)}
                variant="outline"
                size="sm"
                data-testid="button-edit"
              >
                <Edit className="h-4 w-4 mr-2" strokeWidth={1.5} />
                {t("newsletter.view.edit", "Edit")}
              </Button>
            )}
            {(canCreate || canSend) && reviewerEnabled && newsletter.status === 'ready_to_send' && !isCurrentUserDesignatedReviewer && newsletter.reviewStatus !== 'approved' && (
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
                {submitForReviewMutation.isPending ? t("newsletter.view.submitting", "Submitting...") : t("newsletter.view.submitForReview", "Submit for Review")}
              </Button>
            )}
            {canSend && newsletter.status === 'ready_to_send' && (
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
                {sendNowMutation.isPending ? t("newsletter.view.sending", "Sending...") : t("newsletter.view.sendNow", "Send Now")}
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
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100">{t("newsletter.view.awaitingApproval", "Awaiting Reviewer Approval")}</h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                    {newsletter.reviewerId === currentUserId ? t("newsletter.view.awaitingApprovalDescReviewer", "This newsletter has been submitted for review. Enter the 6-digit approval code to approve and send.") : t("newsletter.view.awaitingApprovalDescOther", "This newsletter has been submitted for review. Waiting for the designated reviewer to approve or reject it.")}
                  </p>
                </div>
              </div>

              {/* Recall to Draft - show to the submitter or admins/owners (not the reviewer) */}
              {(canCreate || canSend) && newsletter.reviewerId !== currentUserId && (newsletter.userId === currentUserId || ['Owner', 'Administrator'].includes((user as any)?.role)) && (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => recallReviewMutation.mutate(newsletter.id)}
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                    disabled={recallReviewMutation.isPending}
                    data-testid="button-recall-review"
                  >
                    {recallReviewMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("newsletter.view.recalling", "Recalling...")}</>
                    ) : (
                      <><Undo2 className="h-4 w-4 mr-2" strokeWidth={1.5} /> {t("newsletter.view.recallToDraft", "Recall to Draft")}</>
                    )}
                  </Button>
                </div>
              )}

              {/* Reviewer Actions - Only show to the assigned reviewer */}
              {newsletter.reviewerId === currentUserId && (
                <div className="space-y-4">
                  {/* Approval Code Section */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {isReviewerFromEmail ? t("newsletter.view.approvalCodeFromEmail", "Approval Code (from email)") : t("newsletter.view.enterApprovalCode", "Enter Approval Code")}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="relative flex-1 max-w-xs">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={approvalCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                            setApprovalCode(val);
                            setApprovalCodeError('');
                          }}
                          placeholder="000000"
                          className={`pl-9 text-center text-xl font-bold tracking-[0.3em] font-mono h-12 border-2 ${approvalCodeError
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : approvalCode.length === 6
                              ? 'border-emerald-400 focus-visible:ring-emerald-400'
                              : 'border-amber-300 focus-visible:ring-amber-400'
                            }`}
                          data-testid="input-approval-code"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          if (approvalCode.length !== 6) {
                            setApprovalCodeError(t("newsletter.view.approvalCodeError", "Please enter a valid 6-digit code"));
                            return;
                          }
                          approveAndSendMutation.mutate({ id: newsletter.id, approvalCode });
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6"
                        disabled={approvalCode.length !== 6 || approveAndSendMutation.isPending || approveMutation.isPending}
                        data-testid="button-approve-and-send"
                      >
                        {approveAndSendMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("newsletter.view.approving", "Approving...")}</>
                        ) : (
                          <><Send className="h-4 w-4 mr-2" strokeWidth={1.5} /> {t("newsletter.view.approveSend", "Approve & Send")}</>
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
                        {t("newsletter.view.checkEmailForCode", "Check your email for the 6-digit code that was sent when this newsletter was submitted for review.")}
                      </p>
                    )}
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => {
                        if (approvalCode.length !== 6) {
                          setApprovalCodeError(t("newsletter.view.approvalCodeError", "Please enter a valid 6-digit code"));
                          return;
                        }
                        approveMutation.mutate({ id: newsletter.id, approvalCode });
                      }}
                      size="sm"
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                      disabled={approvalCode.length !== 6 || approveMutation.isPending || approveAndSendMutation.isPending}
                      data-testid="button-approve-only"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      {approveMutation.isPending ? t("newsletter.view.approving", "Approving...") : t("newsletter.view.approveOnly", "Approve Only")}
                    </Button>
                    <Button
                      onClick={() => setShowRejectDialog(true)}
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                      disabled={rejectMutation.isPending || approveAndSendMutation.isPending}
                      data-testid="button-reject"
                    >
                      <XCircle className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      {t("newsletter.view.reject", "Reject")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Review status info (for approved/rejected newsletters) */}
        {newsletter.reviewStatus === 'approved' && newsletter.reviewedAt && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/40 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{t("newsletter.view.approvedByReviewer", "Approved by reviewer")}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {format(new Date(newsletter.reviewedAt), 'PPP p')}
                  {newsletter.reviewNotes && ` — "${newsletter.reviewNotes}"`}
                </p>
              </div>
            </div>
          </div>
        )}

        {newsletter.reviewStatus === 'rejected' && newsletter.reviewedAt && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/40 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-100">{t("newsletter.view.rejectedByReviewer", "Rejected by reviewer")}</p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  {format(new Date(newsletter.reviewedAt), 'PPP p')}
                </p>
                {newsletter.reviewNotes && (
                  <div className="mt-2 p-2 rounded-md bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-800 dark:text-red-200 italic">"{newsletter.reviewNotes}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Recipients */}
          <Card className="group relative overflow-hidden border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {t("newsletter.view.recipients", "Recipients")}
                  </p>
                  <p className="mt-1.5 text-2xl lg:text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100" data-testid="text-recipients-count">
                    {(newsletter.recipientCount || 0).toLocaleString()}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    <Users className="h-3 w-3" strokeWidth={2} />
                    {t("newsletter.view.totalSentTo", "Total sent to")}
                  </p>
                </div>
                <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <Users className="text-blue-600 dark:text-blue-400 w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unique Opens */}
          <Card className="group relative overflow-hidden border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {t("newsletter.view.uniqueOpens", "Unique Opens")}
                  </p>
                  <p className="mt-1.5 text-2xl lg:text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100" data-testid="text-opens-count">
                    {(newsletter.opens || 0).toLocaleString()}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tabular-nums">
                    <TrendingUp className="h-3 w-3" strokeWidth={2} />
                    {t("newsletter.view.uniqueRate", "{{rate}}% unique rate", { rate: uniqueOpenRate })}
                  </p>
                </div>
                <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <Eye className="text-emerald-600 dark:text-emerald-400 w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clicks */}
          <Card className="group relative overflow-hidden border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {t("newsletter.view.clicks", "Clicks")}
                  </p>
                  <p className="mt-1.5 text-2xl lg:text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100" data-testid="text-clicks-count">
                    {(newsletter.clickCount || 0).toLocaleString()}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold tabular-nums">
                    <TrendingUp className="h-3 w-3" strokeWidth={2} />
                    {t("newsletter.view.ctr", "{{rate}}% CTR", { rate: clickThroughRate })}
                  </p>
                </div>
                <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <MousePointer className="text-purple-600 dark:text-purple-400 w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Issues */}
          <Card className="group relative overflow-hidden border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" />
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t("newsletter.view.deliveryIssues", "Delivery Issues")}
                </p>
                <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <AlertTriangle className="text-red-600 dark:text-red-400 w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.5} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-red-50/70 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 px-2 py-2 text-center">
                  <p className="text-base lg:text-lg font-bold tabular-nums text-red-700 dark:text-red-300" data-testid="text-bounces-count">
                    {liveStats?.bounced ?? 0}
                  </p>
                  <p className="text-[9px] font-medium text-red-600/80 dark:text-red-400/80 uppercase tracking-wide">{t("newsletter.view.bounced", "Bounced")}</p>
                </div>
                <div className="rounded-lg bg-amber-50/70 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 px-2 py-2 text-center">
                  <p className="text-base lg:text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300" data-testid="text-suppressed-count">
                    {liveStats?.suppressed ?? 0}
                  </p>
                  <p className="text-[9px] font-medium text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wide">{t("newsletter.view.suppressed", "Suppressed")}</p>
                </div>
                <div className="rounded-lg bg-orange-50/70 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 px-2 py-2 text-center">
                  <p className="text-base lg:text-lg font-bold tabular-nums text-orange-700 dark:text-orange-300" data-testid="text-complaints-count">
                    {liveStats?.complained ?? 0}
                  </p>
                  <p className="text-[9px] font-medium text-orange-600/80 dark:text-orange-400/80 uppercase tracking-wide">{t("newsletter.view.complaints", "Complaints")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 lg:space-y-8">
          {(() => {
            // Tailwind's JIT scans static strings, so the per-accent classes
            // have to be listed as literal strings here rather than built
            // from a template like `text-${accent}-600`.
            const tabTriggerBase =
              "group relative flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-out rounded-lg " +
              "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md " +
              "data-[state=inactive]:text-gray-600 dark:data-[state=inactive]:text-gray-400 " +
              "data-[state=inactive]:hover:text-gray-900 dark:data-[state=inactive]:hover:text-gray-200 " +
              "data-[state=inactive]:hover:bg-gray-200/50 dark:data-[state=inactive]:hover:bg-gray-700/30";

            const tabs = [
              {
                value: "overview",
                icon: Newspaper,
                label: t("newsletter.view.tabs.overview", "Overview"),
                accent: "data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-gray-200/50 dark:data-[state=active]:shadow-black/20",
              },
              {
                value: "live-tracking",
                icon: Activity,
                label: t("newsletter.view.tabs.live", "Live"),
                accent: "data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-blue-100/50 dark:data-[state=active]:shadow-blue-900/20",
                livePulse: true,
              },
              {
                value: "reactions",
                icon: Smile,
                label: t("newsletter.view.tabs.reactions", "Reactions"),
                shortLabel: t("newsletter.view.tabs.reactionsShort", "React"),
                accent: "data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:shadow-amber-100/50 dark:data-[state=active]:shadow-amber-900/20",
              },
              {
                value: "content",
                icon: Eye,
                label: t("newsletter.view.tabs.content", "Content"),
                shortLabel: t("newsletter.view.tabs.contentShort", "View"),
                accent: "data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-indigo-100/50 dark:data-[state=active]:shadow-indigo-900/20",
              },
              {
                value: "status",
                icon: RefreshCw,
                label: t("newsletter.view.tabs.taskStatus", "Status"),
                accent: "data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-purple-100/50 dark:data-[state=active]:shadow-purple-900/20",
              },
              {
                value: "detailed-stats",
                icon: BarChart3,
                label: t("newsletter.view.detailedStats", "Analytics"),
                shortLabel: t("newsletter.view.detailedStatsShort", "Stats"),
                accent: "data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-emerald-100/50 dark:data-[state=active]:shadow-emerald-900/20",
              },
            ] as const;

            return (
              <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="overflow-x-auto scrollbar-hide">
                    <TabsList className="inline-flex h-12 p-1.5 gap-1.5 bg-gradient-to-b from-gray-50/80 to-gray-100/80 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/40 rounded-xl shadow-sm min-w-max">
                      {tabs.map(({ value, icon: Icon, label, shortLabel, accent, livePulse }) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className={`${tabTriggerBase} ${accent}`}
                          data-testid={`tab-${value}`}
                        >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 transition-transform duration-300 group-data-[state=active]:scale-110" strokeWidth={1.5} />
                          {shortLabel ? (
                            <>
                              <span className="hidden sm:inline">{label}</span>
                              <span className="sm:hidden">{shortLabel}</span>
                            </>
                          ) : (
                            <span>{label}</span>
                          )}
                          {livePulse && (
                            <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                            </span>
                          )}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {/* Edge fade masks — hint that more tabs exist when the list
                    overflows horizontally. Hidden on sm+ where there's room. */}
                <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-white to-transparent dark:from-gray-950 sm:hidden" aria-hidden />
                <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-6 bg-gradient-to-l from-white to-transparent dark:from-gray-950 sm:hidden" aria-hidden />
              </div>
            );
          })()}

          <TabsContent value="live-tracking" className="space-y-6 lg:space-y-8">
            <LiveTrackingPanel newsletterId={newsletter.id} />
          </TabsContent>

          <TabsContent value="reactions" className="space-y-6 lg:space-y-8">
            {newsletter.reactionsEnabled === false ? (
              <Card>
                <CardContent className="p-8 lg:p-12">
                  <div className="flex flex-col items-center text-center max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5">
                      <Smile className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {t("newsletter.view.reactionsNotEnabled", "Reactions Not Enabled")}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                      {t("newsletter.view.reactionsNotEnabledDesc", "Emoji reactions were not included in this newsletter. Readers were not able to provide feedback through the reactions bar.")}
                    </p>
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 p-4 w-full">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <Smile className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{t("newsletter.view.enableForFuture", "Enable for future newsletters")}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                            {t("newsletter.view.enableForFutureDesc", "You can enable the reactions feature when creating or editing your next newsletter. The \"Enable Reactions\" toggle is available in the send wizard before you send.")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ReactionInsightsSection newsletterId={newsletter.id} />
            )}
          </TabsContent>

          <TabsContent value="overview" className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid gap-5 lg:gap-6 md:grid-cols-2">
              {/* Newsletter Details Card */}
              <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center">
                      <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                    </div>
                    {t("newsletter.view.newsletterDetails", "Newsletter Details")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-0">
                  {/* Date Information Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-gray-50/80 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/20 border border-gray-100 dark:border-gray-700/30">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.created", "Created")}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                        {format(new Date(newsletter.createdAt || ''), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(newsletter.createdAt || ''), 'h:mm a')}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-gray-50/80 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/20 border border-gray-100 dark:border-gray-700/30">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.updated", "Updated")}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                        {format(new Date(newsletter.updatedAt || ''), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(newsletter.updatedAt || ''), { addSuffix: true })}
                      </p>
                    </div>
                    {newsletter.scheduledAt && (
                      <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-800/30 sm:col-span-2">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">{t("newsletter.view.scheduled", "Scheduled")}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                          {format(new Date(newsletter.scheduledAt), 'PPP p')}
                        </p>
                      </div>
                    )}
                    {newsletter.sentAt && (
                      <div className="p-3 rounded-xl bg-gradient-to-br from-green-50/80 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200/50 dark:border-green-800/30 sm:col-span-2">
                        <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">{t("newsletter.view.sent", "Sent")}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                          {format(new Date(newsletter.sentAt), 'PPP p')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(newsletter.sentAt), { addSuffix: true })}
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-gray-100 dark:bg-gray-800" />

                  {/* Author Section */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t("newsletter.view.author", "Author")}</p>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-100/50 dark:border-blue-800/30">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                        <User className="h-5 w-5 text-white" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {newsletter.user?.firstName || ''} {newsletter.user?.lastName || ''}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {newsletter.user?.email || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-gray-100 dark:bg-gray-800" />

                  {/* Targeting Section */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t("newsletter.view.targeting", "Targeting")}</p>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50/50 to-pink-50/30 dark:from-purple-900/20 dark:to-pink-900/10 border border-purple-100/50 dark:border-purple-800/30 space-y-3">
                      <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 border-purple-200 dark:border-purple-700/50 text-purple-700 dark:text-purple-300 px-3 py-1.5">
                        <Tag className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                        <span className="font-medium">
                          {newsletter.recipientType === 'all' ? t("newsletter.view.allContacts", "All Contacts") :
                            newsletter.recipientType === 'selected' ? t("newsletter.view.selectedContacts", "Selected Contacts") : t("newsletter.view.taggedContacts", "Tagged Contacts")}
                        </span>
                      </Badge>
                      {newsletter.selectedContactIds?.length ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                          {newsletter.selectedContactIds.length} {t("newsletter.view.specificContactsShort", "specific contacts selected", { count: newsletter.selectedContactIds.length })}
                        </p>
                      ) : null}
                      {newsletter.selectedTagIds?.length ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                          {newsletter.selectedTagIds.length} {t("newsletter.view.tagGroupsShort", "tag groups", { count: newsletter.selectedTagIds.length })}
                        </p>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRecipientsModal(true)}
                        data-testid="button-view-recipients"
                        className="w-full sm:w-auto mt-2 bg-white/70 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600"
                      >
                        <Users className="h-4 w-4 mr-2" strokeWidth={1.5} />
                        {t("newsletter.view.viewRecipients", "View Recipients")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Timeline Card */}
              <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-green-600 dark:text-green-400" strokeWidth={1.5} />
                    </div>
                    {t("newsletter.view.activityTimeline", "Activity Timeline")}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                    {t("newsletter.view.recentEventsDesc", "Recent events and status changes for this newsletter")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative">
                    {/* Timeline connector line */}
                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-green-200 via-emerald-200 to-teal-200 dark:from-green-800/50 dark:via-emerald-800/50 dark:to-teal-800/50" />
                    
                    <div className="space-y-4">
                      {mockTimelineEvents.map((event, index) => {
                        const Icon = getTimelineIcon(event.type);
                        const isLast = index === mockTimelineEvents.length - 1;
                        return (
                          <div key={event.id} className="relative flex items-start gap-4 group">
                            {/* Timeline node */}
                            <div className={`relative z-10 w-8 h-8 rounded-full ${getTimelineColor(event.status)} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform duration-200 ring-4 ring-white dark:ring-gray-800`}>
                              <Icon className="h-4 w-4" strokeWidth={1.5} />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {event.title}
                                  </p>
                                  {event.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2.5 text-lg mb-2">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center">
                        <Eye className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
                      </div>
                      {t("newsletter.view.emailPreview", "Email Preview")}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                      {t("newsletter.view.emailPreviewDesc", "How this newsletter appears in your recipients' inbox")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="gap-1.5 px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300">
                      <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span className="truncate max-w-[200px] sm:max-w-[300px]">{newsletter.subject}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-gradient-to-br from-gray-50/50 to-gray-100/30 dark:from-gray-800/30 dark:to-gray-900/20 p-4 sm:p-6 lg:p-8">
                  <div className="mx-auto max-w-[640px]">
                    {/* Email metadata bar */}
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500 dark:text-gray-400 p-3 rounded-lg bg-white/60 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/30">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                        <span className="font-medium">{t("newsletter.view.from", "From")}:</span>
                        <span className="truncate max-w-[150px]">{newsletter.user?.email || "your-company"}</span>
                      </div>
                      <div className="hidden sm:block w-px h-3 bg-gray-300 dark:bg-gray-600" />
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{t("newsletter.view.subject", "Subject")}:</span>
                        <span className="truncate max-w-[200px]">{newsletter.subject}</span>
                      </div>
                    </div>
                    
                    {/* Email preview container */}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg shadow-gray-200/50 dark:shadow-black/30 overflow-hidden transition-shadow duration-300 hover:shadow-xl hover:shadow-gray-200/60 dark:hover:shadow-black/40">
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
                    
                    {/* Preview footer note */}
                    <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
                      {t("newsletter.view.previewNote", "This is a preview of how your newsletter will appear. Actual rendering may vary by email client.")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-500" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
                  </div>
                  {t("newsletter.view.processingStatus", "Newsletter Processing Status")}
                </CardTitle>
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                  {t("newsletter.view.processingStatusDesc", "Track the progress of your newsletter through the delivery pipeline")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-0">
                {/* Progress Steps Indicator */}
                <div className="relative p-6 rounded-2xl bg-gradient-to-br from-gray-50/80 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/20 border border-gray-200/50 dark:border-gray-700/30">
                  <div className="flex items-start justify-between gap-2">
                    {([
                      { step: 1, title: t("newsletter.view.contentValidation", "Validation"), key: 'validation' as const, icon: CheckCircle, description: t("newsletter.view.contentValidationDesc", "Content check") },
                      { step: 2, title: t("newsletter.view.emailDelivery", "Delivery"), key: 'delivery' as const, icon: Send, description: t("newsletter.view.emailDeliveryDesc", "Sending emails") },
                      { step: 3, title: t("newsletter.view.analyticsCollection", "Analytics"), key: 'analytics' as const, icon: BarChart3, description: t("newsletter.view.analyticsCollectionDesc", "24hr data collection") }
                    ] as const).map((item, index) => {
                      const isCompleted = getTaskStepStatus(item.key) === 'completed';
                      const isActive = getTaskStepStatus(item.key) === 'running';
                      const isPending = getTaskStepStatus(item.key) === 'pending';
                      const Icon = item.icon;
                      const isLast = index === 2;

                      return (
                        <div key={item.key} className="flex-1 flex items-center">
                          <div className="flex flex-col items-center text-center w-full">
                            {/* Step Circle */}
                            <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${isCompleted
                              ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-200 dark:shadow-green-900/30'
                              : isActive
                                ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30 ring-4 ring-blue-100 dark:ring-blue-900/30 animate-pulse'
                                : isPending
                                  ? 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 text-gray-500 dark:text-gray-400'
                                  : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 text-gray-400'
                              }`}>
                              {isCompleted ? (
                                <CheckCircle className="w-7 h-7" strokeWidth={1.5} />
                              ) : isActive ? (
                                <RefreshCw className="w-6 h-6 animate-spin" strokeWidth={1.5} />
                              ) : (
                                <Icon className="w-6 h-6" strokeWidth={1.5} />
                              )}
                              
                              {/* Step number badge */}
                              <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${isCompleted || isActive ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300' : 'bg-gray-400 dark:bg-gray-600 text-white'}`}>
                                {item.step}
                              </span>
                            </div>
                            
                            {/* Title & Description */}
                            <div className="mt-3">
                              <p className={`text-sm font-semibold mb-0.5 ${isActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : isCompleted 
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                {item.title}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          
                          {/* Connector Line */}
                          {!isLast && (
                            <div className="w-full h-1 mx-2 mt-[-28px] rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${isCompleted ? 'bg-gradient-to-r from-green-400 to-emerald-500 w-full' : 'w-0'}`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Status Cards */}
                <div className="space-y-3">
                  {/* Content Validation */}
                  <div className={`rounded-xl p-4 transition-all duration-300 ${getTaskStepStatus('validation') === 'completed' 
                    ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200/60 dark:border-green-800/40' 
                    : getTaskStepStatus('validation') === 'running'
                      ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200/60 dark:border-blue-800/40'
                      : 'bg-gradient-to-r from-gray-50/80 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/20 border border-gray-200/50 dark:border-gray-700/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTaskStepStatus('validation') === 'completed' 
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' 
                          : getTaskStepStatus('validation') === 'running'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>
                          {getTaskStepStatus('validation') === 'completed' ? (
                            <CheckCircle className="h-5 w-5" strokeWidth={1.5} />
                          ) : getTaskStepStatus('validation') === 'running' ? (
                            <RefreshCw className="h-5 w-5 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Clock className="h-5 w-5" strokeWidth={1.5} />
                          )}
                        </div>
                        <div>
                          <h4 className={`text-sm font-semibold ${getTaskStepStatus('validation') === 'running' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                            {t("newsletter.view.contentValidation", "Content Validation")}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t("newsletter.view.contentValidationCheckDesc", "Checking content quality, links, and compliance")}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getTaskStepStatus('validation') === 'completed' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800' 
                        : getTaskStepStatus('validation') === 'running'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                      }`}>
                        {getTaskStepStatus('validation') === 'completed' ? (
                          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {t("newsletter.view.completed", "Completed")}</span>
                        ) : getTaskStepStatus('validation') === 'running' ? (
                          <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> {t("newsletter.view.inProgress", "In Progress")}</span>
                        ) : t("newsletter.view.pending", "Pending")}
                      </Badge>
                    </div>
                    {getTaskStepStatus('validation') === 'running' && (
                      <div className="mt-3">
                        <Progress value={75} className="h-2 bg-blue-100 dark:bg-blue-900/30" />
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">75% {t("newsletter.view.complete", "complete")}</p>
                      </div>
                    )}
                  </div>

                  {/* Email Delivery */}
                  <div className={`rounded-xl p-4 transition-all duration-300 ${getTaskStepStatus('delivery') === 'completed' 
                    ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200/60 dark:border-green-800/40' 
                    : getTaskStepStatus('delivery') === 'running'
                      ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200/60 dark:border-blue-800/40'
                      : 'bg-gradient-to-r from-gray-50/80 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/20 border border-gray-200/50 dark:border-gray-700/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTaskStepStatus('delivery') === 'completed' 
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' 
                          : getTaskStepStatus('delivery') === 'running'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>
                          {getTaskStepStatus('delivery') === 'completed' ? (
                            <CheckCircle className="h-5 w-5" strokeWidth={1.5} />
                          ) : getTaskStepStatus('delivery') === 'running' ? (
                            <Send className="h-5 w-5 animate-pulse" strokeWidth={1.5} />
                          ) : (
                            <Clock className="h-5 w-5" strokeWidth={1.5} />
                          )}
                        </div>
                        <div>
                          <h4 className={`text-sm font-semibold ${getTaskStepStatus('delivery') === 'running' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                            {t("newsletter.view.emailDelivery", "Email Delivery")}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t("newsletter.view.sendingToRecipients", "Sending to {{count}} recipients", { count: newsletter.recipientCount || 0 })}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getTaskStepStatus('delivery') === 'completed' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800' 
                        : getTaskStepStatus('delivery') === 'running'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                      }`}>
                        {getTaskStepStatus('delivery') === 'completed' ? (
                          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {t("newsletter.view.completed", "Completed")}</span>
                        ) : getTaskStepStatus('delivery') === 'running' ? (
                          <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> {t("newsletter.view.inProgress", "In Progress")}</span>
                        ) : t("newsletter.view.pending", "Pending")}
                      </Badge>
                    </div>
                    {getTaskStepStatus('delivery') === 'running' && (
                      <div className="mt-3">
                        <Progress value={45} className="h-2 bg-blue-100 dark:bg-blue-900/30" />
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">45% {t("newsletter.view.deliveredCount", "delivered")}</p>
                      </div>
                    )}
                  </div>

                  {/* Analytics Collection */}
                  <div className={`rounded-xl p-4 transition-all duration-300 ${getTaskStepStatus('analytics') === 'completed' 
                    ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200/60 dark:border-green-800/40' 
                    : getTaskStepStatus('analytics') === 'running'
                      ? 'bg-gradient-to-r from-purple-50/80 to-violet-50/50 dark:from-purple-900/20 dark:to-violet-900/10 border border-purple-200/60 dark:border-purple-800/40'
                      : 'bg-gradient-to-r from-gray-50/80 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/20 border border-gray-200/50 dark:border-gray-700/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTaskStepStatus('analytics') === 'completed' 
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' 
                          : getTaskStepStatus('analytics') === 'running'
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>
                          {getTaskStepStatus('analytics') === 'completed' ? (
                            <CheckCircle className="h-5 w-5" strokeWidth={1.5} />
                          ) : getTaskStepStatus('analytics') === 'running' ? (
                            <BarChart3 className="h-5 w-5 animate-pulse" strokeWidth={1.5} />
                          ) : (
                            <Clock className="h-5 w-5" strokeWidth={1.5} />
                          )}
                        </div>
                        <div>
                          <h4 className={`text-sm font-semibold ${getTaskStepStatus('analytics') === 'running' ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'}`}>
                            {t("newsletter.view.analyticsCollection", "Analytics Collection")}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t("newsletter.view.analyticsGatheringDesc", "24-hour engagement tracking")}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getTaskStepStatus('analytics') === 'completed' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800' 
                        : getTaskStepStatus('analytics') === 'running'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                      }`}>
                        {getTaskStepStatus('analytics') === 'completed' ? (
                          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {t("newsletter.view.completed", "Completed")}</span>
                        ) : getTaskStepStatus('analytics') === 'running' ? (
                          <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> {t("newsletter.view.collecting", "Collecting")}</span>
                        ) : t("newsletter.view.pending", "Pending")}
                      </Badge>
                    </div>
                    {getTaskStepStatus('analytics') === 'running' && (
                      <div className="mt-3 space-y-2">
                        <Progress value={65} className="h-2 bg-purple-100 dark:bg-purple-900/30" />
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-purple-600 dark:text-purple-400">
                            {t("newsletter.view.collectingDataProgress", "Collecting engagement data...")}
                          </p>
                          <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                            {newsletter.sentAt && getAnalyticsTimeRemaining()} {t("newsletter.view.remainingShort", "left")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed-stats" className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Analytics Collection Status Banner */}
            {newsletter?.status === 'sent' && getTaskStepStatus('analytics') === 'running' && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                    <RefreshCw className="w-5 h-5 text-white animate-spin" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">{t("newsletter.view.analyticsInProgress", "Analytics Collection In Progress")}</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
                      {t("newsletter.view.analyticsInProgressDesc", "Engagement data is being gathered for 24 hours after sending. Stats below will continue to update in real-time.")}
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
                          {t("newsletter.view.remaining", "{{time}} remaining", { time: getAnalyticsTimeRemaining() })}
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
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">{t("newsletter.view.analyticsComplete", "Analytics Collection Complete")}</h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {t("newsletter.view.analyticsCompleteDesc", "All engagement data has been gathered. The statistics below reflect the final results.")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Aggregate Engagement Metrics */}
            {newsletter?.status === 'sent' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
                <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20">
                  <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-600" />
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                      <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">{(liveStats?.delivered ?? 0).toLocaleString()}</p>
                    <p className="text-[11px] font-semibold text-blue-600/80 dark:text-blue-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.delivered", "Delivered")}</p>
                  </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-emerald-50 to-teal-100/50 dark:from-emerald-950/40 dark:to-teal-900/20">
                  <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                      <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{(newsletter.opens || 0).toLocaleString()}</p>
                    <p className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.uniqueOpens", "Unique Opens")}</p>
                  </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-purple-50 to-fuchsia-100/50 dark:from-purple-950/40 dark:to-fuchsia-900/20">
                  <div className="h-0.5 bg-gradient-to-r from-purple-400 to-fuchsia-500" />
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                      <MousePointer className="h-4 w-4 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-300">{(newsletter.clickCount || 0).toLocaleString()}</p>
                    <p className="text-[11px] font-semibold text-purple-600/80 dark:text-purple-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.clicks", "Clicks")}</p>
                  </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-red-50 to-rose-100/50 dark:from-red-950/40 dark:to-rose-900/20">
                  <div className="h-0.5 bg-gradient-to-r from-red-400 to-rose-500" />
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 dark:bg-red-400/10 flex items-center justify-center mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-300">{(liveStats?.bounced ?? 0).toLocaleString()}</p>
                    <p className="text-[11px] font-semibold text-red-600/80 dark:text-red-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.bounced", "Bounced")}</p>
                  </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-orange-50 to-amber-100/50 dark:from-orange-950/40 dark:to-amber-900/20">
                  <div className="h-0.5 bg-gradient-to-r from-orange-400 to-amber-500" />
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/10 dark:bg-orange-400/10 flex items-center justify-center mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                      <ShieldOff className="h-4 w-4 text-orange-600 dark:text-orange-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-orange-700 dark:text-orange-300">{(liveStats?.complained ?? 0).toLocaleString()}</p>
                    <p className="text-[11px] font-semibold text-orange-600/80 dark:text-orange-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.complaints", "Complaints")}</p>
                  </CardContent>
                </Card>

                <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-yellow-50 to-amber-100/50 dark:from-yellow-950/40 dark:to-amber-900/20">
                  <div className="h-0.5 bg-gradient-to-r from-yellow-400 to-amber-500" />
                  <CardContent className="p-4 text-center">
                    <div className="w-9 h-9 rounded-lg bg-yellow-500/10 dark:bg-yellow-400/10 flex items-center justify-center mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                      <XCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-yellow-700 dark:text-yellow-300">{(liveStats?.suppressed ?? 0).toLocaleString()}</p>
                    <p className="text-[11px] font-semibold text-yellow-600/80 dark:text-yellow-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.suppressed", "Suppressed")}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Engagement Rates & Insights */}
            {newsletter?.status === 'sent' && (
              <div className="grid gap-4 lg:gap-6 md:grid-cols-2">
                <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
                      </div>
                      {t("newsletter.view.engagementRates", "Engagement Rates")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* {t("newsletter.view.openRate", "Open Rate")} */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-green-500" strokeWidth={1.5} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("newsletter.view.uniqueOpenRate", "Unique Open Rate")}</span>
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
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t("newsletter.view.uniqueSentStats", "{{unique}} unique / {{total}} sent", { unique: newsletter.opens || 0, total: newsletter.recipientCount || 0 })}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{t("newsletter.view.totalOpens", "({{count}} total opens)", { count: (newsletter as any).totalOpens || 0 })}</span>
                      </div>
                    </div>

                    {/* Click-through Rate */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MousePointer className="h-4 w-4 text-purple-500" strokeWidth={1.5} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("newsletter.view.clickThroughRate", "Click-through Rate")}</span>
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
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t("newsletter.view.clicksOpensStats", "{{clicks}} clicks / {{opens}} unique opens", { clicks: newsletter.clickCount || 0, opens: newsletter.opens || 0 })}</span>
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
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("newsletter.view.deliveryRate", "Delivery Rate")}</span>
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
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t("newsletter.view.deliveredSentStats", "{{delivered}} delivered / {{total}} sent", { delivered: liveStats?.delivered ?? 0, total: newsletter.recipientCount || 0 })}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500" />
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                      </div>
                      {t("newsletter.view.performanceInsights", "Performance Insights")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {parseFloat(uniqueOpenRate) > 25 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-xl">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">{t("newsletter.view.excellentEngagement", "Excellent Engagement")}</p>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                            {t("newsletter.view.excellentEngagementDesc", "Your {{rate}}% unique open rate is above the industry average of ~21%.", { rate: uniqueOpenRate })}
                          </p>
                        </div>
                      </div>
                    )}

                    {parseFloat(uniqueOpenRate) <= 25 && parseFloat(uniqueOpenRate) > 0 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t("newsletter.view.averageEngagement", "Average Engagement")}</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            {t("newsletter.view.averageEngagementDesc", "Your {{rate}}% open rate can be improved. Try more compelling subject lines.", { rate: uniqueOpenRate })}
                          </p>
                        </div>
                      </div>
                    )}

                    {(newsletter.opens === 0 || !newsletter.opens) && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 border border-gray-200 dark:border-gray-700/50 rounded-xl">
                        <Clock className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t("newsletter.view.awaitingOpens", "Awaiting Opens")}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {t("newsletter.view.awaitingOpensDesc", "No unique opens recorded yet. Opens usually trickle in over 24-48 hours.")}
                          </p>
                        </div>
                      </div>
                    )}

                    {parseFloat(clickThroughRate) > 3 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl">
                        <MousePointer className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{t("newsletter.view.greatClickRate", "Great Click Rate")}</p>
                          <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                            {t("newsletter.view.greatClickRateDesc", "Your {{rate}}% CTR shows strong content relevance.", { rate: clickThroughRate })}
                          </p>
                        </div>
                      </div>
                    )}

                    {(liveStats?.bounced ?? 0) > 0 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t("newsletter.view.bouncesDetected", "Bounces Detected")}</p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                            {t("newsletter.view.bouncesDetectedDesc", "{{count}} email(s) bounced. Consider cleaning your contact list.", { count: liveStats?.bounced })}
                          </p>
                        </div>
                      </div>
                    )}

                    {(liveStats?.bounced ?? 0) === 0 && (newsletter.opens || 0) > 0 && parseFloat(clickThroughRate) <= 3 && parseFloat(uniqueOpenRate) > 25 && (
                      <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl">
                        <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{t("newsletter.view.healthyDelivery", "Healthy Delivery")}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                            {t("newsletter.view.healthyDeliveryDesc", "Zero bounces with good opens. Your sender reputation is in great shape.")}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Reader Reactions Insights */}
            {newsletter?.status === 'sent' && <ReactionInsightsSection newsletterId={newsletter.id} />}

            {/* Per-Recipient Stats Table */}
            <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center">
                    <List className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                  </div>
                  {t("newsletter.view.perRecipientActivity", "Per-Recipient Email Activity")}
                </CardTitle>
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                  {t("newsletter.view.perRecipientActivityDesc", "Individual delivery status and engagement activity for each recipient")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {newsletter?.status !== 'sent' ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-8 w-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {t("newsletter.view.notSentYet", "Newsletter Not Sent Yet")}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      {t("newsletter.view.notSentYetDesc", "Per-recipient statistics will appear here after the newsletter is sent. You'll see individual open, click, bounce, and complaint data for each email.")}
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
                        {t("newsletter.view.refresh", "Refresh")}
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
                                  {(email.recipient || '?').charAt(0)}
                                </span>
                              </div>

                              {/* Email & Status */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {email.recipient || 'Unknown'}
                                  </p>
                                  <Badge className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${getStatusColor(email.status || 'sent')}`}>
                                    {getStatusIcon(email.status || 'sent')}
                                    {(email.status || 'sent').charAt(0).toUpperCase() + (email.status || 'sent').slice(1)}
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
                                        navigate(`/contacts/view/${data.contacts[0].id}`);
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
                      {t("newsletter.view.noEmailDataYet", "No Email Data Available Yet")}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      {t("newsletter.view.noEmailDataYetDesc", "Email tracking data is being collected. This typically takes a few minutes after sending begins.")}
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
                {t("newsletter.view.emailTrajectory", "Email Trajectory History")}
                {selectedTrajectory && selectedTrajectory.totalEvents > 1 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedTrajectory.totalEvents} Events
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {t("newsletter.view.trajectoryDesc", "Complete tracking timeline showing every interaction with this specific email")}
              </DialogDescription>
            </DialogHeader>

            {selectedTrajectory && (
              <div className="space-y-6">
                {/* Email Overview */}
                <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2.5 text-lg">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/40 dark:to-blue-900/40 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-sky-600 dark:text-sky-400" strokeWidth={1.5} />
                      </div>
                      {t("newsletter.view.emailDetails", "Email Details")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.from", "From")}</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-all">{selectedTrajectory.from}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.to", "To")}</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-all">{selectedTrajectory.to}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30 sm:col-span-2">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.subject", "Subject")}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{selectedTrajectory.subject}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.status", "Status")}</p>
                        <Badge className="mt-1.5">
                          {selectedTrajectory.status || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.createdAt", "Created At")}</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
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
                  <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2.5 text-lg">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
                        </div>
                        {t("newsletter.view.engagementSummary", "Engagement Summary")}
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                        {t("newsletter.view.engagementSummaryDesc", "Quick overview of recipient engagement with this email")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="group relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-100 dark:border-blue-900/30 text-center transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-center justify-center w-9 h-9 bg-blue-500/10 dark:bg-blue-400/10 rounded-lg mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">{selectedTrajectory.totalEvents}</p>
                          <p className="text-[11px] font-semibold text-blue-600/80 dark:text-blue-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.totalEvents", "Total Events")}</p>
                        </div>

                        <div className="group relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-purple-950/40 dark:to-purple-900/20 border border-purple-100 dark:border-purple-900/30 text-center transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-center justify-center w-9 h-9 bg-purple-500/10 dark:bg-purple-400/10 rounded-lg mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                            <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-300">{selectedTrajectory.totalOpens || 0}</p>
                          <p className="text-[11px] font-semibold text-purple-600/80 dark:text-purple-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.opens", "Opens")}</p>
                        </div>

                        <div className="group relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/60 dark:from-orange-950/40 dark:to-orange-900/20 border border-orange-100 dark:border-orange-900/30 text-center transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-center justify-center w-9 h-9 bg-orange-500/10 dark:bg-orange-400/10 rounded-lg mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                            <MousePointer className="h-4 w-4 text-orange-600 dark:text-orange-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold tabular-nums text-orange-700 dark:text-orange-300">{selectedTrajectory.totalClicks || 0}</p>
                          <p className="text-[11px] font-semibold text-orange-600/80 dark:text-orange-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.clicks", "Clicks")}</p>
                        </div>

                        <div className="group relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-center transition-all duration-300 hover:shadow-sm">
                          <div className="flex items-center justify-center w-9 h-9 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-lg mx-auto mb-2 transition-transform duration-300 group-hover:scale-110">
                            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                            {selectedTrajectory.totalOpens > 0 ?
                              Math.round((selectedTrajectory.totalClicks / selectedTrajectory.totalOpens) * 100) :
                              0
                            }%
                          </p>
                          <p className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 uppercase tracking-wide">{t("newsletter.view.clickRate", "Click Rate")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Event Timeline */}
                <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-3 text-lg">
                      <span className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/40 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-teal-600 dark:text-teal-400" strokeWidth={1.5} />
                        </div>
                        {t("newsletter.view.eventTimeline", "Event Timeline")}
                      </span>
                      <div className="flex gap-2 text-sm shrink-0">
                        {selectedTrajectory.totalOpens > 0 && (
                          <Badge variant="secondary" className="gap-1 tabular-nums">
                            <Eye className="h-3 w-3" strokeWidth={1.5} />
                            {selectedTrajectory.totalOpens} {selectedTrajectory.totalOpens === 1 ? 'Open' : 'Opens'}
                          </Badge>
                        )}
                        {selectedTrajectory.totalClicks > 0 && (
                          <Badge variant="secondary" className="gap-1 tabular-nums">
                            <MousePointer className="h-3 w-3" strokeWidth={1.5} />
                            {selectedTrajectory.totalClicks} {selectedTrajectory.totalClicks === 1 ? 'Click' : 'Clicks'}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                      Detailed chronological events showing each interaction with this email
                      {selectedTrajectory.totalOpens > 1 && (
                        <span className="text-purple-600 dark:text-purple-400 ml-1">
                          • {selectedTrajectory.totalOpens} individual open events tracked
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
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
                        {t("newsletter.view.noEventTimeline", "No event timeline available")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Additional Metadata */}
                {selectedTrajectory.metadata && (
                  <Card className="border border-gray-200/60 dark:border-gray-700/40 shadow-sm overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-slate-400 via-gray-400 to-zinc-400" />
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2.5 text-lg">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-gray-100 dark:from-slate-800/60 dark:to-gray-800/60 flex items-center justify-center">
                          <Info className="h-5 w-5 text-slate-600 dark:text-slate-400" strokeWidth={1.5} />
                        </div>
                        {t("newsletter.view.additionalInfo", "Additional Information")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedTrajectory.metadata.reply_to && (
                          <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.replyTo", "Reply To")}</p>
                            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-all">{selectedTrajectory.metadata.reply_to}</p>
                          </div>
                        )}
                        {selectedTrajectory.metadata.cc && (
                          <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">CC</p>
                            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-all">{Array.isArray(selectedTrajectory.metadata.cc) ?
                              selectedTrajectory.metadata.cc.join(', ') :
                              selectedTrajectory.metadata.cc}
                            </p>
                          </div>
                        )}
                        {selectedTrajectory.metadata.bcc && (
                          <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">BCC</p>
                            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-all">{Array.isArray(selectedTrajectory.metadata.bcc) ?
                              selectedTrajectory.metadata.bcc.join(', ') :
                              selectedTrajectory.metadata.bcc}
                            </p>
                          </div>
                        )}
                        <div className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/30">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("newsletter.view.emailId", "Email ID")}</p>
                          <p className="font-mono text-xs text-gray-700 dark:text-gray-300 mt-1 break-all">{selectedTrajectory.emailId}</p>
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
                {t("newsletter.view.recipients", "Recipients")}
                {recipientsData && (
                  <Badge variant="secondary" className="ml-1">
                    {recipientsData.total}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {newsletter?.recipientType === 'all' ? t("newsletter.view.allActiveContacts", "All active contacts") :
                  newsletter?.recipientType === 'selected' ? t("newsletter.view.individuallySelected", "Individually selected contacts") : t("newsletter.view.matchingTags", "Contacts matching selected tags")}
              </DialogDescription>
            </DialogHeader>

            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("newsletter.view.searchRecipients", "Search recipients...")}
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
                    {recipientSearch ? t("newsletter.view.noRecipientsMatch", "No recipients match your search") : t("newsletter.view.noRecipientsFound", "No recipients found")}
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
                {t("newsletter.view.rejectNewsletter", "Reject Newsletter")}
              </DialogTitle>
              <DialogDescription>
                {t("newsletter.view.rejectNewsletterDesc", "Please provide feedback explaining why this newsletter is being rejected. The creator will see your notes and can make adjustments.")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t("newsletter.view.rejectionNotes", "Rejection Notes")} <span className="text-red-500">*</span></label>
                <Textarea
                  placeholder={t("newsletter.view.rejectionPlaceholder", "Explain what needs to change before this newsletter can be approved...")}
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
                  {rejectMutation.isPending ? t("newsletter.view.rejecting", "Rejecting...") : t("newsletter.view.rejectNewsletter", "Reject Newsletter")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
