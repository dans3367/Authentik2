import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { CalendarDays, RefreshCw, X, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import CustomCalendar from "@/components/CustomCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ActivityIcon from "@assets/28_new.svg";

type ApiActivityType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "preference_updated";

interface ApiActivity {
  id: string;
  activityType: ApiActivityType;
  occurredAt: string;
  activityData?: string | null;
  campaign?: { id: string; name: string } | null;
  newsletter?: { id: string; name?: string; title?: string } | null;
}

interface ParsedActivityData {
  subject?: string;
  recipient?: string;
  from?: string;
  email_id?: string;
  messageId?: string;
  type?: string;
  source?: string;
}

interface TimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  occurredAt: string;
  variant: "filled-green" | "filled-purple" | "filled-rose" | "hollow";
  activityType?: ApiActivityType;
  recipient?: string;
  from?: string;
  messageId?: string;
  emailId?: string;
  campaignName?: string;
  newsletterName?: string;
  specialBadge?: "birthday-card" | "birthday-promo" | "birthday-invitation";
}

function tryParseActivityData(raw?: string | null): ParsedActivityData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedActivityData;
  } catch {
    return null;
  }
}

function getSpecialBadge(parsed: ParsedActivityData | null): TimelineItem["specialBadge"] {
  if (!parsed) return undefined;
  if (parsed.type === "birthday-card" || parsed.type === "birthday-card-test") return "birthday-card";
  if (parsed.type === "birthday-promotion-test") return "birthday-promo";
  if (parsed.source === "manual_birthday_invitation") return "birthday-invitation";
  return undefined;
}

function formatActivityDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activityTypeLabel(type: ApiActivityType): string {
  switch (type) {
    case "sent": return "Sent";
    case "delivered": return "Delivered";
    case "opened": return "Opened";
    case "clicked": return "Clicked";
    case "bounced": return "Bounced";
    case "complained": return "Complained";
    case "unsubscribed": return "Unsubscribed";
    case "preference_updated": return "Preferences updated";
  }
}

function activityTypePillClass(type: ApiActivityType): string {
  switch (type) {
    case "sent":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "delivered":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "opened":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "clicked":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "bounced":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "complained":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "unsubscribed":
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    case "preference_updated":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
  }
}

interface ContactRecentActivityProps {
  contactId: string;
  addedDate?: string | Date | null;
  limit?: number;
}

function buildTitle(a: ApiActivity): string {
  const target = a.campaign?.name || a.newsletter?.title || a.newsletter?.name;
  switch (a.activityType) {
    case "opened":
      return target ? `Opened "${target}"` : "Opened email";
    case "clicked":
      return target ? `Clicked link in "${target}"` : "Clicked link";
    case "delivered":
      return "Email delivered";
    case "sent":
      return "Email sent";
    case "bounced":
      return "Email bounced";
    case "complained":
      return "Marked as spam";
    case "unsubscribed":
      return "Unsubscribed";
    case "preference_updated":
      return "Updated email preferences";
    default:
      return "Activity";
  }
}

function buildSubtitle(a: ApiActivity): string | undefined {
  const target = a.campaign?.name || a.newsletter?.title || a.newsletter?.name;
  if (a.campaign && target) return `Campaign · ${target}`;
  if (a.newsletter && target) return `Newsletter · ${target}`;
  return undefined;
}

function variantFor(type: ApiActivityType): TimelineItem["variant"] {
  switch (type) {
    case "opened":
      return "filled-green";
    case "clicked":
      return "filled-purple";
    case "bounced":
    case "complained":
      return "filled-rose";
    default:
      return "hollow";
  }
}

function formatLastUpdated(ts: number): string {
  return format(new Date(ts), "h:mm:ss a");
}

