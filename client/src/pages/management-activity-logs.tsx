import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Activity,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Send,
  Calendar,
  Archive,
  XCircle,
  RefreshCw,
  Filter,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ENTITY_TYPES = [
  "shop",
  "user",
  "contact",
  "newsletter",
  "appointment",
  "email",
  "tag",
  "template",
];

const ACTIVITY_TYPES = [
  "created",
  "updated",
  "deleted",
  "sent",
  "scheduled",
  "cancelled",
  "archived",
];

const TIME_RANGES = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const activityIcons: Record<string, React.ReactNode> = {
  created: <Plus className="h-3.5 w-3.5" />,
  updated: <Pencil className="h-3.5 w-3.5" />,
  deleted: <Trash2 className="h-3.5 w-3.5" />,
  sent: <Send className="h-3.5 w-3.5" />,
  scheduled: <Calendar className="h-3.5 w-3.5" />,
  archived: <Archive className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
};

const activityColors: Record<string, string> = {
  created: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  updated: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  deleted: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  sent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  scheduled: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  archived: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const entityColors: Record<string, string> = {
  shop: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  user: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  contact: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  newsletter: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  campaign: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  appointment: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  email: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  tag: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  template: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
};

function formatValue(value: any): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "(none)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getTimeRange(range: string): { startTime: string; endTime: string } {
  const now = Date.now();
  const ms: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  return {
    startTime: new Date(now - (ms[range] || ms["30d"])).toISOString(),
    endTime: new Date(now).toISOString(),
  };
}

function useChanges(changes: any) {
  return useMemo(() => {
    let parsed: Record<string, any> = {};
    if (!changes) return parsed;
    try {
      if (typeof changes === "string") parsed = JSON.parse(changes);
      else if (typeof changes === "object") parsed = changes;
    } catch {
      return parsed;
    }
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === "object" && "old" in value && "new" in value) {
        if (JSON.stringify(value.old) !== JSON.stringify(value.new)) {
          filtered[key] = value;
        }
      }
    }
    return filtered;
  }, [changes]);
}

function ChangesButton({ changeCount, isOpen, onToggle }: { changeCount: number; isOpen: boolean; onToggle: () => void }) {
  if (changeCount === 0) return null;
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {changeCount}
    </button>
  );
}

function ChangesPanel({ changes }: { changes: Record<string, { old: any; new: any }> }) {
  const keys = Object.keys(changes);
  return (
    <td colSpan={5} className="px-4 py-1.5 bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
      <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-xs">
        {keys.map((field) => {
          const v = changes[field];
          return (
            <span key={field} className="inline-flex items-center gap-1">
              <span className="font-medium text-gray-600 dark:text-gray-300">{field}:</span>
              <span className="line-through text-gray-400 dark:text-gray-500">{formatValue(v.old)}</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="text-gray-900 dark:text-gray-100">{formatValue(v.new)}</span>
            </span>
          );
        })}
      </div>
    </td>
  );
}

function ActivityLogRow({ log, isExpanded, onToggle }: { log: any; isExpanded: boolean; onToggle: () => void }) {
  const actualChanges = useChanges(log.changes);
  const changeCount = Object.keys(actualChanges).length;

  return (
    <>
      <tr className="group border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
        <td className="px-4 py-2 font-mono text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {format(new Date(log.createdAt), "MMM d, HH:mm")}
        </td>
        <td className="px-4 py-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-[11px] gap-1 py-0 h-5",
              activityColors[log.activityType] || "bg-gray-100 text-gray-700"
            )}
          >
            {activityIcons[log.activityType] || <Activity className="h-3 w-3" />}
            {log.activityType}
          </Badge>
        </td>
        <td className="px-4 py-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] py-0 h-5",
              entityColors[log.entityType] || ""
            )}
          >
            {log.entityType}
          </Badge>
        </td>
        <td className="px-4 py-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
              {log.entityName || log.description || "—"}
            </span>
            <ChangesButton changeCount={changeCount} isOpen={isExpanded} onToggle={onToggle} />
          </div>
          {log.entityName && log.description && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {log.description}
            </p>
          )}
        </td>
        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 truncate">
          {log.user?.firstName && log.user?.lastName
            ? `${log.user.firstName} ${log.user.lastName}`
            : log.user?.email || (
              <span className="text-gray-400 italic text-xs">System</span>
            )}
        </td>
      </tr>
      {isExpanded && changeCount > 0 && (
        <tr>
          <ChangesPanel changes={actualChanges} />
        </tr>
      )}
    </>
  );
}

function ActivityLogsTable({ logs, t }: { logs: any[]; t: any }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <table className="w-full table-fixed">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <th className="px-4 py-2 w-[11%]">{t("management.activityLogs.table.timestamp", "Timestamp")}</th>
          <th className="px-4 py-2 w-[11%]">{t("management.activityLogs.table.action", "Action")}</th>
          <th className="px-4 py-2 w-[10%]">{t("management.activityLogs.table.entity", "Entity")}</th>
          <th className="px-4 py-2 w-[53%]">{t("management.activityLogs.table.description", "Description")}</th>
          <th className="px-4 py-2 w-[15%]">{t("management.activityLogs.table.user", "User")}</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log: any) => (
          <ActivityLogRow
            key={log.id}
            log={log}
            isExpanded={expandedId === log.id}
            onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
          />
        ))}
      </tbody>
    </table>
  );
}

