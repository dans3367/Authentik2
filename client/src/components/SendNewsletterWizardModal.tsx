import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Tag, User, Check, Search, CheckCircle, ChevronRight, ChevronLeft, Send, ListChecks, Clock, ArrowRight, Mail, ShieldCheck, CalendarClock, X, Smile, Globe, AlertTriangle, Loader2, KeyRound, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { SegmentList } from "@shared/schema";
import type { ModerationViolation } from "@shared/contentModeration";

interface SendNewsletterWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  newsletterId: string | null;
  newsletterTitle: string;
  newsletterReviewStatus?: string | null;
  shopId?: string | null;
  onSegmentSelected: (data: {
    segmentListId: string | null;
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => void;
  initialRecipientType?: "all" | "selected" | "tags";
  initialSelectedContactIds?: string[];
  initialSelectedTagIds?: string[];
  reactionsEnabled?: boolean;
  onReactionsEnabledChange?: (enabled: boolean) => void;
  publishToBlog?: boolean;
  onPublishToBlogChange?: (enabled: boolean) => void;
  itemLabel?: string;
  returnPath?: string;
}

interface SegmentListWithCount extends SegmentList {
  contactCount?: number;
}

export function SendNewsletterWizardModal({
  isOpen,
  onClose,
  onSuccess,
  newsletterId,
  newsletterTitle,
  newsletterReviewStatus,
  shopId,
  onSegmentSelected,
  initialRecipientType,
  initialSelectedContactIds,
  initialSelectedTagIds,
  reactionsEnabled = true,
  onReactionsEnabledChange,
  publishToBlog = true,
  onPublishToBlogChange,
  itemLabel = "Newsletter",
  returnPath = '/newsletter',
}: SendNewsletterWizardModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectionMode, setSelectionMode] = useState<"segment_list" | "custom">("segment_list");
  const [selectedSegmentListId, setSelectedSegmentListId] = useState<string | null>(null);
  const [customRecipientType, setCustomRecipientType] = useState<"all" | "selected" | "tags">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSavingLater, setIsSavingLater] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isCheckingModeration, setIsCheckingModeration] = useState(false);
  const [moderationViolations, setModerationViolations] = useState<ModerationViolation[]>([]);
  const [showModerationDialog, setShowModerationDialog] = useState(false);
  // Send confirmation state (password/2FA verification before send)
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [confirmationCredential, setConfirmationCredential] = useState("");
  const [isVerifyingCredential, setIsVerifyingCredential] = useState(false);
  const [sendAuthToken, setSendAuthToken] = useState<string | null>(null);
  const [pendingSendAction, setPendingSendAction] = useState<"send" | "schedule" | null>(null);
  const prevIsOpen = useRef(isOpen);

  const shopParam = shopId ? `?shopId=${shopId}` : '';

  const { data: segmentListsData, isLoading: segmentListsLoading } = useQuery({
    queryKey: ["/api/segment-lists", { shopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/segment-lists${shopParam}`);
      return response.json();
    },
    enabled: isOpen,
  });

  const contactsShopParam = shopId ? `&shopId=${shopId}` : '';
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/email-contacts", { shopId, status: "active" }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/email-contacts?status=active${contactsShopParam}`);
      return response.json();
    },
    enabled: isOpen && selectionMode === "custom" && customRecipientType === "selected",
  });

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ["/api/contact-tags", { shopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/contact-tags${shopParam}`);
      return response.json();
    },
    enabled: isOpen && selectionMode === "custom" && customRecipientType === "tags",
  });

  const { data: contactStatsData } = useQuery<{ stats: { activeContacts: number } }>({
    queryKey: ["/api/email-contacts", { shopId, statsOnly: true }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/email-contacts?statsOnly=true${contactsShopParam}`);
      return response.json();
    },
    enabled: isOpen,
  });

  const activeContactCount = contactStatsData?.stats?.activeContacts ?? null;

  const { data: reviewerSettings } = useQuery<{ enabled: boolean; reviewerId: string | null; reviewer: any }>({
    queryKey: ['/api/newsletters/reviewer-settings'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters/reviewer-settings");
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: sendConfirmationStatus } = useQuery<{ required: boolean; method?: 'password' | '2fa' }>({
    queryKey: ['/api/newsletters/send-confirmation-status'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters/send-confirmation-status");
      return response.json();
    },
    enabled: isOpen,
  });

  const requiresReview = (reviewerSettings?.enabled ?? false) && newsletterReviewStatus !== 'approved';

  const segmentLists: SegmentListWithCount[] = Array.isArray(segmentListsData)
    ? segmentListsData
    : (segmentListsData as any)?.lists || [];
  const contacts = (contactsData as any)?.contacts || [];
  const tags = (tagsData as any)?.tags || [];

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      const hasInitialRecipients = initialRecipientType && initialRecipientType !== "all";
      const hasInitialContacts = initialSelectedContactIds && initialSelectedContactIds.length > 0;
      const hasInitialTags = initialSelectedTagIds && initialSelectedTagIds.length > 0;
      const shouldPreselect = hasInitialRecipients || hasInitialContacts || hasInitialTags;

      setStep(1);
      setSelectionMode(shouldPreselect ? "custom" : "segment_list");
      setSelectedSegmentListId(null);
      setCustomRecipientType(initialRecipientType || "all");
      setSearchTerm("");
      setSelectedContactIds(initialSelectedContactIds || []);
      setSelectedTagIds(initialSelectedTagIds || []);
      setIsSending(false);
      setIsSavingLater(false);
      setIsScheduling(false);
      setShowSchedulePicker(false);
      setScheduleDate("");
      setScheduleTime("");
      setIsCheckingModeration(false);
      setModerationViolations([]);
      setShowModerationDialog(false);
      setShowSendConfirmation(false);
      setConfirmationCredential("");
      setIsVerifyingCredential(false);
      setSendAuthToken(null);
      setPendingSendAction(null);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialRecipientType]);

  const filteredContacts = contacts.filter((contact: any) =>
    (contact.email || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
    `${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const filteredTags = tags.filter((tag: any) =>
    (tag.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const handleContactToggle = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getSegmentData = () => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const selectedList = segmentLists.find((l) => l.id === selectedSegmentListId);
      if (selectedList) {
        return {
          segmentListId: selectedList.id,
          recipientType: selectedList.type as "all" | "selected" | "tags",
          selectedContactIds: selectedList.selectedContactIds || [],
          selectedTagIds: selectedList.selectedTagIds || [],
        };
      }
    }
    return {
      segmentListId: null,
      recipientType: customRecipientType,
      selectedContactIds: customRecipientType === "selected" ? selectedContactIds : [],
      selectedTagIds: customRecipientType === "tags" ? selectedTagIds : [],
    };
  };

  const handleGoToReview = async () => {
    if (!newsletterId) {
      setStep(2);
      return;
    }

    setIsCheckingModeration(true);
    try {
      const response = await apiRequest("GET", `/api/newsletters/${newsletterId}/moderation-check`);
      const result = await response.json();

      if (!result.passed && result.violations?.length > 0) {
        setModerationViolations(result.violations);
        setShowModerationDialog(true);
        return;
      }

      setStep(2);
    } catch (error) {
      // If moderation check fails, still allow proceeding — server will catch at send time
      setStep(2);
    } finally {
      setIsCheckingModeration(false);
    }
  };

  const handleSendNow = async (tokenOverride?: string) => {
    if (!newsletterId) return;

    // Check if send confirmation is required and we don't have a token yet
    const token = tokenOverride || sendAuthToken;
    if (sendConfirmationStatus?.required && !requiresReview && !token) {
      setPendingSendAction("send");
      setShowSendConfirmation(true);
      return;
    }

    setIsSending(true);
    try {
      const segmentData = getSegmentData();
      if (requiresReview) {
        // Save recipients and set status to ready_to_send, then submit for review
        await apiRequest('PUT', `/api/newsletters/${newsletterId}`, {
          recipientType: segmentData.recipientType,
          selectedContactIds: segmentData.selectedContactIds,
          selectedTagIds: segmentData.selectedTagIds,
          status: 'ready_to_send',
          reactionsEnabled,
        });
        await apiRequest('POST', `/api/newsletters/${newsletterId}/submit-for-review`, {});
        queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
        queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
        toast({
          title: `${itemLabel} Submitted for Review`,
          description: `Your ${itemLabel.toLowerCase()} has been submitted for reviewer approval. You'll be notified once it's approved.`,
        });
        onClose();
        onSuccess?.();
        setLocation(returnPath);
      } else {
        await apiRequest('PUT', `/api/newsletters/${newsletterId}`, {
          recipientType: segmentData.recipientType,
          selectedContactIds: segmentData.selectedContactIds,
          selectedTagIds: segmentData.selectedTagIds,
          reactionsEnabled,
        });
        await apiRequest('POST', `/api/newsletters/${newsletterId}/send`, {
          ...(token ? { sendAuthToken: token } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
        queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
        toast({
          title: `${itemLabel} Sending`,
          description: `Your ${itemLabel.toLowerCase()} is being sent to all selected recipients.`,
        });
        onClose();
        onSuccess?.();
        setLocation(`/newsletters/${newsletterId}`);
      }
    } catch (error: any) {
      toast({
        title: requiresReview
          ? t("newsletter.sendWizard.toastReviewFailed", "Review Submission Failed")
          : t("newsletter.sendWizard.toastSendFailed", "Send Failed"),
        description: error.message || `Failed to ${requiresReview ? 'submit for review' : 'send'} ${itemLabel.toLowerCase()}`,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setSendAuthToken(null);
    }
  };

  const handleScheduleSend = async (tokenOverride?: string) => {
    if (!newsletterId || !scheduleDate || !scheduleTime) return;

    // Check if send confirmation is required and we don't have a token yet
    const token = tokenOverride || sendAuthToken;
    if (sendConfirmationStatus?.required && !token) {
      setPendingSendAction("schedule");
      setShowSendConfirmation(true);
      return;
    }

    setIsScheduling(true);
    try {
      const segmentData = getSegmentData();
      // First save recipients
      await apiRequest('PUT', `/api/newsletters/${newsletterId}`, {
        recipientType: segmentData.recipientType,
        selectedContactIds: segmentData.selectedContactIds,
        selectedTagIds: segmentData.selectedTagIds,
        reactionsEnabled,
      });

      // Then schedule the send
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const response = await apiRequest('POST', `/api/newsletters/${newsletterId}/schedule`, {
        scheduledAt,
        ...(token ? { sendAuthToken: token } : {}),
      });
      const result = await response.json();

      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
      toast({
        title: `${itemLabel} Scheduled`,
        description: `Your ${itemLabel.toLowerCase()} will be sent on ${new Date(scheduledAt).toLocaleString()}.`,
      });
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: t("newsletter.sendWizard.toastScheduleFailed", "Scheduling Failed"),
        description: error.message || `Failed to schedule ${itemLabel.toLowerCase()}`,
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
      setSendAuthToken(null);
    }
  };

  // Handle send confirmation verification (password or 2FA)
  const handleConfirmationVerify = async () => {
    if (!confirmationCredential.trim()) return;
    setIsVerifyingCredential(true);
    try {
      const body: Record<string, string> = {};
      if (sendConfirmationStatus?.method === '2fa') {
        body.totpCode = confirmationCredential;
      } else {
        body.password = confirmationCredential;
      }

      const response = await apiRequest('POST', '/api/newsletters/verify-send-auth', body);
      const result = await response.json();

      if (result.sendAuthToken) {
        setSendAuthToken(result.sendAuthToken);
        setShowSendConfirmation(false);
        setConfirmationCredential("");

        // Retry the pending action with the token
        if (pendingSendAction === "send") {
          handleSendNow(result.sendAuthToken);
        } else if (pendingSendAction === "schedule") {
          handleScheduleSend(result.sendAuthToken);
        }
        setPendingSendAction(null);
      }
    } catch (error: any) {
      toast({
        title: t("newsletter.sendWizard.verificationFailed", "Verification Failed"),
        description: error.message || t("newsletter.sendWizard.verificationFailedDesc", "Incorrect password or 2FA code. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsVerifyingCredential(false);
    }
  };

  const getMinDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  const getMinTime = () => {
    if (!scheduleDate) return "";
    const now = new Date();
    const selectedDate = new Date(scheduleDate);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (selectedDate.getTime() === today.getTime()) {
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes() + 5).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return "00:00";
  };

  const isScheduleValid = () => {
    if (!scheduleDate || !scheduleTime) return false;
    const scheduled = new Date(`${scheduleDate}T${scheduleTime}`);
    return scheduled > new Date();
  };

  const handleSendLater = async () => {
    if (!newsletterId) return;
    setIsSavingLater(true);
    try {
      const segmentData = getSegmentData();
      await apiRequest('PUT', `/api/newsletters/${newsletterId}`, {
        recipientType: segmentData.recipientType,
        selectedContactIds: segmentData.selectedContactIds,
        selectedTagIds: segmentData.selectedTagIds,
        status: 'ready_to_send',
        reactionsEnabled,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
      toast({
        title: t("newsletter.sendWizard.toastSavedForLater", "Saved for Later"),
        description: `Your ${itemLabel.toLowerCase()} is ready to send. You can send it anytime from the list.`,
      });
      onClose();
      onSuccess?.();
      setLocation(returnPath);
    } catch (error: any) {
      toast({
        title: t("newsletter.sendWizard.toastSaveError", "Error"),
        description: error.message || `Failed to save ${itemLabel.toLowerCase()}`,
        variant: "destructive",
      });
    } finally {
      setIsSavingLater(false);
    }
  };

  const canContinue = () => {
    if (selectionMode === "segment_list") {
      if (!selectedSegmentListId) return false;
      const selectedList = segmentLists.find((l) => l.id === selectedSegmentListId);
      return selectedList ? (selectedList.contactCount || 0) > 0 : false;
    }
    if (selectionMode === "custom") {
      if (customRecipientType === "all") return activeContactCount !== null && activeContactCount > 0;
      if (customRecipientType === "selected") return selectedContactIds.length > 0;
      if (customRecipientType === "tags") return selectedTagIds.length > 0;
    }
    return false;
  };

  const getNoContactsWarning = (): string | null => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const selectedList = segmentLists.find((l) => l.id === selectedSegmentListId);
      if (selectedList && (selectedList.contactCount || 0) === 0) {
        return t("newsletter.sendWizard.noContactsInList", "This segment list has no contacts. Add contacts to the list before sending.");
      }
    }
    if (selectionMode === "custom" && customRecipientType === "all" && activeContactCount === 0) {
      return t("newsletter.sendWizard.noActiveContacts", "You have no active contacts. Add contacts before sending.");
    }
    return null;
  };

  const getRecipientSummary = () => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const list = segmentLists.find((l) => l.id === selectedSegmentListId);
      return list ? t("newsletter.sendWizard.segmentListSummary", "{{name}} ({{count}} recipients)", { name: list.name, count: list.contactCount || 0 }) : "";
    }
    if (selectionMode === "custom") {
      if (customRecipientType === "all") return contacts.length > 0 ? t("newsletter.sendWizard.allCustomersSummary", "All customers ({{count}})", { count: contacts.length }) : t("newsletter.sendWizard.allCustomersSummaryNoCount", "All customers");
      if (customRecipientType === "selected") return t("newsletter.sendWizard.selectedCustomersSummary", "{{count}} selected customers", { count: selectedContactIds.length });
      if (customRecipientType === "tags") return t("newsletter.sendWizard.tagsSelectedSummary", "{{count}} tags selected", { count: selectedTagIds.length });
    }
    return "";
  };

  const getRecipientTypeLabel = () => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const list = segmentLists.find((l) => l.id === selectedSegmentListId);
      return list ? t("newsletter.sendWizard.segmentList", "Segment List") : "";
    }
    if (customRecipientType === "all") return t("newsletter.sendWizard.allCustomersLabel", "All Customers");
    if (customRecipientType === "selected") return t("newsletter.sendWizard.selectedCustomers", "Selected Customers");
    if (customRecipientType === "tags") return t("newsletter.sendWizard.byTagsLabel", "By Tags");
    return "";
  };

  const getRecipientCount = () => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const list = segmentLists.find((l) => l.id === selectedSegmentListId);
      return list?.contactCount || 0;
    }
    if (selectionMode === "custom") {
      if (customRecipientType === "all") return contacts.length || 0;
      if (customRecipientType === "selected") return selectedContactIds.length;
      if (customRecipientType === "tags") return selectedTagIds.length;
    }
    return 0;
  };

  const getSelectedTagNames = () => {
    return tags.filter((t: any) => selectedTagIds.includes(t.id)).map((t: any) => t.name);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "all": return <Users className="h-4 w-4" />;
      case "selected": return <User className="h-4 w-4" />;
      case "tags": return <Tag className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl w-[95vw] p-4 sm:p-6 md:p-8"
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'visible'
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {`Send ${itemLabel}`}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {newsletterTitle ? `"${newsletterTitle}" is ready to send` : `Select who will receive this ${itemLabel.toLowerCase()}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1 py-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 1 ? "bg-blue-600 dark:bg-blue-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
              {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
            </div>
            <span className={`text-sm font-medium ${step >= 1 ? "text-foreground" : "text-muted-foreground"}`}>{t("newsletter.sendWizard.stepSelectRecipients", "Select Recipients")}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${step === 2 ? "bg-blue-600 dark:bg-blue-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
              2
            </div>
            <span className={`text-sm ${step === 2 ? "font-medium text-foreground" : "text-muted-foreground"}`}>{t("newsletter.sendWizard.stepReviewSend", "Review & Send")}</span>
          </div>
        </div>

        <Separator className="flex-shrink-0" />

        {step === 1 && (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="flex flex-col gap-4 py-2 px-1">
              <RadioGroup
                value={selectionMode}
                onValueChange={(val) => {
                  setSelectionMode(val as "segment_list" | "custom");
                  setSearchTerm("");
                }}
                className="flex gap-3"
              >
                <Label
                  htmlFor="mode-segment"
                  className={`flex-1 flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${selectionMode === "segment_list"
                    ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/15"
                    : "border-border"
                    }`}
                >
                  <RadioGroupItem value="segment_list" id="mode-segment" />
                  <ListChecks className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="text-sm font-medium text-foreground block">{t("newsletter.sendWizard.useSegmentList", "Use Segment List")}</span>
                    <span className="text-xs text-muted-foreground">{t("newsletter.sendWizard.useSegmentListDesc", "Choose from saved audience lists")}</span>
                  </div>
                </Label>
                <Label
                  htmlFor="mode-custom"
                  className={`flex-1 flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${selectionMode === "custom"
                    ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/15"
                    : "border-border"
                    }`}
                >
                  <RadioGroupItem value="custom" id="mode-custom" />
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <span className="text-sm font-medium text-foreground block">{t("newsletter.sendWizard.customSelection", "Custom Selection")}</span>
                    <span className="text-xs text-muted-foreground">{t("newsletter.sendWizard.customSelectionDesc", "Choose recipients manually")}</span>
                  </div>
                </Label>
              </RadioGroup>

              {selectionMode === "segment_list" && (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder={t("newsletter.sendWizard.searchSegmentLists", "Search segment lists...")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-segments"
                    />
                  </div>

                  <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px' }} className="rounded-md">
                    {segmentListsLoading ? (
                      <div className="space-y-3 p-1">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : segmentLists.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <ListChecks className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-foreground">{t("newsletter.sendWizard.noSegmentListsFound", "No segment lists found")}</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                          {t("newsletter.sendWizard.noSegmentListsFoundDesc", "Create segment lists in the Segmentation page to quickly select recipients")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 p-1">
                        {segmentLists
                          .filter((list) =>
                            list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (list.description || "").toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((list) => {
                            const isSelected = selectedSegmentListId === list.id;
                            return (
                              <div
                                key={list.id}
                                className={`flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                  ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/15 shadow-sm"
                                  : "border-border hover:border-muted-foreground/30"
                                  }`}
                                onClick={() => setSelectedSegmentListId(list.id)}
                                data-testid={`segment-list-${list.id}`}
                              >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected
                                  ? "bg-blue-100 dark:bg-blue-800/40"
                                  : "bg-muted"
                                  }`}>
                                  {getTypeIcon(list.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{list.name}</p>
                                  {list.description && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{list.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {list.type === "all" ? t("newsletter.sendWizard.allCustomers", "All Customers") : list.type === "selected" ? t("newsletter.sendWizard.selected", "Selected") : t("newsletter.sendWizard.byTags", "By Tags")}
                                    </Badge>
                                    <span className={`text-[11px] ${(list.contactCount || 0) === 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                                      {(list.contactCount || 0) === 0
                                        ? t("newsletter.sendWizard.noRecipients", "No recipients")
                                        : `${list.contactCount || 0} ${t("newsletter.sendWizard.recipients", "recipients")}`}
                                    </span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="p-1 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0">
                                    <Check className="h-3.5 w-3.5 text-white dark:text-gray-900" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectionMode === "custom" && (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <RadioGroup
                    value={customRecipientType}
                    onValueChange={(val) => {
                      setCustomRecipientType(val as "all" | "selected" | "tags");
                      setSearchTerm("");
                    }}
                    className="grid grid-cols-3 gap-2"
                  >
                    <Label
                      htmlFor="type-all"
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer text-center transition-all ${customRecipientType === "all"
                        ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/15"
                        : "border-border"
                        }`}
                    >
                      <RadioGroupItem value="all" id="type-all" className="sr-only" />
                      <Users className="h-5 w-5 text-blue-500" />
                      <span className="text-xs font-medium">{t("newsletter.sendWizard.allCustomers", "All Customers")}</span>
                    </Label>
                    <Label
                      htmlFor="type-selected"
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer text-center transition-all ${customRecipientType === "selected"
                        ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/15"
                        : "border-border"
                        }`}
                    >
                      <RadioGroupItem value="selected" id="type-selected" className="sr-only" />
                      <User className="h-5 w-5 text-indigo-500" />
                      <span className="text-xs font-medium">{t("newsletter.sendWizard.selectCustomers", "Select Customers")}</span>
                    </Label>
                    <Label
                      htmlFor="type-tags"
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer text-center transition-all ${customRecipientType === "tags"
                        ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/15"
                        : "border-border"
                        }`}
                    >
                      <RadioGroupItem value="tags" id="type-tags" className="sr-only" />
                      <Tag className="h-5 w-5 text-purple-500" />
                      <span className="text-xs font-medium">{t("newsletter.sendWizard.byTags", "By Tags")}</span>
                    </Label>
                  </RadioGroup>

                  {customRecipientType === "all" && (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className={`p-3 rounded-full mb-3 ${activeContactCount === 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}>
                        {activeContactCount === 0 ? (
                          <AlertTriangle className="h-8 w-8 text-amber-500 dark:text-amber-400" />
                        ) : (
                          <Users className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                        )}
                      </div>
                      {activeContactCount === 0 ? (
                        <>
                          <p className="text-sm font-medium text-foreground">{t("newsletter.sendWizard.noActiveContactsTitle", "No Active Contacts")}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("newsletter.sendWizard.noActiveContactsDesc", "Add contacts before you can send this newsletter.")}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">{t("newsletter.sendWizard.sendToAllCustomers", "Send to All Customers")}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activeContactCount !== null
                              ? t("newsletter.sendWizard.sendToAllWithCount", "Your {{item}} will be sent to all {{count}} active customers", { item: itemLabel.toLowerCase(), count: activeContactCount })
                              : `Your ${itemLabel.toLowerCase()} will be sent to all active customers`}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {customRecipientType === "selected" && (
                    <div className="flex-1 min-h-0 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder={t("newsletter.sendWizard.searchCustomers", "Search customers...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                            data-testid="input-search-customers"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedContactIds(filteredContacts.map((c: any) => c.id))}
                          disabled={selectedContactIds.length === filteredContacts.length}
                        >
                          {t("newsletter.sendWizard.selectAll", "Select All")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedContactIds([])}
                          disabled={selectedContactIds.length === 0}
                        >
                          {t("newsletter.sendWizard.clear", "Clear")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground px-1">
                        {t("newsletter.sendWizard.selectedOfTotal", "{{selected}} of {{total}} selected", { selected: selectedContactIds.length, total: filteredContacts.length })}
                      </p>
                      <div style={{ maxHeight: '320px', overflowY: 'auto' }} className="rounded-lg border">
                        {contactsLoading ? (
                          <div className="space-y-2 p-3">
                            {[1, 2, 3].map((i) => (
                              <Skeleton key={i} className="h-12 w-full" />
                            ))}
                          </div>
                        ) : filteredContacts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Search className="h-6 w-6 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">{t("newsletter.sendWizard.noCustomersFound", "No customers found")}</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {filteredContacts.map((contact: any) => (
                              <div
                                key={contact.id}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selectedContactIds.includes(contact.id) ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                                  }`}
                                onClick={() => handleContactToggle(contact.id)}
                              >
                                <Checkbox
                                  checked={selectedContactIds.includes(contact.id)}
                                  onCheckedChange={() => handleContactToggle(contact.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {contact.firstName && contact.lastName
                                      ? `${contact.firstName} ${contact.lastName}`
                                      : contact.email}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {customRecipientType === "tags" && (
                    <div className="flex-1 min-h-0 flex flex-col gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder={t("newsletter.sendWizard.searchTags", "Search tags...")}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                          data-testid="input-search-tags"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground px-1">
                        {t("newsletter.sendWizard.tagsSelectedOfTotal", "{{selected}} of {{total}} tags selected", { selected: selectedTagIds.length, total: filteredTags.length })}
                      </p>
                      <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '6px' }} className="rounded-md">
                        {tagsLoading ? (
                          <div className="space-y-2 p-3">
                            {[1, 2, 3].map((i) => (
                              <Skeleton key={i} className="h-14 w-full rounded-lg" />
                            ))}
                          </div>
                        ) : filteredTags.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Tag className="h-6 w-6 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">{t("newsletter.sendWizard.noTagsFound", "No tags found")}</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 p-1">
                            {filteredTags.map((tag: any) => {
                              const isSelected = selectedTagIds.includes(tag.id);
                              return (
                                <div
                                  key={tag.id}
                                  className={`flex items-center gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                    ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                                    : "border-border"
                                    }`}
                                  onClick={() => handleTagToggle(tag.id)}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tag.color || "#9ca3af" }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-foreground block truncate">{tag.name}</span>
                                    <span className="text-[11px] text-muted-foreground">
                                      {tag.contactCount || 0} {t("newsletter.sendWizard.customers", "customers")}
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <div className="p-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full flex-shrink-0">
                                      <Check className="h-3 w-3 text-white dark:text-gray-900" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator className="flex-shrink-0" />

            <DialogFooter className="flex-row items-center justify-between gap-4 sm:justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                {canContinue() ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="truncate">{getRecipientSummary()}</span>
                  </>
                ) : getNoContactsWarning() ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span className="truncate text-amber-600 dark:text-amber-400">{getNoContactsWarning()}</span>
                  </>
                ) : null}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" onClick={onClose} data-testid="button-cancel-wizard">
                  {t("newsletter.sendWizard.cancel", "Cancel")}
                </Button>
                <Button
                  onClick={handleGoToReview}
                  disabled={!canContinue() || isCheckingModeration}
                  data-testid="button-continue-wizard"
                >
                  {isCheckingModeration ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("newsletter.sendWizard.checking", "Checking...")}
                    </span>
                  ) : (
                    <>
                      {t("newsletter.sendWizard.continue", "Continue")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="flex flex-col gap-5 py-3 px-1">
              <div className="rounded-lg border p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{itemLabel}</p>
                    <p className="text-xs text-muted-foreground">{t("newsletter.sendWizard.detailsAboutSend", "Details about what will be sent")}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">{t("newsletter.sendWizard.titleLabel", "Title")}</span>
                    <span className="text-sm font-medium text-foreground text-right truncate" data-testid="text-review-title">
                      {newsletterTitle || `Untitled ${itemLabel}`}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">{t("newsletter.sendWizard.selectionMethod", "Selection Method")}</span>
                    <span className="text-sm font-medium text-foreground text-right">
                      {selectionMode === "segment_list" ? t("newsletter.sendWizard.segmentList", "Segment List") : t("newsletter.sendWizard.customSelection", "Custom Selection")}
                    </span>
                  </div>
                  {selectionMode === "segment_list" && selectedSegmentListId && (
                    <>
                      <Separator />
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm text-muted-foreground flex-shrink-0">{t("newsletter.sendWizard.segmentList", "Segment List")}</span>
                        <span className="text-sm font-medium text-foreground text-right">
                          {segmentLists.find((l) => l.id === selectedSegmentListId)?.name || ""}
                        </span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">{t("newsletter.sendWizard.recipientType", "Recipient Type")}</span>
                    <Badge variant="outline" data-testid="badge-recipient-type">
                      {getRecipientTypeLabel()}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">{t("newsletter.sendWizard.recipientsLabel", "Recipients")}</span>
                    <span className="text-sm font-medium text-foreground" data-testid="text-recipient-count">
                      {getRecipientSummary()}
                    </span>
                  </div>
                  {customRecipientType === "tags" && selectedTagIds.length > 0 && selectionMode === "custom" && (
                    <>
                      <Separator />
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm text-muted-foreground flex-shrink-0">{t("newsletter.sendWizard.tagsLabel", "Tags")}</span>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {getSelectedTagNames().map((name: string) => (
                            <Badge key={name} variant="secondary" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Smile className={`h-4 w-4 ${reactionsEnabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm text-muted-foreground">{t("newsletter.sendWizard.enableReactions", "Enable Reactions")}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={reactionsEnabled}
                      onClick={() => onReactionsEnabledChange?.(!reactionsEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer ${reactionsEnabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      data-testid="toggle-reactions-enabled"
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${reactionsEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`}
                      />
                    </button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Globe className={`h-4 w-4 ${publishToBlog ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      <div>
                        <span className="text-sm text-muted-foreground">{t("newsletter.sendWizard.publishToBlog", "Publish to Blog")}</span>
                        <p className="text-[11px] text-muted-foreground/70">{t("newsletter.sendWizard.publishToBlogDesc", "Make this newsletter available on your public blog site after sending")}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={publishToBlog}
                      onClick={() => onPublishToBlogChange?.(!publishToBlog)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer flex-shrink-0 ${publishToBlog ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      data-testid="toggle-publish-to-blog"
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${publishToBlog ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Schedule picker */}
              {showSchedulePicker && !requiresReview && (
                <div className="rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm font-medium text-foreground">{t("newsletter.sendWizard.scheduleSend", "Schedule Send")}</p>
                    </div>
                    <button
                      onClick={() => setShowSchedulePicker(false)}
                      className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {`Choose when this ${itemLabel.toLowerCase()} should be sent. The time is in your local timezone.`}
                  </p>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("newsletter.sendWizard.dateLabel", "Date")}</label>
                      <Input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={getMinDate()}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("newsletter.sendWizard.timeLabel", "Time")}</label>
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        min={getMinTime()}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  {scheduleDate && scheduleTime && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      {t("newsletter.sendWizard.willBeSentOn", "Will be sent on {{date}}", { date: new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })})}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                <div className="flex items-start gap-3">
                  {requiresReview ? (
                    <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Send className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {requiresReview ? t("newsletter.sendWizard.reviewerApprovalRequired", "Reviewer approval required") : t("newsletter.sendWizard.readyToSendLabel", "Ready to send")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {requiresReview
                        ? `This ${itemLabel.toLowerCase()} requires approval from a reviewer before it can be sent. It will be submitted for review and you'll be notified once approved.`
                        : `Once sent, the ${itemLabel.toLowerCase()} will be delivered to all selected recipients. This action cannot be undone. You can also schedule it for later or save as draft.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="flex-shrink-0" />

            <DialogFooter className="flex-row items-center justify-between gap-4 sm:justify-between flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                data-testid="button-back-to-step1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("newsletter.sendWizard.back", "Back")}
              </Button>
              <div className="flex gap-2 flex-shrink-0">
                {!requiresReview && (
                  showSchedulePicker ? (
                    <Button
                      onClick={() => handleScheduleSend()}
                      disabled={isScheduling || !isScheduleValid()}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-confirm-schedule"
                    >
                      {isScheduling ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          {t("newsletter.sendWizard.scheduling", "Scheduling...")}
                        </span>
                      ) : (
                        <>
                          <CalendarClock className="h-4 w-4 mr-1.5" />
                          {t("newsletter.sendWizard.confirmSchedule", "Confirm Schedule")}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowSchedulePicker(true)}
                      disabled={isSavingLater || isSending}
                      data-testid="button-schedule-send"
                    >
                      <CalendarClock className="h-4 w-4 mr-1.5" />
                      {t("newsletter.sendWizard.sendLater", "Send Later")}
                    </Button>
                  )
                )}
                {!showSchedulePicker && (
                  <Button
                    variant="outline"
                    onClick={handleSendLater}
                    disabled={isSavingLater || isSending || isScheduling}
                    data-testid="button-send-later"
                  >
                    {isSavingLater ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {t("newsletter.sendWizard.saving", "Saving...")}
                      </span>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-1.5" />
                        {t("newsletter.sendWizard.sendLater", "Send Later")}
                      </>
                    )}
                  </Button>
                )}
                {!showSchedulePicker && (
                  <Button
                    onClick={() => handleSendNow()}
                    disabled={isSending || isSavingLater || isScheduling}
                    data-testid="button-send-now"
                  >
                    {isSending ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {requiresReview ? t("newsletter.sendWizard.submitting", "Submitting...") : t("newsletter.sendWizard.sending", "Sending...")}
                      </span>
                    ) : requiresReview ? (
                      <>
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        {t("newsletter.sendWizard.submitForReview", "Submit for Review")}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1.5" />
                        {t("newsletter.sendWizard.sendNow", "Send Now")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      {/* Content moderation violations dialog */}
      <AlertDialog open={showModerationDialog} onOpenChange={setShowModerationDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t("newsletter.moderation.title", "Content Issue Detected")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {t("newsletter.moderation.description", "Your newsletter contains content that violates our content policy. Please go back to the editor and remove the following issues before sending.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-3 py-2">
            {(() => {
              const grouped = moderationViolations.reduce<Record<string, ModerationViolation[]>>((acc, v) => {
                (acc[v.categoryLabel] ||= []).push(v);
                return acc;
              }, {});
              return Object.entries(grouped).map(([category, violations]) => (
                <div key={category} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold text-destructive mb-1.5">{category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {violations.map((v, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-destructive/30 text-destructive">
                        {v.matchedTerm}
                      </Badge>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowModerationDialog(false);
              setModerationViolations([]);
            }}>
              {t("newsletter.moderation.goBack", "Go Back and Fix Content")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send confirmation dialog (password / 2FA) */}
      <AlertDialog open={showSendConfirmation} onOpenChange={(open) => {
        if (!open) {
          setShowSendConfirmation(false);
          setConfirmationCredential("");
          setPendingSendAction(null);
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {sendConfirmationStatus?.method === '2fa' ? (
                <Fingerprint className="h-5 w-5 text-violet-600" />
              ) : (
                <KeyRound className="h-5 w-5 text-blue-600" />
              )}
              {sendConfirmationStatus?.method === '2fa'
                ? t("newsletter.sendConfirm.title2fa", "Enter 2FA Code")
                : t("newsletter.sendConfirm.titlePassword", "Confirm Password")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {sendConfirmationStatus?.method === '2fa'
                ? t("newsletter.sendConfirm.desc2fa", "Your organization requires 2FA verification before sending newsletters. Enter your authenticator code to continue.")
                : t("newsletter.sendConfirm.descPassword", "Your organization requires identity verification before sending newsletters. Enter your account password to continue.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="send-confirm-input" className="text-sm font-medium mb-2 block">
              {sendConfirmationStatus?.method === '2fa'
                ? t("newsletter.sendConfirm.label2fa", "6-digit code")
                : t("newsletter.sendConfirm.labelPassword", "Account password")}
            </Label>
            <Input
              id="send-confirm-input"
              type={sendConfirmationStatus?.method === '2fa' ? 'text' : 'password'}
              inputMode={sendConfirmationStatus?.method === '2fa' ? 'numeric' : undefined}
              maxLength={sendConfirmationStatus?.method === '2fa' ? 6 : undefined}
              pattern={sendConfirmationStatus?.method === '2fa' ? '[0-9]*' : undefined}
              placeholder={sendConfirmationStatus?.method === '2fa' ? '000000' : ''}
              value={confirmationCredential}
              onChange={(e) => setConfirmationCredential(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && confirmationCredential.trim()) {
                  handleConfirmationVerify();
                }
              }}
              autoFocus
              disabled={isVerifyingCredential}
            />
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowSendConfirmation(false);
                setConfirmationCredential("");
                setPendingSendAction(null);
              }}
              disabled={isVerifyingCredential}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleConfirmationVerify}
              disabled={!confirmationCredential.trim() || isVerifyingCredential}
            >
              {isVerifyingCredential ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("newsletter.sendConfirm.verifying", "Verifying...")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t("newsletter.sendConfirm.verify", "Verify & Continue")}
                </span>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