export function ContactRecentActivity({ contactId, addedDate, limit = 50 }: ContactRecentActivityProps) {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 720px)").matches : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 720px)");
    const handler = (e: MediaQueryListEvent) => setIsWideScreen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const dateRange = useMemo(() => ({ from: dateFrom, to: dateTo }), [dateFrom, dateTo]);

  const { data, isLoading, error, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["/api/email-contacts", contactId, "activity", { limit, dateRange }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", String(limit));
      if (dateRange.from) {
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        params.append("from", fromDate.toISOString());
      }
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        params.append("to", toDate.toISOString());
      }
      const apiResponse = await apiRequest(
        "GET",
        `/api/email-contacts/${contactId}/activity?${params.toString()}`
      );
      return apiResponse.json();
    },
    enabled: !!contactId,
    placeholderData: keepPreviousData,
    staleTime: 5000,
  });

  // All-activities query for the calendar's dot indicators (independent of date filter)
  const { data: allActivitiesData } = useQuery({
    queryKey: ["/api/email-contacts", contactId, "activity", "all"],
    queryFn: async () => {
      const apiResponse = await apiRequest(
        "GET",
        `/api/email-contacts/${contactId}/activity?limit=1000`
      );
      return apiResponse.json();
    },
    enabled: !!contactId,
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  const activities: ApiActivity[] = (data as any)?.activities || [];
  const allActivities: ApiActivity[] = (allActivitiesData as any)?.activities || [];

  const activityData = useMemo(() => {
    const map: Record<string, { type: ApiActivityType; count: number }[]> = {};
    for (const a of allActivities) {
      const dateKey = format(new Date(a.occurredAt), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      const existing = map[dateKey].find(e => e.type === a.activityType);
      if (existing) existing.count += 1;
      else map[dateKey].push({ type: a.activityType, count: 1 });
    }
    return map;
  }, [allActivities]);
  const hasDateFilter = !!(dateFrom || dateTo);

  const items: TimelineItem[] = activities.map(a => {
    const parsed = tryParseActivityData(a.activityData);
    const subject = parsed?.subject?.trim();
    const campaignName = a.campaign?.name;
    const newsletterName = a.newsletter?.title || a.newsletter?.name;
    const fallbackTitle = buildTitle(a);
    return {
      id: a.id,
      title: subject || fallbackTitle,
      subtitle: buildSubtitle(a),
      occurredAt: a.occurredAt,
      variant: variantFor(a.activityType),
      activityType: a.activityType,
      recipient: parsed?.recipient,
      from: parsed?.from,
      messageId:
        parsed?.messageId && parsed.messageId !== parsed.email_id
          ? parsed.messageId
          : undefined,
      emailId: parsed?.email_id,
      campaignName,
      newsletterName,
      specialBadge: getSpecialBadge(parsed),
    };
  });

  if (addedDate && !hasDateFilter) {
    items.push({
      id: `subscribed-${contactId}`,
      title: "Subscribed",
      subtitle: undefined,
      occurredAt: typeof addedDate === "string" ? addedDate : addedDate.toISOString(),
      variant: "hollow",
    });
  }

  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const clearFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const filterLabel = (() => {
    if (!hasDateFilter) return "Filter by date";
    if (dateFrom && dateTo) return `${format(dateFrom, "MMM d")} – ${format(dateTo, "MMM d")}`;
    if (dateFrom) return `From ${format(dateFrom, "MMM d")}`;
    if (dateTo) return `Until ${format(dateTo, "MMM d")}`;
    return "Filter by date";
  })();

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <Zap className="w-6 h-6" />
            Activity Timeline
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Recent email activities for this contact
              {hasDateFilter && (
                <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">• Filtered</span>
              )}
            </p>
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Last updated: {formatLastUpdated(dataUpdatedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={hasDateFilter ? "default" : "outline"}
            size="sm"
            className="relative"
            onClick={() => setPickerOpen(true)}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            {filterLabel}
            {hasDateFilter && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  clearFilter();
                }}
                className="ml-2 hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Centered date-range picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="p-0 overflow-hidden gap-0 w-[calc(100vw-2rem)] sm:max-w-[760px] max-h-[calc(100vh-2rem)] flex flex-col">
          <DialogHeader className="px-5 py-3 border-b">
            <DialogTitle className="text-base">Filter by date</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <CustomCalendar
              mode="range"
              selected={{ from: dateFrom, to: dateTo }}
              onSelect={range => {
                if (range && typeof range === "object" && "from" in range) {
                  setDateFrom(range.from);
                  setDateTo(range.to);
                  if (range.from && range.to) setPickerOpen(false);
                } else {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }
              }}
              numberOfMonths={isWideScreen ? 2 : 1}
              activityData={activityData}
              className="border-0 rounded-none"
            />

            {/* Activity Legend */}
            <div className="border-t p-3 bg-slate-50 dark:bg-slate-800">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Activity Legend:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Issues</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Clicked</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Opened</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-300" />
                  <span>Delivered</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Dots indicate email activity. Hover over dots for details.
              </div>
            </div>
          </div>

          {/* Footer presets + actions */}
          <div className="shrink-0 p-3 border-t flex flex-wrap items-center gap-2 bg-background">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                setDateFrom(addDays(today, -7));
                setDateTo(today);
                setPickerOpen(false);
              }}
            >
              Last 7 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                setDateFrom(addDays(today, -30));
                setDateTo(today);
                setPickerOpen(false);
              }}
            >
              Last 30 days
            </Button>
            <Button variant="outline" size="sm" onClick={clearFilter}>
              Clear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Section heading + Timeline */}
      {activities.length > 0 && (
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400 mb-5">
          Recent activity
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading activity…</p>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn’t load activity: {(error as Error).message || "Unknown error"}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8">
          <img
            src={ActivityIcon}
            className="w-[200px] h-auto mx-auto mb-2"
            alt="Activity Timeline Icon"
          />
          <p className="text-slate-600 dark:text-slate-400">
            {hasDateFilter
              ? "No activities found for the selected date range"
              : "No activity recorded yet"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
            {hasDateFilter
              ? "Try adjusting the date range or clearing the filter to see more activities"
              : "Email activities will appear here when emails are sent to this contact"}
          </p>
        </div>
      ) : (
        <ol className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
          {items.map(item => (
            <li key={item.id} className="relative">
              <span
                className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full ${dotClass(item.variant)}`}
              />

              {/* Title row: type pill + optional special badge + subject/title + timestamp */}
              <div className="flex flex-wrap items-center gap-2">
                {item.activityType && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide ${activityTypePillClass(item.activityType)}`}
                  >
                    {activityTypeLabel(item.activityType)}
                  </span>
                )}
                {item.specialBadge === "birthday-card" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800">
                    Birthday Card
                  </span>
                )}
                {item.specialBadge === "birthday-promo" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800">
                    Birthday Promo (Test)
                  </span>
                )}
                {item.specialBadge === "birthday-invitation" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800">
                    Birthday Invitation
                  </span>
                )}
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight min-w-0 flex-1 truncate">
                  {item.title}
                </p>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {formatActivityDateTime(item.occurredAt)}
              </p>

              {item.recipient && (
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5">
                  <span className="font-medium">To:</span> {item.recipient}
                </p>
              )}
              {item.from && (
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  <span className="font-medium">From:</span> {item.from}
                </p>
              )}

              {(item.campaignName || item.newsletterName) && (
                <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                  {item.campaignName && (
                    <p>
                      <span className="font-medium">Campaign:</span> {item.campaignName}
                    </p>
                  )}
                  {item.newsletterName && (
                    <p>
                      <span className="font-medium">Newsletter:</span> {item.newsletterName}
                    </p>
                  )}
                </div>
              )}

              {(item.emailId || item.messageId) && (
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                  {item.emailId && (
                    <p>
                      <span className="font-medium">Email ID:</span>{" "}
                      <span className="font-mono break-all">{item.emailId}</span>
                    </p>
                  )}
                  {item.messageId && (
                    <p>
                      <span className="font-medium">Message ID:</span>{" "}
                      <span className="font-mono break-all">{item.messageId}</span>
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function dotClass(variant: TimelineItem["variant"]): string {
  switch (variant) {
    case "filled-green":
      return "bg-emerald-500";
    case "filled-purple":
      return "bg-indigo-500";
    case "filled-rose":
      return "bg-rose-500";
    case "hollow":
    default:
      return "bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700";
  }
}

export default ContactRecentActivity;
