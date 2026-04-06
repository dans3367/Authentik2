import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, Tag, Users, Check, User, CheckCircle, RefreshCw, Target, Filter, Store } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { EmailContactWithDetails, ContactTagWithCount } from "@shared/schema";

interface ShopOption {
  id: string;
  name: string;
}

interface CustomerSegmentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientType: 'all' | 'selected' | 'tags';
  selectedContactIds: string[];
  selectedTagIds: string[];
  selectedShopIds?: string[];
  allShops?: ShopOption[];
  onSave: (data: {
    recipientType: 'all' | 'selected' | 'tags' | 'shops';
    selectedContactIds: string[];
    selectedTagIds: string[];
    selectedShopIds: string[];
  }) => void;
}

export function CustomerSegmentationModal({
  isOpen,
  onClose,
  recipientType,
  selectedContactIds,
  selectedTagIds,
  selectedShopIds,
  allShops,
  onSave,
}: CustomerSegmentationModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'all' | 'shops' | 'selected' | 'tags'>(
    selectedShopIds && selectedShopIds.length > 0 ? 'shops' : recipientType
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [tempSelectedContacts, setTempSelectedContacts] = useState<string[]>(selectedContactIds);
  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>(selectedTagIds);
  const [tempSelectedShops, setTempSelectedShops] = useState<string[]>(selectedShopIds ?? []);
  const [shopFilter, setShopFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasAutoInitialized = useRef(false);
  const queryClient = useQueryClient();

  // Fetch contacts (active only — inactive/unsubscribed contacts can't receive emails)
  // allShops=true bypasses shop header filtering so users can pick contacts across shops
  const { data: contactsData, isLoading: contactsLoading, isError: contactsError } = useQuery({
    queryKey: ['/api/email-contacts', { status: 'active', allShops: true }],
    queryFn: async () => {
      // Fetch all contacts (no artificial limit) so per-shop counts are accurate.
      // The API enforces tenant-level isolation; allShops=true is guarded server-side
      // to Administrator/Owner/Manager roles only.
      const response = await apiRequest('GET', '/api/email-contacts?status=active&allShops=true&limit=5000');
      if (!response.ok) {
        throw new Error(`Failed to load contacts: ${response.status}`);
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch tags
  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ['/api/contact-tags'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/contact-tags');
      return response.json();
    },
    enabled: isOpen,
  });

  const contacts: EmailContactWithDetails[] = (contactsData as any)?.contacts || [];
  const tags: ContactTagWithCount[] = (tagsData as any)?.tags || [];

  // Derive per-shop active contact counts from loaded contacts
  const shopContactCounts: Record<string, number> = {};
  for (const c of contacts) {
    if (c.shopId) {
      shopContactCounts[c.shopId] = (shopContactCounts[c.shopId] || 0) + 1;
    }
  }

  // Refresh tags data
  const handleRefreshTags = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['/api/contact-tags'] });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter contacts based on search and shop filter
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesShop = shopFilter === "all" || contact.shopId === shopFilter;
    return matchesSearch && matchesShop;
  });

  // Filter tags based on search
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset temporary selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(selectedShopIds && selectedShopIds.length > 0 ? 'shops' : recipientType);
      setTempSelectedContacts(selectedContactIds);
      setTempSelectedTags(selectedTagIds);
      setTempSelectedShops(selectedShopIds ?? []);
      setSearchTerm("");
      setShopFilter("all");
      hasAutoInitialized.current = false;
    }
  }, [isOpen, recipientType, selectedContactIds, selectedTagIds, selectedShopIds]);

  // Auto-select all contacts when switching to "selected" tab if none are selected
  useEffect(() => {
    if (
      activeTab === 'selected' &&
      !hasAutoInitialized.current &&
      contacts.length > 0
    ) {
      hasAutoInitialized.current = true;
      if (tempSelectedContacts.length === 0) {
        setTempSelectedContacts(contacts.map(contact => contact.id));
      }
    }
  }, [activeTab, contacts]);

  const handleContactToggle = (contactId: string) => {
    setTempSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleTagToggle = (tagId: string) => {
    setTempSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSave = () => {
    onSave({
      recipientType: activeTab === 'shops' ? 'shops' : activeTab,
      selectedContactIds: activeTab === 'selected' ? tempSelectedContacts : [],
      selectedTagIds: activeTab === 'tags' ? tempSelectedTags : [],
      selectedShopIds: activeTab === 'shops' ? tempSelectedShops : [],
    });
    onClose();
  };

  const getSelectionSummary = () => {
    switch (activeTab) {
      case 'all':
        return t("segmentation.segmentationModal.summaryAll", { count: contacts.length });
      case 'shops': {
        const totalContacts = tempSelectedShops.reduce((sum, id) => sum + (shopContactCounts[id] ?? 0), 0);
        const shopNames = tempSelectedShops.map(id => allShops?.find(s => s.id === id)?.name || id).join(', ');
        return t("segmentation.segmentationModal.shopsSummaryFooter", { count: tempSelectedShops.length, contacts: totalContacts.toLocaleString() }) + (shopNames ? `: ${shopNames}` : '');
      }
      case 'selected':
        return t("segmentation.segmentationModal.summarySelected", { count: tempSelectedContacts.length });
      case 'tags': {
        const tagNames = tempSelectedTags.map(tagId => {
          const tag = tags.find(t => t.id === tagId);
          return tag?.name || tagId;
        }).join(', ');
        return t("segmentation.segmentationModal.summaryTags", { count: tempSelectedTags.length }) + (tagNames ? `: ${tagNames}` : '');
      }
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] sm:h-[90vh] lg:h-[94vh] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            {t("segmentation.segmentationModal.title", "Customer Segmentation")}
          </DialogTitle>
          <DialogDescription>
            {t("segmentation.segmentationModal.description", "Choose how to target your audience for this segment")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-4 px-3 sm:px-4 pb-2">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <TabsList className={`grid w-full ${allShops ? 'grid-cols-4' : 'grid-cols-3'} bg-muted/50`}>
              <TabsTrigger value="all" className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                {t("segmentation.segmentationModal.tabs.all", "All Customers")}
              </TabsTrigger>
              {allShops && (
                <TabsTrigger value="shops" className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4" />
                  {t("segmentation.segmentationModal.tabs.shops", "Shops")}
                </TabsTrigger>
              )}
              <TabsTrigger value="selected" className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                {t("segmentation.segmentationModal.tabs.selected", "Select Customers")}
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4" />
                {t("segmentation.segmentationModal.tabs.tags", "Select by Tags")}
              </TabsTrigger>
            </TabsList>

            {/* ─── ALL CUSTOMERS TAB ─── */}
            <TabsContent value="all" className="flex-1 min-h-0 mt-0 pt-4 overflow-y-auto">
              <div className="flex flex-col items-center justify-center py-10">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-5">
                  <Users className="h-10 w-10 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {t("segmentation.segmentationModal.allTitle", "Send to All Customers")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md text-center">
                  {t("segmentation.segmentationModal.allDescription", "Your email will be sent to all active customers in your contact list")}
                </p>
                <div className="mt-5">
                  <Badge variant="outline" className="text-base px-5 py-2.5 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                    <Users className="h-4 w-4 mr-2" />
                    {t("segmentation.segmentationModal.customerCount", "{{count}} customers", { count: contacts.length })}
                  </Badge>
                </div>
              </div>
            </TabsContent>

            {/* ─── SHOPS TAB ─── */}
            {allShops && (
              <TabsContent value="shops" className="flex-1 min-h-0 overflow-hidden mt-0 pt-4 px-1">
                <div className="flex flex-col h-full space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-muted-foreground">
                      {tempSelectedShops.length === 0
                        ? t("segmentation.segmentationModal.noShopsSelected", "Select which stores to include")
                        : t("segmentation.segmentationModal.shopsSelectedSummary", {
                            count: tempSelectedShops.length,
                            total: allShops.length,
                            contacts: tempSelectedShops.reduce((sum, id) => sum + (shopContactCounts[id] ?? 0), 0).toLocaleString(),
                          })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setTempSelectedShops(allShops.map(s => s.id))}
                        disabled={tempSelectedShops.length === allShops.length}
                      >
                        {t("segmentation.segmentationModal.selectAll", "Select All")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setTempSelectedShops([])}
                        disabled={tempSelectedShops.length === 0}
                      >
                        {t("segmentation.segmentationModal.clearAll", "Clear All")}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto rounded-lg border bg-white/50 dark:bg-gray-900/30">
                    {allShops.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Store className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          {t("segmentation.segmentationModal.noShops", "No active stores found")}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {allShops.map((shop) => {
                          const isSelected = tempSelectedShops.includes(shop.id);
                          return (
                            <div
                              key={shop.id}
                              className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                                isSelected ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-muted/50'
                              }`}
                              onClick={() =>
                                setTempSelectedShops(prev =>
                                  prev.includes(shop.id) ? prev.filter(id => id !== shop.id) : [...prev, shop.id]
                                )
                              }
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  setTempSelectedShops(prev =>
                                    checked
                                      ? (prev.includes(shop.id) ? prev : [...prev, shop.id])
                                      : prev.filter(id => id !== shop.id)
                                  )
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-pointer"
                              />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm font-medium text-foreground truncate">{shop.name}</p>
                                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                                  {shopContactCounts[shop.id] ?? 0} {(shopContactCounts[shop.id] ?? 0) === 1 ? t("segmentation.segmentationModal.customer", "contact") : t("segmentation.segmentationModal.customers", "contacts")}
                                </span>
                              </div>
                              {isSelected && (
                                <div className="p-0.5 bg-amber-500 dark:bg-amber-400 rounded-full flex-shrink-0">
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
              </TabsContent>
            )}

            {/* ─── SELECT CUSTOMERS TAB ─── */}
            <TabsContent value="selected" className="flex-1 min-h-0 overflow-hidden mt-0 pt-4 px-1">
              <div className="flex flex-col h-full space-y-3">
                {tempSelectedContacts.length === contacts.length && contacts.length > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-lg p-3">
                    <div className="flex items-center text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      {t("segmentation.segmentationModal.allSelectedHint", "All {{count}} contacts are selected. Uncheck any you don't want to include.", { count: contacts.length })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder={t("segmentation.segmentationModal.searchCustomers", "Search customers by name or email...")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  {allShops && allShops.length > 0 && (
                    <Select value={shopFilter} onValueChange={setShopFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                        <Store className="h-3.5 w-3.5 mr-1.5 text-muted-foreground flex-shrink-0" />
                        <SelectValue placeholder="Filter by shop" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("segmentation.segmentationModal.allShops", "All Shops")}</SelectItem>
                        {allShops.map((shop) => (
                          <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        const visibleIds = filteredContacts.map(c => c.id);
                        setTempSelectedContacts(prev => {
                          const combined = new Set(prev);
                          visibleIds.forEach(id => combined.add(id));
                          return Array.from(combined);
                        });
                      }}
                      disabled={filteredContacts.every(c => tempSelectedContacts.includes(c.id))}
                    >
                      {t("segmentation.segmentationModal.selectAll", "Select All")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        if (shopFilter === "all" && !searchTerm) {
                          setTempSelectedContacts([]);
                        } else {
                          const visibleIds = new Set(filteredContacts.map(c => c.id));
                          setTempSelectedContacts(prev => prev.filter(id => !visibleIds.has(id)));
                        }
                      }}
                      disabled={filteredContacts.every(c => !tempSelectedContacts.includes(c.id))}
                    >
                      {t("segmentation.segmentationModal.clearAll", "Clear All")}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground">
                    {t("segmentation.segmentationModal.selectedCount", "{{selected}} of {{total}} customers selected", {
                      selected: filteredContacts.filter(c => tempSelectedContacts.includes(c.id)).length,
                      total: filteredContacts.length
                    })}
                  </p>
                  {tempSelectedContacts.length === contacts.length && contacts.length > 0 && (
                    <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      {t("segmentation.segmentationModal.allSelected", "All contacts selected")}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto rounded-lg border bg-white/50 dark:bg-gray-900/30">
                  {contactsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-800 dark:border-t-indigo-400" />
                      <p className="text-xs text-muted-foreground mt-3">
                        {t("segmentation.segmentationModal.loadingContacts", "Loading contacts...")}
                      </p>
                    </div>
                  ) : contactsError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-sm font-medium text-destructive mb-1">
                        {t("segmentation.segmentationModal.contactsLoadError", "Failed to load contacts. Please close and try again.")}
                      </p>
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Search className="h-8 w-8 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {searchTerm || shopFilter !== "all"
                          ? t("segmentation.segmentationModal.noSearchResults", "No customers found matching your filters")
                          : t("segmentation.segmentationModal.noCustomers", "No customers available")}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer
                            ${tempSelectedContacts.includes(contact.id)
                              ? 'bg-indigo-50/50 dark:bg-indigo-900/10'
                              : 'hover:bg-muted/50'}`}
                          onClick={() => handleContactToggle(contact.id)}
                        >
                          <Checkbox
                            checked={tempSelectedContacts.includes(contact.id)}
                            onCheckedChange={(checked) => {
                              setTempSelectedContacts((prev) =>
                                checked
                                  ? (prev.includes(contact.id) ? prev : [...prev, contact.id])
                                  : prev.filter((id) => id !== contact.id)
                              );
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {contact.firstName && contact.lastName
                                  ? `${contact.firstName} ${contact.lastName}`
                                  : contact.email}
                              </p>
                              <Badge
                                variant={contact.status === 'active' ? 'default' : 'secondary'}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {contact.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                              {allShops && contact.shopId && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30 text-amber-700 dark:text-amber-300 flex-shrink-0">
                                  <Store className="h-2.5 w-2.5 mr-0.5" />
                                  {allShops.find(s => s.id === contact.shopId)?.name || "Unknown"}
                                </Badge>
                              )}
                            </div>
                            {contact.tags.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {contact.tags.slice(0, 3).map((tag) => (
                                  <Badge
                                    key={tag.id}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 bg-muted/50"
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                                {contact.tags.length > 3 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                                    +{contact.tags.length - 3} {t("segmentation.segmentationModal.more", "more")}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── SELECT BY TAGS TAB ─── */}
            <TabsContent value="tags" className="flex-1 min-h-0 overflow-hidden mt-0 pt-4 px-1">
              <div className="flex flex-col h-full space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder={t("segmentation.segmentationModal.searchTags", "Search tags...")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={handleRefreshTags}
                    disabled={isRefreshing || tagsLoading}
                    title={t("segmentation.segmentationModal.refreshTags", "Refresh tag counts")}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => setTempSelectedTags([])}
                    disabled={tempSelectedTags.length === 0}
                  >
                    {t("segmentation.segmentationModal.clearAll", "Clear All")}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground px-1">
                  {t("segmentation.segmentationModal.tagsSelectedCount", "{{selected}} of {{total}} tags selected", {
                    selected: filteredTags.filter(t => tempSelectedTags.includes(t.id)).length,
                    total: filteredTags.length
                  })}
                </p>

                <div className="flex-1 overflow-y-auto rounded-lg border bg-white/50 dark:bg-gray-900/30">
                  {tagsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-purple-200 border-t-purple-600 dark:border-purple-800 dark:border-t-purple-400" />
                      <p className="text-xs text-muted-foreground mt-3">
                        {t("segmentation.segmentationModal.loadingTags", "Loading tags...")}
                      </p>
                    </div>
                  ) : filteredTags.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Tag className="h-8 w-8 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {searchTerm
                          ? t("segmentation.segmentationModal.noTagsSearch", "No tags found matching your search")
                          : t("segmentation.segmentationModal.noTags", "No tags available")}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 p-4">
                      {filteredTags.map((tag) => {
                        const isSelected = tempSelectedTags.includes(tag.id);
                        return (
                          <div
                            key={tag.id}
                            className={`flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all duration-200 ${isSelected
                              ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                              : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                              }`}
                            onClick={() => handleTagToggle(tag.id)}
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-900 shadow-sm"
                              style={{ backgroundColor: tag.color || '#9ca3af' }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-foreground block truncate">{tag.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {tag.contactCount || 0}{' '}
                                {(tag.contactCount === 1)
                                  ? t("segmentation.segmentationModal.customer", "customer")
                                  : t("segmentation.segmentationModal.customers", "customers")}
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
            </TabsContent>
          </Tabs>
        </div>

        <Separator className="my-1" />

        <DialogFooter className="flex-row items-center justify-between gap-4 sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <Filter className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{getSelectionSummary()}</span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" onClick={onClose}>
              {t("segmentation.segmentationModal.cancel", "Cancel")}
            </Button>
            <Button onClick={handleSave}>
              {t("segmentation.segmentationModal.save", "Save Selection")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}