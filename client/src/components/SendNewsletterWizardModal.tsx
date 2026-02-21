import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Tag, User, Check, Search, CheckCircle, ChevronRight, ChevronLeft, Send, ListChecks, Clock, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SegmentList } from "@shared/schema";

interface SendNewsletterWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  newsletterId: string | null;
  newsletterTitle: string;
  onSegmentSelected: (data: {
    segmentListId: string | null;
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => void;
  initialRecipientType?: "all" | "selected" | "tags";
  initialSelectedContactIds?: string[];
  initialSelectedTagIds?: string[];
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
  onSegmentSelected,
  initialRecipientType,
  initialSelectedContactIds,
  initialSelectedTagIds,
}: SendNewsletterWizardModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectionMode, setSelectionMode] = useState<"segment_list" | "custom">("segment_list");
  const [selectedSegmentListId, setSelectedSegmentListId] = useState<string | null>(null);
  const [customRecipientType, setCustomRecipientType] = useState<"all" | "selected" | "tags">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSavingLater, setIsSavingLater] = useState(false);
  const prevIsOpen = useRef(isOpen);

  const { data: segmentListsData, isLoading: segmentListsLoading } = useQuery({
    queryKey: ["/api/segment-lists"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/segment-lists");
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/email-contacts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/email-contacts");
      return response.json();
    },
    enabled: isOpen && selectionMode === "custom" && customRecipientType === "selected",
  });

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ["/api/contact-tags"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/contact-tags");
      return response.json();
    },
    enabled: isOpen && selectionMode === "custom" && customRecipientType === "tags",
  });

  const { data: reviewerSettings } = useQuery<{ enabled: boolean; reviewerId: string | null; reviewer: any }>({
    queryKey: ['/api/newsletters/reviewer-settings'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters/reviewer-settings");
      return response.json();
    },
    enabled: isOpen,
  });

  const requiresReview = reviewerSettings?.enabled ?? false;

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

  const handleGoToReview = () => {
    setStep(2);
  };

  const handleSendNow = () => {
    setIsSending(true);
    onSegmentSelected(getSegmentData());
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
      });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
      toast({
        title: "Saved for Later",
        description: "Your newsletter is ready to send. You can send it anytime from the newsletter list.",
      });
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save newsletter",
        variant: "destructive",
      });
    } finally {
      setIsSavingLater(false);
    }
  };

  const canContinue = () => {
    if (selectionMode === "segment_list") {
      return !!selectedSegmentListId;
    }
    if (selectionMode === "custom") {
      if (customRecipientType === "all") return true;
      if (customRecipientType === "selected") return selectedContactIds.length > 0;
      if (customRecipientType === "tags") return selectedTagIds.length > 0;
    }
    return false;
  };

  const getRecipientSummary = () => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const list = segmentLists.find((l) => l.id === selectedSegmentListId);
      return list ? `${list.name} (${list.contactCount || 0} recipients)` : "";
    }
    if (selectionMode === "custom") {
      if (customRecipientType === "all") return contacts.length > 0 ? `All customers (${contacts.length})` : "All customers";
      if (customRecipientType === "selected") return `${selectedContactIds.length} selected customers`;
      if (customRecipientType === "tags") return `${selectedTagIds.length} tags selected`;
    }
    return "";
  };

  const getRecipientTypeLabel = () => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const list = segmentLists.find((l) => l.id === selectedSegmentListId);
      return list ? "Segment List" : "";
    }
    if (customRecipientType === "all") return "All Customers";
    if (customRecipientType === "selected") return "Selected Customers";
    if (customRecipientType === "tags") return "By Tags";
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
                Send Newsletter
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {newsletterTitle ? `"${newsletterTitle}" is ready to send` : "Select who will receive this newsletter"}
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
            <span className={`text-sm font-medium ${step >= 1 ? "text-foreground" : "text-muted-foreground"}`}>Select Recipients</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${step === 2 ? "bg-blue-600 dark:bg-blue-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
              2
            </div>
            <span className={`text-sm ${step === 2 ? "font-medium text-foreground" : "text-muted-foreground"}`}>Review & Send</span>
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
                    <span className="text-sm font-medium text-foreground block">Use Segment List</span>
                    <span className="text-xs text-muted-foreground">Choose from saved audience lists</span>
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
                    <span className="text-sm font-medium text-foreground block">Custom Selection</span>
                    <span className="text-xs text-muted-foreground">Choose recipients manually</span>
                  </div>
                </Label>
              </RadioGroup>

              {selectionMode === "segment_list" && (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search segment lists..."
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
                        <p className="text-sm font-medium text-foreground">No segment lists found</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                          Create segment lists in the Segmentation page to quickly select recipients
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
                                      {list.type === "all" ? "All Customers" : list.type === "selected" ? "Selected" : "By Tags"}
                                    </Badge>
                                    <span className="text-[11px] text-muted-foreground">
                                      {list.contactCount || 0} recipients
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
                      <span className="text-xs font-medium">All Customers</span>
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
                      <span className="text-xs font-medium">Select Customers</span>
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
                      <span className="text-xs font-medium">By Tags</span>
                    </Label>
                  </RadioGroup>

                  {customRecipientType === "all" && (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-3">
                        <Users className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Send to All Customers</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your newsletter will be sent to all active customers
                      </p>
                    </div>
                  )}

                  {customRecipientType === "selected" && (
                    <div className="flex-1 min-h-0 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="Search customers..."
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
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedContactIds([])}
                          disabled={selectedContactIds.length === 0}
                        >
                          Clear
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground px-1">
                        {selectedContactIds.length} of {filteredContacts.length} selected
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
                            <p className="text-sm text-muted-foreground">No customers found</p>
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
                          placeholder="Search tags..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                          data-testid="input-search-tags"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground px-1">
                        {selectedTagIds.length} of {filteredTags.length} tags selected
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
                            <p className="text-sm text-muted-foreground">No tags found</p>
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
                                      {tag.contactCount || 0} customers
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
                {canContinue() && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="truncate">{getRecipientSummary()}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" onClick={onClose} data-testid="button-cancel-wizard">
                  Cancel
                </Button>
                <Button
                  onClick={handleGoToReview}
                  disabled={!canContinue()}
                  data-testid="button-continue-wizard"
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
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
                    <p className="text-sm font-medium text-foreground">Newsletter</p>
                    <p className="text-xs text-muted-foreground">Details about what will be sent</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">Title</span>
                    <span className="text-sm font-medium text-foreground text-right truncate" data-testid="text-review-title">
                      {newsletterTitle || "Untitled Newsletter"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">Selection Method</span>
                    <span className="text-sm font-medium text-foreground text-right">
                      {selectionMode === "segment_list" ? "Segment List" : "Custom Selection"}
                    </span>
                  </div>
                  {selectionMode === "segment_list" && selectedSegmentListId && (
                    <>
                      <Separator />
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm text-muted-foreground flex-shrink-0">Segment List</span>
                        <span className="text-sm font-medium text-foreground text-right">
                          {segmentLists.find((l) => l.id === selectedSegmentListId)?.name || ""}
                        </span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">Recipient Type</span>
                    <Badge variant="outline" data-testid="badge-recipient-type">
                      {getRecipientTypeLabel()}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">Recipients</span>
                    <span className="text-sm font-medium text-foreground" data-testid="text-recipient-count">
                      {getRecipientSummary()}
                    </span>
                  </div>
                  {customRecipientType === "tags" && selectedTagIds.length > 0 && selectionMode === "custom" && (
                    <>
                      <Separator />
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm text-muted-foreground flex-shrink-0">Tags</span>
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
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                <div className="flex items-start gap-3">
                  {requiresReview ? (
                    <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Send className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {requiresReview ? "Reviewer approval required" : "Ready to send"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {requiresReview
                        ? "This newsletter requires approval from a reviewer before it can be sent. It will be submitted for review and you'll be notified once approved."
                        : "Once sent, the newsletter will be delivered to all selected recipients. This action cannot be undone. You can also save it for later and send it from the newsletter list."}
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
                Back
              </Button>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={handleSendLater}
                  disabled={isSavingLater || isSending}
                  data-testid="button-send-later"
                >
                  {isSavingLater ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-1.5" />
                      Send Later
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSendNow}
                  disabled={isSending || isSavingLater}
                  data-testid="button-send-now"
                >
                  {isSending ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {requiresReview ? "Submitting..." : "Sending..."}
                    </span>
                  ) : requiresReview ? (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-1.5" />
                      Submit for Review
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send Now
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
