import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Mail,
  Eye,
  MousePointer,
  Calendar as CalendarIcon,
  Search,
  Newspaper,
  ClipboardList,
  Megaphone,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Ban,
  UserMinus,
  FileText,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

interface AnalyticsItem {
  id: string;
  title: string;
  itemType: "newsletter" | "form" | "promotion";
  status?: string;
  sentAt?: string | null;
  createdAt?: string;
  recipientCount?: number;
  category?: string;
  isActive?: boolean;
  responseCount?: number;
  type?: string;
  usageCount?: number;
}

interface SelectedItem {
  id: string;
  type: "newsletter" | "form" | "promotion";
}

interface AnalyticsResult {
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalFailed: number;
    totalUnsubscribed: number;
    totalFormResponses: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  newsletters: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalUniqueOpens: number;
    totalClicked: number;
    totalUniqueClicks: number;
    totalBounced: number;
    totalFailed: number;
    totalUnsubscribed: number;
    totalSuppressed: number;
    perNewsletter: Array<{
      id: string;
      title: string;
      subject: string;
      sentAt: string | null;
      sent: number;
      delivered: number;
      opened: number;
      uniqueOpens: number;
      clicked: number;
      uniqueClicks: number;
      bounced: number;
      failed: number;
      unsubscribed: number;
      suppressed: number;
      openRate: number;
      clickRate: number;
    }>;
  };
  forms: {
    totalResponses: number;
    perForm: Array<{
      id: string;
      title: string;
      category: string;
      responsesInRange: number;
      totalResponses: number;
    }>;
  };
  promotions: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalBounced: number;
    perPromotion: Array<{
      id: string;
      title: string;
      type: string;
      usageCount: number;
      sent: number;
      delivered: number;
      opened: number;
      bounced: number;
      openRate: number;
    }>;
  };
  timeline: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>;
  dateRange: { start: string; end: string };
}

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  newsletter: Newspaper,
  form: ClipboardList,
  promotion: Megaphone,
};

