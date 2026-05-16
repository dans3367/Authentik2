import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useAppSelector } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ArrowRight,
  X,
  ArrowDown,
} from "lucide-react";

type NewsletterItem = {
  _id: string;
  newsletterId: string;
  title: string;
  subject: string;
  status: string;
  emailType: string;
  recipientCount: number;
  openCount: number;
  uniqueOpenCount: number;
  clickCount: number;
  scheduledAt?: number;
  sentAt?: number;
  createdAt: number;
  updatedAt: number;
  recipientType?: string;
};

type FilterKey = "all" | "sent" | "scheduled" | "draft" | "live";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sent", label: "Sent" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Draft" },
  { key: "live", label: "Live" },
];

const DRAFT_STATUSES = new Set(["draft", "ready_to_send", "pending_review"]);

function matchesFilter(item: NewsletterItem, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "sent":
      return item.status === "sent";
    case "scheduled":
      return item.status === "scheduled";
    case "draft":
      return DRAFT_STATUSES.has(item.status);
    case "live":
      return item.status === "sending";
  }
}

const statusBadgeStyles: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  sent: {
    dot: "bg-[color:var(--good)]",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    label: "Sent",
  },
  sending: {
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    label: "Live",
  },
  scheduled: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    label: "Scheduled",
  },
  draft: {
    dot: "bg-slate-400 dark:bg-slate-500",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10 dark:bg-slate-500/15",
    label: "Draft",
  },
  ready_to_send: {
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-500/10 dark:bg-sky-500/15",
    label: "Ready",
  },
  pending_review: {
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
    label: "Review",
  },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusBadgeStyles[status] ?? statusBadgeStyles.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium",
        s.bg,
        s.text,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`.replace(".0k", "k");
  }
  return new Intl.NumberFormat("en-US").format(n);
}

function formatLongNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function formatDate(item: NewsletterItem): string {
  if (item.status === "sending") return "Ongoing";
  const ts = item.sentAt ?? item.scheduledAt ?? null;
  if (!ts) return "—";
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (item.status === "scheduled") {
    if (sameDay) {
      return `Tonight ${d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`;
    }
  }
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RateBar({ value, tone }: { value: number | null; tone: "neutral" | "accent" }) {
  if (value == null) return <span className="text-muted-foreground/50">—</span>;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted/70 dark:bg-background/80 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "accent" ? "bg-rose-500 dark:bg-rose-400" : "bg-foreground/70 dark:bg-foreground/55",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-foreground/80 w-12 text-right">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function getRates(item: NewsletterItem) {
  if (item.status !== "sent" || !item.recipientCount) {
    return { openRate: null as number | null, clickRate: null as number | null };
  }
  const openRate = (item.uniqueOpenCount / item.recipientCount) * 100;
  const clickRate = (item.clickCount / item.recipientCount) * 100;
  return { openRate, clickRate };
}

function getRecipientSubtitle(item: NewsletterItem): string {
  const parts: string[] = [];
  if (item.recipientType === "tags") parts.push("audience: tagged");
  else if (item.recipientType === "selected") parts.push("selected");
  else parts.push("all subs");
  if (item.recipientCount) parts.push(formatLongNumber(item.recipientCount));
  return parts.join(" · ");
}

const MAX_ROWS = 6;

export function NewsletterStatsCard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useReduxAuth();
  const tenantId = (user as any)?.tenantId as string | undefined;
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const items = useConvexQuery(
    api.newsletterListItems.listByTenant,
    tenantId
      ? {
          tenantId,
          shopId: selectedShopId ?? undefined,
          archived: false,
          emailType: "newsletter",
        }
      : "skip",
  ) as NewsletterItem[] | undefined;

  const [filter, setFilter] = useState<FilterKey>("all");

  const sorted = useMemo(() => {
    if (!items) return [];
    const rank: Record<string, number> = {
      sending: 0,
      scheduled: 1,
      sent: 2,
      ready_to_send: 3,
      pending_review: 3,
      draft: 4,
    };
    return [...items].sort((a, b) => {
      const ra = rank[a.status] ?? 5;
      const rb = rank[b.status] ?? 5;
      if (ra !== rb) return ra - rb;
      const ta = a.sentAt ?? a.scheduledAt ?? a.updatedAt;
      const tb = b.sentAt ?? b.scheduledAt ?? b.updatedAt;
      return tb - ta;
    });
  }, [items]);

  const filtered = useMemo(
    () => sorted.filter((item) => matchesFilter(item, filter)),
    [sorted, filter],
  );

  const rows = filtered.slice(0, MAX_ROWS);
  const total = sorted.length;

  const isLoading = items === undefined;

  return (
    <Card className="h-full rounded-2xl border-border/50 dark:border-border/70 bg-card text-card-foreground flex flex-col">
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold tracking-tight">
                {t("dashboard.newsletterStats.title", "Recent newsletters")}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono">
                {isLoading
                  ? "loading…"
                  : `showing ${rows.length} of ${total} · click row for details`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/newsletters")}
              className="h-8 rounded-lg text-xs font-medium gap-1.5 dark:bg-background/60 dark:hover:bg-accent"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-0 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "border-primary/20 bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                      : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-muted/30 dark:hover:bg-muted/55",
                  )}
                >
                  {f.label}
                  {active && <X className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground/70 bg-muted/60 dark:bg-muted/35 border border-border/30 px-2 py-1 rounded-md whitespace-nowrap">
            {total} newsletters
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div className="w-10 h-10 rounded-full bg-muted dark:bg-muted/45 flex items-center justify-center mb-3">
              <BarChart3 className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <p className="text-xs font-medium text-muted-foreground/80">
              {filter === "all"
                ? "No newsletters yet"
                : `No ${filter} newsletters`}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto rounded-xl">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                  <th className="text-left pb-2 pr-4 font-semibold">Newsletter</th>
                  <th className="text-left pb-2 pr-4 font-semibold">Status</th>
                  <th className="text-right pb-2 pr-4 font-semibold">Sent</th>
                  <th className="text-left pb-2 pr-4 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      Open rate
                      <ArrowDown className="w-2.5 h-2.5" />
                    </span>
                  </th>
                  <th className="text-left pb-2 pr-4 font-semibold">Click rate</th>
                  <th className="text-right pb-2 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const { openRate, clickRate } = getRates(item);
                  const dim = item.status !== "sent" && item.status !== "sending";
                  return (
                    <tr
                      key={item._id}
                      onClick={() => setLocation(`/newsletters/${item.newsletterId}`)}
                      className="group cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4 border-t border-border/40 group-hover:bg-muted/35 dark:group-hover:bg-muted/25 first:rounded-l-lg transition-colors">
                        <div className="min-w-0 max-w-[240px]">
                          <p className="text-sm font-semibold text-foreground truncate leading-tight">
                            {item.title || item.subject || "Untitled"}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5 font-mono">
                            {getRecipientSubtitle(item)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 border-t border-border/40 group-hover:bg-muted/35 dark:group-hover:bg-muted/25 transition-colors">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3 pr-4 border-t border-border/40 text-right font-mono text-xs tabular-nums text-foreground/80 group-hover:bg-muted/35 dark:group-hover:bg-muted/25 transition-colors">
                        {item.recipientCount
                          ? formatLongNumber(item.recipientCount)
                          : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className={cn("py-3 pr-4 border-t border-border/40 group-hover:bg-muted/35 dark:group-hover:bg-muted/25 transition-colors", dim && "opacity-60")}>
                        <RateBar value={openRate} tone="neutral" />
                      </td>
                      <td className={cn("py-3 pr-4 border-t border-border/40 group-hover:bg-muted/35 dark:group-hover:bg-muted/25 transition-colors", dim && "opacity-60")}>
                        <RateBar value={clickRate} tone="accent" />
                      </td>
                      <td className="py-3 border-t border-border/40 text-right font-mono text-[11px] text-muted-foreground/70 whitespace-nowrap group-hover:bg-muted/35 dark:group-hover:bg-muted/25 last:rounded-r-lg transition-colors">
                        {formatDate(item)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
