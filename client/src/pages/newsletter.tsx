import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Plus,
  Mail,
  Calendar,
  Eye,
  Clock,
  Users,
  MousePointer,
  Search,
  LayoutDashboard,
  Trash2,
  Send,
  FileText,
  MoreVertical,
  Pencil,
  Loader2,
  UserCog,
  ShieldCheck,
  ClipboardCheck,
  CalendarClock,
  ExternalLink,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Undo2,
  XCircle,
  RefreshCw
} from "lucide-react";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useRealtimeNewsletters } from "@/hooks/useRealtimeNewsletters";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { SendNewsletterWizardModal } from "@/components/SendNewsletterWizardModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector } from "@/store";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { EditorPickerModal } from "@/components/EditorPickerModal";
import { format, formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale/es";
import type { NewsletterWithUser } from "@shared/schema";

type NewsletterListItem = NewsletterWithUser & {
  opens?: number;
  totalOpens?: number;
  publishedAt?: string | null;
  webSlug?: string | null;
};

const getStatusBadge = (status: string, t: any) => {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"><FileText className="h-3 w-3 mr-1" />{t('newsletter.status.draft')}</Badge>;
    case 'ready_to_send':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><Send className="h-3 w-3 mr-1" />{t('newsletter.status.readyToSend')}</Badge>;
    case 'pending_review':
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"><ShieldCheck className="h-3 w-3 mr-1" />{t('newsletter.status.pendingReview')}</Badge>;
    case 'scheduled':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><Clock className="h-3 w-3 mr-1" />{t('newsletter.status.scheduled')}</Badge>;
    case 'sending':
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"><Send className="h-3 w-3 mr-1 animate-pulse" />{t('newsletter.status.sending')}</Badge>;
    case 'sent':
      return <Badge variant="default" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"><Send className="h-3 w-3 mr-1" />{t('newsletter.status.sent')}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function NewsletterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewNewsletter, setPreviewNewsletter] = useState<NewsletterListItem | null>(null);
  const [editRecipientsNewsletter, setEditRecipientsNewsletter] = useState<NewsletterListItem | null>(null);
  const [showEditorPicker, setShowEditorPicker] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const { user } = useReduxAuth();
  const currentUserId = (user as any)?.id;
  const tenantId = (user as any)?.tenantId as string | undefined;
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const dateFnsLocale = currentLanguage === 'es' ? { locale: esLocale } : {};

  useSetBreadcrumbs([
    { label: t("newsletter.breadcrumbDashboard", "Dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("newsletter.breadcrumbNewsletters", "Email Newsletters"), icon: Mail }
  ]);

  const { data: newslettersData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/newsletters', { emailType: 'newsletter', shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletters?emailType=newsletter');
      const data = await response.json();
      return data.newsletters || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const handleRefresh = useCallback(() => {
    if (refreshCooldown || isLoading) return;
    refetch();
    setLastRefreshed(new Date());
    setRefreshCooldown(true);
    cooldownTimer.current = setTimeout(() => setRefreshCooldown(false), 5000);
  }, [refreshCooldown, isLoading, refetch]);

  // Fetch reviewer settings to know if reviewer workflow is enabled
  const { data: reviewerSettings } = useQuery<{ enabled: boolean; reviewerId: string | null; reviewer: any }>({
    queryKey: ['/api/newsletters/reviewer-settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletters/reviewer-settings');
      return response.json();
    },
  });

  const reviewerEnabled = reviewerSettings?.enabled ?? false;
  const isCurrentUserDesignatedReviewer = reviewerSettings?.reviewerId === currentUserId;

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
      if (!response.ok) {
        throw new Error("Failed to fetch email design");
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/newsletters/${id}`);
    },
    onSuccess: (_data, id) => {
      // Remove from cache immediately so the card doesn't briefly reappear before refetch completes
      queryClient.setQueryData<NewsletterListItem[]>(
        ['/api/newsletters', { emailType: 'newsletter' }],
        (old) => old ? old.filter((n) => n.id !== id) : []
      );
      queryClient.setQueryData<NewsletterListItem[]>(
        ['/api/newsletters', { emailType: 'newsletter', archived: true }],
        (old) => old ? old.filter((n) => n.id !== id) : []
      );
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({ title: t("newsletter.toast.deleted"), description: t("newsletter.toast.deletedDesc") });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: t("newsletter.toast.error"), description: error.message || t("newsletter.toast.deleteError"), variant: "destructive" });
    },
  });

  const deployMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/send`);
      return response.json();
    },
    onSuccess: (data: any, variables: string) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: t("newsletter.toast.deployed"),
        description: data.message || t("newsletter.toast.deployedDesc")
      });
      setLocation(`/newsletters/${data.newsletterId || data.id || variables}`);
    },
    onError: (error: any) => {
      toast({
        title: t("newsletter.toast.deployFailed"),
        description: error.message || t("newsletter.toast.deployFailedDesc"),
        variant: "destructive"
      });
    },
  });

  // Cancel schedule mutation
  const cancelScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/cancel-schedule`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: t("newsletter.toast.scheduleCancelled"),
        description: t("newsletter.toast.scheduleCancelledDesc")
      });
    },
    onError: (error: any) => {
      toast({
        title: t("newsletter.toast.cancelFailed"),
        description: error.message || t("newsletter.toast.cancelFailedDesc"),
        variant: "destructive"
      });
    },
  });

  // Submit for review mutation
  const submitForReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/submit-for-review`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: t("newsletter.toast.submittedForReview"),
        description: data.message || t("newsletter.toast.submittedForReviewDesc")
      });
    },
    onError: (error: any) => {
      toast({
        title: t("newsletter.toast.submissionFailed"),
        description: error.message || t("newsletter.toast.submissionFailedDesc"),
        variant: "destructive"
      });
    },
  });

  // Recall to draft mutation
  const recallToDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/recall-review`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({
        title: t("newsletter.toast.recalledToDraft", "Recalled to Draft"),
        description: t("newsletter.toast.recalledToDraftDesc", "Newsletter has been recalled from review and returned to draft."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("newsletter.toast.recallFailed", "Recall Failed"),
        description: error.message || t("newsletter.toast.recallFailedDesc", "Failed to recall newsletter from review."),
        variant: "destructive",
      });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/newsletters/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({ title: t("newsletter.toast.archived", "Archived"), description: t("newsletter.toast.archivedDesc", "Newsletter has been archived.") });
    },
    onError: (error: any) => {
      toast({ title: t("newsletter.toast.error"), description: error.message || t("newsletter.toast.archiveError", "Failed to archive newsletter"), variant: "destructive" });
    },
  });

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/newsletters/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({ title: t("newsletter.toast.unarchived", "Unarchived"), description: t("newsletter.toast.unarchivedDesc", "Newsletter has been restored from the archive.") });
    },
    onError: (error: any) => {
      toast({ title: t("newsletter.toast.error"), description: error.message || t("newsletter.toast.unarchiveError", "Failed to unarchive newsletter"), variant: "destructive" });
    },
  });

  // Fetch archived newsletters
  const { data: archivedNewslettersData } = useQuery({
    queryKey: ['/api/newsletters', { emailType: 'newsletter', archived: true, shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletters?emailType=newsletter&archived=true');
      const data = await response.json();
      return data.newsletters || [];
    },
    enabled: showArchived,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Layer Convex real-time data on top of archived TanStack Query data
  const { newsletters: realtimeArchivedNewsletters } = useRealtimeNewsletters(archivedNewslettersData, tenantId, selectedShopId, true, "newsletter");
  const archivedNewsletters: NewsletterListItem[] = realtimeArchivedNewsletters || [];

  const handleEditRecipientsSegmentSelected = async (segmentData: {
    segmentListId: string | null;
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => {
    if (!editRecipientsNewsletter) return;
    try {
      await apiRequest('PUT', `/api/newsletters/${editRecipientsNewsletter.id}`, {
        recipientType: segmentData.recipientType,
        selectedContactIds: segmentData.selectedContactIds,
        selectedTagIds: segmentData.selectedTagIds,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({ title: t("newsletter.toast.recipientsUpdated"), description: t("newsletter.toast.recipientsUpdatedDesc") });
      setEditRecipientsNewsletter(null);
    } catch (error: any) {
      toast({
        title: t("newsletter.toast.error"),
        description: error.message || t("newsletter.toast.recipientsError"),
        variant: "destructive",
      });
    }
  };

  // Layer Convex real-time data on top of TanStack Query data for instant kanban updates
  const { newsletters: realtimeNewsletters } = useRealtimeNewsletters(newslettersData, tenantId, selectedShopId, false, "newsletter");
  const newsletters: NewsletterListItem[] = realtimeNewsletters || [];

  const filteredNewsletters = useMemo(() => {
    return newsletters.filter((newsletter) => {
      return searchQuery === "" ||
        newsletter.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        newsletter.subject.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [newsletters, searchQuery]);

  const kanbanColumns = useMemo(() => {
    const drafts = filteredNewsletters.filter(n => n.status === 'draft');
    const readyToSend = filteredNewsletters.filter(n => ['ready_to_send', 'pending_review'].includes(n.status));
    const scheduled = filteredNewsletters.filter(n => ['scheduled', 'sending'].includes(n.status));
    const sent = filteredNewsletters.filter(n => n.status === 'sent');
    return [
      {
        key: 'drafts',
        title: t('newsletter.kanban.drafts', 'Drafts'),
        icon: FileText,
        color: 'amber',
        borderColor: 'border-amber-300 dark:border-amber-700',
        bgHeader: 'bg-amber-50 dark:bg-amber-950/40',
        textColor: 'text-amber-700 dark:text-amber-300',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
        accentBar: 'bg-amber-400',
        items: drafts,
      },
      {
        key: 'ready_to_send',
        title: t('newsletter.kanban.readyToSend', 'Ready to Send'),
        icon: Send,
        color: 'blue',
        borderColor: 'border-blue-300 dark:border-blue-700',
        bgHeader: 'bg-blue-50 dark:bg-blue-950/40',
        textColor: 'text-blue-700 dark:text-blue-300',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
        accentBar: 'bg-blue-400',
        items: readyToSend,
      },
      {
        key: 'scheduled',
        title: t('newsletter.kanban.scheduled', 'Scheduled'),
        icon: Clock,
        color: 'purple',
        borderColor: 'border-purple-300 dark:border-purple-700',
        bgHeader: 'bg-purple-50 dark:bg-purple-950/40',
        textColor: 'text-purple-700 dark:text-purple-300',
        badgeBg: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
        accentBar: 'bg-purple-400',
        items: scheduled,
      },
      {
        key: 'sent',
        title: t('newsletter.kanban.sent', 'Sent'),
        icon: Mail,
        color: 'green',
        borderColor: 'border-green-300 dark:border-green-700',
        bgHeader: 'bg-green-50 dark:bg-green-950/40',
        textColor: 'text-green-700 dark:text-green-300',
        badgeBg: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
        accentBar: 'bg-green-400',
        items: sent,
      },
    ];
  }, [filteredNewsletters, t]);


  const parsedSocialLinks = useMemo(() => {
    const raw = emailDesign?.socialLinks;
    if (!raw) return undefined;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    return raw;
  }, [emailDesign]);

  const wrappedPreviewHtml = useMemo(() => {
    if (!previewNewsletter) {
      return "";
    }

    return wrapInEmailPreview(previewNewsletter.content || "", {
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
  }, [previewNewsletter, emailDesign, parsedSocialLinks]);

  if (error) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">{t("newsletter.error.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              {error instanceof Error ? error.message : t("newsletter.error.loadFailed")}
            </p>
            <Button onClick={() => refetch()}>{t("newsletter.error.tryAgain")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              {t("newsletter.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t("newsletter.subtitle")}
            </p>
          </div>
          <Button onClick={() => setShowEditorPicker(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            {t("newsletter.createNew", "Create Newsletter")}
          </Button>
        </div>


        {/* Search and Refresh */}
        {newsletters.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t("newsletter.searchPlaceholder", "Search newsletters...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t("newsletter.lastUpdated", "Updated")} {format(lastRefreshed, currentLanguage === 'es' ? 'h:mm:ss a' : 'h:mm:ss a', { locale: currentLanguage === 'es' ? esLocale : undefined })}
                </span>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading || refreshCooldown}
                title={t("newsletter.refresh", "Refresh newsletters")}
                className="rounded-xl h-[42px] w-[42px] border-gray-200 dark:border-gray-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        {newsletters.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("newsletter.noNewslettersYet")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              {t("newsletter.noNewslettersDesc")}
            </p>
            <Button onClick={() => setShowEditorPicker(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              {t("newsletter.createFirst")}
            </Button>
          </div>
        ) : filteredNewsletters.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("newsletter.noNewslettersFound")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t("newsletter.noNewslettersFoundDesc")}
            </p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              {t("newsletter.clearFilters")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {kanbanColumns.map((column) => (
              <div
                key={column.key}
                className={`flex flex-col rounded-xl border ${column.borderColor} bg-gray-50/60 dark:bg-gray-900/40 overflow-hidden`}
              >
                {/* Column Header */}
                <div className={`${column.bgHeader} px-4 py-3 border-b ${column.borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${column.accentBar}`} />
                      <column.icon className={`h-4 w-4 ${column.textColor}`} />
                      <h3 className={`text-sm font-semibold ${column.textColor}`}>
                        {column.title}
                      </h3>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.badgeBg}`}>
                      {column.items.length}
                    </span>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-380px)] min-h-[200px]">
                  {column.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className={`w-10 h-10 rounded-xl ${column.bgHeader} flex items-center justify-center mb-3`}>
                        <column.icon className={`h-5 w-5 ${column.textColor} opacity-50`} />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                        {t('newsletter.kanban.empty', 'No newsletters here')}
                      </p>
                    </div>
                  ) : (
                    column.items.map((newsletter) => {
                      const openRate = (newsletter.recipientCount || 0) > 0
                        ? ((newsletter.opens || 0) / (newsletter.recipientCount || 1) * 100).toFixed(1)
                        : "0";
                      const isDraft = newsletter.status === 'draft';
                      const isSent = newsletter.status === 'sent';
                      const isReadyToSend = newsletter.status === 'ready_to_send';
                      const isPendingReview = newsletter.status === 'pending_review';
                      const isScheduled = newsletter.status === 'scheduled';
                      const isCurrentUserReviewer = newsletter.reviewerId === currentUserId;
                      const tenantSlug = (newsletter as any)?.tenant?.slug;
                      const articlePreviewUrl = tenantSlug ? `/n/preview/${tenantSlug}/${newsletter.id}` : null;

                      const isDeleting = deleteMutation.isPending && deleteMutation.variables === newsletter.id;
                      const isDeploying = deployMutation.isPending && deployMutation.variables === newsletter.id;
                      const isSubmittingForReview = submitForReviewMutation.isPending && submitForReviewMutation.variables === newsletter.id;
                      const isCancellingSchedule = cancelScheduleMutation.isPending && cancelScheduleMutation.variables === newsletter.id;

                      if (isDeleting) {
                        return (
                          <Card key={newsletter.id} className="flex flex-col items-center justify-center border-dashed border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 animate-pulse py-8">
                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-3" />
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t("newsletter.card.deleting")}</p>
                          </Card>
                        );
                      }

                      return (
                        <Card
                          key={newsletter.id}
                          className={`group relative rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer bg-white dark:bg-gray-800 border-t-[3px] ${newsletter.status === 'sent' ? 'border-t-green-500' :
                            newsletter.status === 'ready_to_send' ? 'border-t-blue-500' :
                              newsletter.status === 'pending_review' ? 'border-t-orange-500' :
                                newsletter.status === 'scheduled' ? 'border-t-purple-500' :
                                  newsletter.status === 'sending' ? 'border-t-purple-500' :
                                    'border-t-amber-400'
                            } border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600`}
                          onClick={() => (isDraft || isReadyToSend)
                            ? setLocation(`/newsletter/create/${newsletter.id}`)
                            : setLocation(`/newsletters/${newsletter.id}`)
                          }
                        >
                          <CardContent className="p-5">
                            <div className="space-y-4">
                              {/* Row 1: Status badge + kebab menu */}
                              <div className="flex items-center justify-between">
                                {getStatusBadge(newsletter.status, t)}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" aria-label="Newsletter actions" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewNewsletter(newsletter);
                                      }}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      {t("newsletter.actions.preview")}
                                    </DropdownMenuItem>
                                    {articlePreviewUrl && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(articlePreviewUrl, '_blank', 'noopener,noreferrer');
                                        }}
                                      >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Preview article on blog
                                      </DropdownMenuItem>
                                    )}
                                    {(isDraft || isReadyToSend) && newsletter.reviewStatus !== 'approved' && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLocation(`/newsletter/create/${newsletter.id}`);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4 mr-2" />
                                        {t("newsletter.actions.edit")}
                                      </DropdownMenuItem>
                                    )}
                                    {(isDraft || isReadyToSend) && newsletter.reviewStatus !== 'approved' && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditRecipientsNewsletter(newsletter);
                                        }}
                                        data-testid={`button-edit-recipients-${newsletter.id}`}
                                      >
                                        <UserCog className="h-4 w-4 mr-2" />
                                        {t("newsletter.actions.editRecipients")}
                                      </DropdownMenuItem>
                                    )}
                                    {isReadyToSend && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deployMutation.mutate(newsletter.id);
                                        }}
                                        disabled={isDeploying}
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        {isDeploying ? t("newsletter.actions.sending") : t("newsletter.actions.sendNow")}
                                      </DropdownMenuItem>
                                    )}
                                    {isScheduled && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          cancelScheduleMutation.mutate(newsletter.id);
                                        }}
                                        disabled={isCancellingSchedule}
                                        className="text-orange-600 focus:text-orange-600 focus:bg-orange-50 dark:focus:bg-orange-950/50"
                                      >
                                        <CalendarClock className="h-4 w-4 mr-2" />
                                        {isCancellingSchedule ? t("newsletter.actions.cancelling") : t("newsletter.actions.cancelSchedule")}
                                      </DropdownMenuItem>
                                    )}
                                    {reviewerEnabled && isReadyToSend && !isPendingReview && !isCurrentUserDesignatedReviewer && newsletter.reviewStatus !== 'approved' && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          submitForReviewMutation.mutate(newsletter.id);
                                        }}
                                        disabled={isSubmittingForReview}
                                      >
                                        <ClipboardCheck className="h-4 w-4 mr-2" />
                                        {isSubmittingForReview ? t("newsletter.actions.submitting") : t("newsletter.actions.submitForReview")}
                                      </DropdownMenuItem>
                                    )}
                                    {isPendingReview && isCurrentUserReviewer && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLocation(`/newsletters/${newsletter.id}`);
                                        }}
                                      >
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        {t("newsletter.actions.reviewNewsletter")}
                                      </DropdownMenuItem>
                                    )}
                                    {isPendingReview && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          recallToDraftMutation.mutate(newsletter.id);
                                        }}
                                        disabled={recallToDraftMutation.isPending && recallToDraftMutation.variables === newsletter.id}
                                        className="text-orange-600 focus:text-orange-600 focus:bg-orange-50 dark:focus:bg-orange-950/50"
                                      >
                                        <Undo2 className="h-4 w-4 mr-2" />
                                        {recallToDraftMutation.isPending && recallToDraftMutation.variables === newsletter.id
                                          ? t("newsletter.actions.recalling", "Recalling...")
                                          : t("newsletter.actions.recallToDraft", "Recall to Draft")}
                                      </DropdownMenuItem>
                                    )}
                                    {isSent && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          archiveMutation.mutate(newsletter.id);
                                        }}
                                        disabled={archiveMutation.isPending && archiveMutation.variables === newsletter.id}
                                      >
                                        <Archive className="h-4 w-4 mr-2" />
                                        {archiveMutation.isPending && archiveMutation.variables === newsletter.id
                                          ? t("newsletter.actions.archiving", "Archiving...")
                                          : t("newsletter.actions.archive", "Archive")}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteId(newsletter.id);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t("newsletter.actions.delete")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Row 2: Title + Subject */}
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                  {newsletter.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                                  {newsletter.subject}
                                </p>
                              </div>

                              {/* Rejection notice */}
                              {newsletter.reviewStatus === 'rejected' && newsletter.reviewNotes && (
                                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-3 py-2">
                                  <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">{t("newsletter.card.rejected", "Rejected by reviewer")}</p>
                                    <p className="text-[11px] text-red-600/80 dark:text-red-400/70 line-clamp-2 mt-0.5">{newsletter.reviewNotes}</p>
                                  </div>
                                </div>
                              )}

                              {/* Row 4: Author + Date (with top divider) */}
                              <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
                                    {(newsletter.user?.firstName?.[0] || '')}{(newsletter.user?.lastName?.[0] || '')}
                                  </div>
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                      {newsletter.user?.firstName || ''} {newsletter.user?.lastName || ''}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                      {newsletter.sentAt
                                        ? formatDistanceToNow(new Date(newsletter.sentAt), { addSuffix: true, ...dateFnsLocale })
                                        : newsletter.createdAt
                                          ? formatDistanceToNow(new Date(newsletter.createdAt), { addSuffix: true, ...dateFnsLocale })
                                          : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Row 5: Bottom info (with top divider) */}
                              {isSent ? (
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Users className="h-3 w-3 text-blue-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                        {(newsletter.recipientCount || 0).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{t("newsletter.metrics.sent")}</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Eye className="h-3 w-3 text-green-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                        {newsletter.opens || 0}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{t("newsletter.metrics.opened", { rate: openRate })}</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <MousePointer className="h-3 w-3 text-purple-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                        {newsletter.clickCount || 0}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{t("newsletter.metrics.clicks")}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    {newsletter.status === 'scheduled' && newsletter.scheduledAt ? (
                                      <span className="truncate">{t("newsletter.card.scheduledFor", { date: t("newsletter.card.dateTimeAt", { date: format(new Date(newsletter.scheduledAt), 'MMM d, yyyy', { locale: currentLanguage === 'es' ? esLocale : undefined }), time: format(new Date(newsletter.scheduledAt), 'h:mm a', { locale: currentLanguage === 'es' ? esLocale : undefined }) }) })}</span>
                                    ) : (
                                      <span className="truncate">{newsletter.updatedAt ? t("newsletter.card.lastEdited", { time: formatDistanceToNow(new Date(newsletter.updatedAt), { addSuffix: true, ...dateFnsLocale }) }) : t("newsletter.card.lastEditedRecently")}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Archived Newsletters Section */}
        {newsletters.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors group"
            >
              {showArchived ? (
                <ChevronDown className="h-4 w-4 transition-transform" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform" />
              )}
              <Archive className="h-4 w-4" />
              <span>{showArchived ? t('newsletter.archived.hideArchived', 'Hide Archived') : t('newsletter.archived.showArchived', 'Show Archived')}</span>
              {showArchived && archivedNewsletters.length > 0 && (
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                  {archivedNewsletters.length}
                </span>
              )}
            </button>

            {showArchived && (
              <div className="mt-4">
                {archivedNewsletters.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
                    <Archive className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      {t('newsletter.archived.empty', 'No archived newsletters')}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                      {t('newsletter.archived.emptyDesc', 'Newsletters you archive from the Sent column will appear here.')}
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {t('newsletter.archived.title', 'Archived Newsletters')}
                        </h3>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          — {t('newsletter.archived.subtitle', 'Sent newsletters that have been archived')}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-700/50">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('newsletter.archived.name', 'Name')}
                            </th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('newsletter.archived.subject', 'Subject')}
                            </th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('newsletter.archived.sentDate', 'Sent Date')}
                            </th>
                            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('newsletter.archived.recipients', 'Recipients')}
                            </th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('newsletter.archived.archivedDate', 'Archived Date')}
                            </th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('newsletter.archived.actions', 'Actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {archivedNewsletters.map((newsletter) => (
                            <tr
                              key={newsletter.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                              onClick={() => setLocation(`/newsletters/${newsletter.id}`)}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                    {(newsletter.user?.firstName?.[0] || '')}{(newsletter.user?.lastName?.[0] || '')}
                                  </div>
                                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                                    {newsletter.title}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                {newsletter.subject}
                              </td>
                              <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {newsletter.sentAt
                                  ? format(new Date(newsletter.sentAt), 'MMM d, yyyy', { locale: currentLanguage === 'es' ? esLocale : undefined })
                                  : '—'}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <Users className="h-3 w-3" />
                                  {(newsletter.recipientCount || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {(newsletter as any).archivedAt
                                  ? formatDistanceToNow(new Date((newsletter as any).archivedAt), { addSuffix: true, ...dateFnsLocale })
                                  : '—'}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewNewsletter(newsletter);
                                    }}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                                    disabled={unarchiveMutation.isPending && unarchiveMutation.variables === newsletter.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      unarchiveMutation.mutate(newsletter.id);
                                    }}
                                  >
                                    <ArchiveRestore className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("newsletter.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("newsletter.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("newsletter.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              {t("newsletter.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendNewsletterWizardModal
        isOpen={!!editRecipientsNewsletter}
        onClose={() => setEditRecipientsNewsletter(null)}
        newsletterId={editRecipientsNewsletter?.id || null}
        newsletterTitle={editRecipientsNewsletter?.title || ""}
        newsletterReviewStatus={(editRecipientsNewsletter as any)?.reviewStatus}
        onSegmentSelected={handleEditRecipientsSegmentSelected}
        initialRecipientType={editRecipientsNewsletter?.recipientType as "all" | "selected" | "tags" | undefined}
        initialSelectedContactIds={editRecipientsNewsletter?.selectedContactIds || []}
        initialSelectedTagIds={editRecipientsNewsletter?.selectedTagIds || []}
      />

      <Dialog open={!!previewNewsletter} onOpenChange={(open) => !open && setPreviewNewsletter(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t("newsletter.previewDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("newsletter.previewDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full">
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-16">{t("newsletter.previewDialog.subject")}</span>
                    <span className="text-gray-900 font-semibold truncate">
                      {previewNewsletter?.subject || previewNewsletter?.title || t("newsletter.previewDialog.noSubject")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-16">{t("newsletter.previewDialog.status")}</span>
                    <span className="text-gray-900 capitalize">{(() => {
                      const s = previewNewsletter?.status || 'draft';
                      const keyMap: Record<string, string> = {
                        ready_to_send: 'readyToSend',
                        pending_review: 'pendingReview',
                      };
                      const i18nKey = `newsletter.status.${keyMap[s] ?? s}`;
                      return t(i18nKey, s);
                    })()}</span>
                  </div>
                </div>

                <iframe
                  srcDoc={wrappedPreviewHtml}
                  title="Newsletter content preview"
                  sandbox="allow-same-origin"
                  className="w-full border-0"
                  style={{ minHeight: "640px", background: "#fff" }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditorPickerModal open={showEditorPicker} onOpenChange={setShowEditorPicker} />
    </>
  );
}