export default function ManagementActivityLogs() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  // Read initial filters from URL params (e.g., ?entityType=shop)
  const urlParams = new URLSearchParams(window.location.search);
  const initialEntityType = urlParams.get("entityType") || "all";

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [entityType, setEntityType] = useState<string>(initialEntityType);
  const [activityType, setActivityType] = useState<string>("all");
  const [timeRange, setTimeRange] = useState("30d");
  const [page, setPage] = useState(0);
  const limit = 25;

  const timeParams = useMemo(() => getTimeRange(timeRange), [timeRange]);

  const hasActiveFilters = entityType !== "all" || activityType !== "all" || activeSearch !== "";

  // Determine which endpoint to use: search vs. filter
  const isSearchMode = activeSearch.length > 0;

  // Build query params for filter mode
  const filterQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (entityType !== "all") params.set("entityType", entityType);
    if (activityType !== "all") params.set("activityType", activityType);
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    params.set("startTime", timeParams.startTime);
    params.set("endTime", timeParams.endTime);
    return params.toString();
  }, [entityType, activityType, page, timeParams]);

  // Build query params for search mode
  const searchQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("q", activeSearch);
    if (entityType !== "all") params.set("entityType", entityType);
    if (activityType !== "all") params.set("activityType", activityType);
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    params.set("startTime", timeParams.startTime);
    params.set("endTime", timeParams.endTime);
    return params.toString();
  }, [activeSearch, entityType, activityType, page, timeParams]);

  // Fetch logs
  const {
    data: logsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "axiom-activity-logs",
      isSearchMode ? "search" : "filter",
      isSearchMode ? searchQueryParams : filterQueryParams,
    ],
    queryFn: async () => {
      const endpoint = isSearchMode
        ? `/api/axiom-activity-logs/search?${searchQueryParams}`
        : `/api/axiom-activity-logs?${filterQueryParams}`;
      const res = await apiRequest("GET", endpoint);
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["axiom-activity-logs", "stats", timeParams.startTime, timeParams.endTime],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/axiom-activity-logs/stats?startTime=${timeParams.startTime}&endTime=${timeParams.endTime}`
      );
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / limit) : 0;

  // Permission check
  const is403 = error instanceof Error && error.message?.startsWith("403:");
  if (is403 || !hasPermission("activity.view")) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t("management.activityLogs.accessDenied", "Access Denied")}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
            {t("management.activityLogs.accessDeniedDesc", "You don't have permission to view activity logs.")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSearch = () => {
    setActiveSearch(searchQuery.trim());
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setActiveSearch("");
    setEntityType("all");
    setActivityType("all");
    setTimeRange("30d");
    setPage(0);
  };

  // Stats summary
  const totalLogs = statsData?.byEntityType?.reduce((sum: number, item: any) => sum + (item.count || 0), 0) || 0;
  const topEntityTypes = (statsData?.byEntityType || [])
    .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
    .slice(0, 4);
  const topActivityTypes = (statsData?.byActivityType || [])
    .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t("management.activityLogs.stats.totalEvents", "Total Events")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalLogs.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {TIME_RANGES.find((r) => r.value === timeRange)?.label || "Last 30 days"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t("management.activityLogs.stats.topEntities", "Top Entity Types")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {topEntityTypes.map((item: any) => (
                <Badge
                  key={item.entityType}
                  variant="secondary"
                  className={cn("text-xs", entityColors[item.entityType] || "")}
                >
                  {item.entityType} ({item.count})
                </Badge>
              ))}
              {topEntityTypes.length === 0 && (
                <span className="text-sm text-gray-400">No data</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t("management.activityLogs.stats.topActions", "Top Actions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {topActivityTypes.map((item: any) => (
                <Badge
                  key={item.activityType}
                  variant="secondary"
                  className={cn("text-xs", activityColors[item.activityType] || "")}
                >
                  {item.activityType} ({item.count})
                </Badge>
              ))}
              {topActivityTypes.length === 0 && (
                <span className="text-sm text-gray-400">No data</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t("management.activityLogs.searchPlaceholder", "Search activity logs...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} variant="default">
                <Search className="h-4 w-4 mr-2" />
                {t("management.activityLogs.search", "Search")}
              </Button>
              <Button onClick={() => refetch()} variant="outline" size="icon" title="Refresh" disabled={isFetching}>
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("management.activityLogs.filters", "Filters")}:
                </span>
              </div>

              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(0); }}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={activityType} onValueChange={(v) => { setActivityType(v); setPage(0); }}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeRange} onValueChange={(v) => { setTimeRange(v); setPage(0); }}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 text-gray-500">
                  <X className="h-3.5 w-3.5 mr-1" />
                  {t("management.activityLogs.clearFilters", "Clear")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Activity className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                {t("management.activityLogs.errorLoading", "Failed to load activity logs.")}
              </p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Activity className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t("management.activityLogs.noResults", "No activity logs found")}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {hasActiveFilters
                  ? t("management.activityLogs.noResultsFiltered", "Try adjusting your filters or search query.")
                  : t("management.activityLogs.noResultsEmpty", "Activity will appear here as actions are performed.")}
              </p>
            </div>
          ) : (
            <>
              <ActivityLogsTable logs={logs} t={t} />

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t("management.activityLogs.pagination.showing", "Showing")} {page * limit + 1}–
                    {Math.min((page + 1) * limit, pagination.total)}{" "}
                    {t("management.activityLogs.pagination.of", "of")} {pagination.total.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[80px] text-center">
                      {t("management.activityLogs.pagination.page", "Page")} {page + 1}{" "}
                      {t("management.activityLogs.pagination.of", "of")} {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasMore}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
