import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Users, Tag, User, Check, Search, RefreshCw, CheckCircle, ChevronRight, Send, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  newsletterId: string | null;
  newsletterTitle: string;
  onSegmentSelected: (data: {
    segmentListId: string | null;
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => void;
}

interface SegmentListWithCount extends SegmentList {
  contactCount?: number;
}

export function SendNewsletterWizardModal({
  isOpen,
  onClose,
  newsletterId,
  newsletterTitle,
  onSegmentSelected,
}: SendNewsletterWizardModalProps) {
  const [selectionMode, setSelectionMode] = useState<"segment_list" | "custom">("segment_list");
  const [selectedSegmentListId, setSelectedSegmentListId] = useState<string | null>(null);
  const [customRecipientType, setCustomRecipientType] = useState<"all" | "selected" | "tags">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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

  const segmentLists: SegmentListWithCount[] = Array.isArray(segmentListsData)
    ? segmentListsData
    : (segmentListsData as any)?.lists || [];
  const contacts = (contactsData as any)?.contacts || [];
  const tags = (tagsData as any)?.tags || [];

  useEffect(() => {
    if (isOpen) {
      setSelectionMode("segment_list");
      setSelectedSegmentListId(null);
      setCustomRecipientType("all");
      setSearchTerm("");
      setSelectedContactIds([]);
      setSelectedTagIds([]);
    }
  }, [isOpen]);

  const filteredContacts = contacts.filter((contact: any) =>
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTags = tags.filter((tag: any) =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleContinue = () => {
    if (selectionMode === "segment_list" && selectedSegmentListId) {
      const selectedList = segmentLists.find((l) => l.id === selectedSegmentListId);
      if (selectedList) {
        onSegmentSelected({
          segmentListId: selectedList.id,
          recipientType: selectedList.type as "all" | "selected" | "tags",
          selectedContactIds: selectedList.selectedContactIds || [],
          selectedTagIds: selectedList.selectedTagIds || [],
        });
      }
    } else if (selectionMode === "custom") {
      onSegmentSelected({
        segmentListId: null,
        recipientType: customRecipientType,
        selectedContactIds: customRecipientType === "selected" ? selectedContactIds : [],
        selectedTagIds: customRecipientType === "tags" ? selectedTagIds : [],
      });
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
      if (customRecipientType === "all") return `All customers (${contacts.length})`;
      if (customRecipientType === "selected") return `${selectedContactIds.length} selected customers`;
      if (customRecipientType === "tags") return `${selectedTagIds.length} tags selected`;
    }
    return "";
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
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

        <div className="flex items-center gap-2 px-1 py-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
              1
            </div>
            <span className="text-sm font-medium text-foreground">Select Recipients</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1.5 opacity-40">
            <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">
              2
            </div>
            <span className="text-sm text-muted-foreground">Review & Send</span>
          </div>
        </div>

        <Separator />

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
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
              className={`flex-1 flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                selectionMode === "segment_list"
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
              className={`flex-1 flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                selectionMode === "custom"
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
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
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

              <ScrollArea className="flex-1 max-h-[320px]">
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
                            className={`flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected
                                ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/15 shadow-sm"
                                : "border-border hover:border-muted-foreground/30"
                            }`}
                            onClick={() => setSelectedSegmentListId(list.id)}
                            data-testid={`segment-list-${list.id}`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected
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
              </ScrollArea>
            </div>
          )}

          {selectionMode === "custom" && (
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
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
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer text-center transition-all ${
                    customRecipientType === "all"
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
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer text-center transition-all ${
                    customRecipientType === "selected"
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
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer text-center transition-all ${
                    customRecipientType === "tags"
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
                <div className="flex-1 overflow-hidden flex flex-col gap-2">
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
                      onClick={() => setSelectedContactIds(contacts.map((c: any) => c.id))}
                      disabled={selectedContactIds.length === contacts.length}
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
                  <ScrollArea className="flex-1 max-h-[220px] rounded-lg border">
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
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              selectedContactIds.includes(contact.id) ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
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
                  </ScrollArea>
                </div>
              )}

              {customRecipientType === "tags" && (
                <div className="flex-1 overflow-hidden flex flex-col gap-2">
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
                  <ScrollArea className="flex-1 max-h-[220px]">
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
                              className={`flex items-center gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
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
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="flex-row items-center justify-between gap-4 sm:justify-between">
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
              onClick={handleContinue}
              disabled={!canContinue()}
              data-testid="button-continue-wizard"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