const TYPE_COLORS: Record<string, string> = {
  newsletter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  form: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  promotion: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const PRESET_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
] as const;

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function AnalyticsPage() {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "newsletter" | "form" | "promotion">("all");
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Fetch available items
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/analytics/items"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/items", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics items");
      return res.json();
    },
  });

  // Fetch aggregated analytics
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
    isFetching,
  } = useQuery<AnalyticsResult>({
    queryKey: ["/api/analytics/aggregate", selectedItems, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const res = await fetch("/api/analytics/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          selectedItems: selectedItems.map((i) => ({ id: i.id, type: i.type })),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: selectedItems.length > 0,
  });

  // Flatten all items for the selection list
  const allItems: AnalyticsItem[] = useMemo(() => {
    if (!itemsData) return [];
    return [
      ...(itemsData.newsletters || []),
      ...(itemsData.forms || []),
      ...(itemsData.promotions || []),
    ];
  }, [itemsData]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (activeTab !== "all") {
      items = items.filter((i) => i.itemType === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q));
    }
    return items;
  }, [allItems, activeTab, searchQuery]);

  const isSelected = useCallback(
    (id: string) => selectedItems.some((s) => s.id === id),
    [selectedItems]
  );

  const toggleItem = useCallback(
    (item: AnalyticsItem) => {
      setSelectedItems((prev) => {
        if (prev.some((s) => s.id === item.id)) {
          return prev.filter((s) => s.id !== item.id);
        }
        return [...prev, { id: item.id, type: item.itemType }];
      });
    },
    []
  );

  const selectAllFiltered = useCallback(() => {
    const newItems = filteredItems
      .filter((i) => !selectedItems.some((s) => s.id === i.id))
      .map((i) => ({ id: i.id, type: i.itemType }));
    setSelectedItems((prev) => [...prev, ...newItems]);
  }, [filteredItems, selectedItems]);

  const deselectAllFiltered = useCallback(() => {
    const filteredIds = new Set(filteredItems.map((i) => i.id));
    setSelectedItems((prev) => prev.filter((s) => !filteredIds.has(s.id)));
  }, [filteredItems]);

  const applyPresetRange = useCallback((days: number) => {
    setStartDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    setEndDate(new Date());
  }, []);

  const getItemSubtitle = (item: AnalyticsItem) => {
    if (item.itemType === "newsletter") {
      if (item.sentAt) return `Sent ${formatDate(new Date(item.sentAt))}`;
      return item.status || "Draft";
    }
    if (item.itemType === "form") return item.category === "survey" ? "Survey" : "Intake Form";
    if (item.itemType === "promotion") return item.type || "Promotion";
    return "";
  };

  // Summary cards
  const summary = analyticsData?.summary;
  const hasNewsletters = selectedItems.some((i) => i.type === "newsletter");
  const hasForms = selectedItems.some((i) => i.type === "form");
  const hasPromotions = selectedItems.some((i) => i.type === "promotion");

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select newsletters, forms, or promotions and view aggregated performance analytics
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Item Selection */}
        <div className="lg:col-span-4 xl:col-span-3">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Items</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Choose newsletters, forms, or promotions to analyze
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Range</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_RANGES.map((p) => (
                    <Button
                      key={p.days}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => applyPresetRange(p.days)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-8">
                        <CalendarIcon className="w-3 h-3 mr-1.5" />
                        {formatDate(startDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        selected={startDate}
                        onSelect={(d) => {
                          if (d) setStartDate(d);
                          setStartDateOpen(false);
                        }}
                        disabled={{ after: endDate }}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-xs text-gray-400">to</span>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-8">
                        <CalendarIcon className="w-3 h-3 mr-1.5" />
                        {formatDate(endDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        selected={endDate}
                        onSelect={(d) => {
                          if (d) setEndDate(d);
                          setEndDateOpen(false);
                        }}
                        disabled={{ before: startDate, after: new Date() }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Type Tabs */}
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                {(["all", "newsletter", "form", "promotion"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 text-xs py-1.5 px-2 rounded-md transition-all font-medium capitalize",
                      activeTab === tab
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                    )}
                  >
                    {tab === "all" ? "All" : tab === "newsletter" ? "Newsletters" : tab === "form" ? "Forms" : "Promos"}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Select all / deselect */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selectedItems.length} selected
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={selectAllFiltered}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={deselectAllFiltered}>
                    Clear
                  </Button>
                </div>
              </div>

              {/* Item List */}
              <div className="max-h-[400px] overflow-y-auto space-y-1 -mx-1 px-1">
                {itemsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No items found
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const Icon = TYPE_ICONS[item.itemType] || FileText;
                    const selected = isSelected(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item)}
                        className={cn(
                          "w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all",
                          selected
                            ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                        )}
                      >
                        <Checkbox checked={selected} className="pointer-events-none" />
                        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0", TYPE_COLORS[item.itemType])}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-gray-900 dark:text-white">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {getItemSubtitle(item)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Analytics Results */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {selectedItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  No items selected
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Select one or more newsletters, forms, or promotions from the left panel to view aggregated analytics.
                </p>
              </CardContent>
            </Card>
          ) : isFetching && !analyticsData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-80 rounded-xl" />
            </div>
          ) : analyticsData ? (
            <>
              {/* Loading overlay indicator */}
              {isFetching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating analytics...
                </div>
              )}

              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {(hasNewsletters || hasPromotions) && (
                  <>
                    <MetricCard
                      title="Total Sent"
                      value={summary?.totalSent?.toLocaleString() || "0"}
                      icon={Mail}
                      color="blue"
                    />
                    <MetricCard
                      title="Open Rate"
                      value={`${summary?.openRate || 0}%`}
                      icon={Eye}
                      color="green"
                      subtitle={`${summary?.totalOpened?.toLocaleString() || 0} opens`}
                    />
                    <MetricCard
                      title="Click Rate"
                      value={`${summary?.clickRate || 0}%`}
                      icon={MousePointer}
                      color="amber"
                      subtitle={`${summary?.totalClicked?.toLocaleString() || 0} clicks`}
                    />
                    <MetricCard
                      title="Bounce Rate"
                      value={`${summary?.bounceRate || 0}%`}
                      icon={AlertTriangle}
                      color="red"
                      subtitle={`${summary?.totalBounced?.toLocaleString() || 0} bounces`}
                    />
                  </>
                )}
                {hasForms && (
                  <MetricCard
                    title="Form Responses"
                    value={summary?.totalFormResponses?.toLocaleString() || "0"}
                    icon={ClipboardList}
                    color="emerald"
                    subtitle="In selected date range"
                  />
                )}
              </div>

              {/* Delivery Status Summary */}
              {(hasNewsletters || hasPromotions) && summary && summary.totalSent > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <MiniStat label="Delivered" value={summary.totalDelivered} icon={CheckCircle} color="text-green-500" />
                  <MiniStat label="Opened" value={summary.totalOpened} icon={Eye} color="text-blue-500" />
                  <MiniStat label="Clicked" value={summary.totalClicked} icon={MousePointer} color="text-amber-500" />
                  <MiniStat label="Bounced" value={summary.totalBounced} icon={AlertTriangle} color="text-orange-500" />
                  <MiniStat label="Failed" value={summary.totalFailed} icon={XCircle} color="text-red-500" />
                  <MiniStat label="Unsubscribed" value={summary.totalUnsubscribed} icon={UserMinus} color="text-gray-500" />
                </div>
              )}

              {/* Timeline Chart */}
              {analyticsData.timeline && analyticsData.timeline.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={analyticsData.timeline.map((d) => ({ ...d, date: formatShortDate(d.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                          }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="#dbeafe" name="Sent" />
                        <Area type="monotone" dataKey="delivered" stroke="#10b981" fill="#d1fae5" name="Delivered" />
                        <Area type="monotone" dataKey="opened" stroke="#f59e0b" fill="#fef3c7" name="Opened" />
                        <Area type="monotone" dataKey="clicked" stroke="#8b5cf6" fill="#ede9fe" name="Clicked" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Per-Newsletter Breakdown */}
              {hasNewsletters && analyticsData.newsletters.perNewsletter.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Newspaper className="w-4 h-4" />
                      Newsletter Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Bar chart comparing newsletters */}
                    {analyticsData.newsletters.perNewsletter.length > 1 && (
                      <div className="mb-6">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart
                            data={analyticsData.newsletters.perNewsletter.map((n) => ({
                              name: n.title.length > 25 ? n.title.substring(0, 25) + "..." : n.title,
                              Sent: n.sent,
                              Opened: n.uniqueOpens,
                              Clicked: n.uniqueClicks,
                              Bounced: n.bounced,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid #e5e7eb",
                              }}
                            />
                            <Legend />
                            <Bar dataKey="Sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Opened" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Clicked" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Bounced" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Per-newsletter detail table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">Newsletter</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Sent</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Delivered</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Opens</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Open Rate</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Clicks</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Click Rate</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Bounced</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analyticsData.newsletters.perNewsletter.map((nl) => (
                            <tr key={nl.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-2.5">
                                <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{nl.title}</div>
                                {nl.sentAt && (
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(new Date(nl.sentAt))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{nl.sent.toLocaleString()}</td>
                              <td className="py-2.5 text-right tabular-nums">{nl.delivered.toLocaleString()}</td>
                              <td className="py-2.5 text-right tabular-nums">{nl.uniqueOpens.toLocaleString()}</td>
                              <td className="py-2.5 text-right">
                                <Badge variant="outline" className="text-xs font-medium tabular-nums">
                                  {nl.openRate}%
                                </Badge>
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{nl.uniqueClicks.toLocaleString()}</td>
                              <td className="py-2.5 text-right">
                                <Badge variant="outline" className="text-xs font-medium tabular-nums">
                                  {nl.clickRate}%
                                </Badge>
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{nl.bounced.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-Form Breakdown */}
              {hasForms && analyticsData.forms.perForm.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" />
                      Form Responses Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyticsData.forms.perForm.length > 1 && (
                      <div className="mb-6">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={analyticsData.forms.perForm.map((f) => ({
                              name: f.title.length > 25 ? f.title.substring(0, 25) + "..." : f.title,
                              "Responses (Range)": f.responsesInRange,
                              "Total Responses": f.totalResponses,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }} />
                            <Legend />
                            <Bar dataKey="Responses (Range)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Total Responses" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="space-y-3">
                      {analyticsData.forms.perForm.map((form) => (
                        <div
                          key={form.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                              <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{form.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">{form.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <p className="font-semibold text-emerald-600">{form.responsesInRange}</p>
                              <p className="text-[10px] text-muted-foreground">In range</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-600 dark:text-gray-300">{form.totalResponses}</p>
                              <p className="text-[10px] text-muted-foreground">All time</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-Promotion Breakdown */}
              {hasPromotions && analyticsData.promotions.perPromotion.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Megaphone className="w-4 h-4" />
                      Promotion Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">Promotion</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Used</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Sent</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Delivered</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Opened</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Open Rate</th>
                            <th className="pb-2 font-medium text-gray-600 dark:text-gray-400 text-right">Bounced</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analyticsData.promotions.perPromotion.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-2.5">
                                <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{p.title}</div>
                                <div className="text-xs text-muted-foreground capitalize">{p.type}</div>
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{p.usageCount}</td>
                              <td className="py-2.5 text-right tabular-nums">{p.sent.toLocaleString()}</td>
                              <td className="py-2.5 text-right tabular-nums">{p.delivered.toLocaleString()}</td>
                              <td className="py-2.5 text-right tabular-nums">{p.opened.toLocaleString()}</td>
                              <td className="py-2.5 text-right">
                                <Badge variant="outline" className="text-xs font-medium tabular-nums">
                                  {p.openRate}%
                                </Badge>
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{p.bounced.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Open Rate Comparison Pie Chart */}
              {hasNewsletters && analyticsData.newsletters.perNewsletter.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Send Volume Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col lg:flex-row items-center gap-6">
                      <ResponsiveContainer width="100%" height={280}>
                        <RechartsPieChart>
                          <Pie
                            data={analyticsData.newsletters.perNewsletter.map((n, i) => ({
                              name: n.title.length > 20 ? n.title.substring(0, 20) + "..." : n.title,
                              value: n.sent,
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={50}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {analyticsData.newsletters.perNewsletter.map((_, i) => (
                              <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state when analytics returns no meaningful data */}
              {analyticsData &&
                summary?.totalSent === 0 &&
                summary?.totalFormResponses === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
                      <h3 className="text-base font-semibold mb-1">No data in this range</h3>
                      <p className="text-sm text-muted-foreground text-center max-w-sm">
                        The selected items don't have analytics data within the chosen date range. Try expanding the date range or selecting different items.
                      </p>
                    </CardContent>
                  </Card>
                )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Sub-components

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<any>;
  color: "blue" | "green" | "amber" | "red" | "emerald" | "purple";
  subtitle?: string;
}) {
  const colorMap = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", colorMap[color])}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <Icon className={cn("w-4 h-4 flex-shrink-0", color)} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
