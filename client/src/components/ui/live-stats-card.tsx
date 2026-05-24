import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantRecentEvents } from "@/hooks/useNewsletterTracking";
import {
  X,
  AlertTriangle,
  Mail,
  MousePointer,
  Send,
  CheckCircle2,
  Ban,
  XCircle,
  Inbox,
  Pause,
  Play,
  Smile,
} from "lucide-react";

const PAUSED_STORAGE_KEY = "liveStatsCard.paused";

function readPausedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PAUSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

type EventConfig = {
  icon: React.ElementType;
  iconColor: string;
  bubbleBg: string;
  verb: string;
};

const EVENT_CONFIG: Record<string, EventConfig> = {
  unsubscribed: {
    icon: X,
    iconColor: "text-neutral-500 dark:text-neutral-400",
    bubbleBg: "bg-neutral-200/70 dark:bg-neutral-800/60",
    verb: "unsubscribed from",
  },
  bounced: {
    icon: AlertTriangle,
    iconColor: "text-rose-500 dark:text-rose-400",
    bubbleBg: "bg-rose-100/80 dark:bg-rose-950/40",
    verb: "bounced from",
  },
  opened: {
    icon: Mail,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    bubbleBg: "bg-emerald-100/70 dark:bg-emerald-950/40",
    verb: "opened",
  },
  clicked: {
    icon: MousePointer,
    iconColor: "text-rose-500 dark:text-rose-400",
    bubbleBg: "bg-rose-100/70 dark:bg-rose-950/40",
    verb: "clicked in",
  },
  delivered: {
    icon: CheckCircle2,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    bubbleBg: "bg-emerald-100/70 dark:bg-emerald-950/40",
    verb: "delivered to",
  },
  sent: {
    icon: Send,
    iconColor: "text-sky-600 dark:text-sky-400",
    bubbleBg: "bg-sky-100/70 dark:bg-sky-950/40",
    verb: "sent to",
  },
  complained: {
    icon: Ban,
    iconColor: "text-rose-500 dark:text-rose-400",
    bubbleBg: "bg-rose-100/70 dark:bg-rose-950/40",
    verb: "complained about",
  },
  failed: {
    icon: XCircle,
    iconColor: "text-red-500 dark:text-red-400",
    bubbleBg: "bg-red-100/70 dark:bg-red-950/40",
    verb: "failed for",
  },
  suppressed: {
    icon: Ban,
    iconColor: "text-orange-500 dark:text-orange-400",
    bubbleBg: "bg-orange-100/70 dark:bg-orange-950/40",
    verb: "suppressed for",
  },
  queued: {
    icon: Inbox,
    iconColor: "text-neutral-500 dark:text-neutral-400",
    bubbleBg: "bg-neutral-100 dark:bg-neutral-900",
    verb: "queued for",
  },
  reacted: {
    icon: Smile,
    iconColor: "text-amber-500 dark:text-amber-400",
    bubbleBg: "bg-amber-100/70 dark:bg-amber-950/40",
    verb: "reacted to",
  },
};

const REACTION_EMOJI_BY_TYPE: Record<string, string> = {
  love_it: "❤️",
  liked_it: "👍",
  cool: "😎",
  dont_agree: "🤔",
  dislike: "👎",
};

const REACTION_ENDPOINT_PATH = "/api/newsletter-reactions/react";

function parseReactionEmojiFromLink(link: string | undefined | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(String(link), window.location.origin);
    if (url.pathname !== REACTION_ENDPOINT_PATH) return null;
    const type = url.searchParams.get("type");
    return (type && REACTION_EMOJI_BY_TYPE[type]) || null;
  } catch {
    return null;
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

interface LiveStatsCardProps {
  tenantId: string;
  shopId?: string | null;
}

export function LiveStatsCard({ tenantId, shopId }: LiveStatsCardProps) {
  const liveActiveItems = useConvexQuery(
    api.newsletterListItems.listByTenant,
    { tenantId, shopId: shopId ?? undefined, archived: false, emailType: "newsletter" },
  );
  const liveRecentEvents = useTenantRecentEvents(tenantId, 30);

  const [paused, setPaused] = useState<boolean>(readPausedPreference);

  useEffect(() => {
    try {
      window.localStorage.setItem(PAUSED_STORAGE_KEY, String(paused));
    } catch {
      /* ignore storage errors (private mode, quota) */
    }
  }, [paused]);

  // Frozen snapshot captured only while paused. When running, we read the
  // live values directly. On mount with pause active, we capture the first
  // ready snapshot so a refresh still shows data (then holds).
  type Frozen = {
    activeItems: typeof liveActiveItems;
    recentEvents: typeof liveRecentEvents;
  };
  const [frozen, setFrozen] = useState<Frozen | null>(null);

  useEffect(() => {
    if (!paused) {
      if (frozen !== null) setFrozen(null);
      return;
    }
    if (frozen !== null) return;
    if (liveActiveItems === undefined || liveRecentEvents === undefined) return;
    setFrozen({ activeItems: liveActiveItems, recentEvents: liveRecentEvents });
  }, [paused, frozen, liveActiveItems, liveRecentEvents]);

  const activeItems = paused ? (frozen?.activeItems ?? liveActiveItems) : liveActiveItems;
  const recentEvents = paused ? (frozen?.recentEvents ?? liveRecentEvents) : liveRecentEvents;

  const titleByCampaign = useMemo(() => {
    const map = new Map<string, string>();
    (activeItems ?? []).forEach((i) =>
      map.set(i.newsletterId, i.title || i.subject || "Untitled"),
    );
    return map;
  }, [activeItems]);

  const activeIds = useMemo(() => {
    if (!activeItems) return null;
    return new Set(activeItems.map((i) => i.newsletterId));
  }, [activeItems]);

  const events = useMemo(() => {
    if (!recentEvents || !activeIds) return null;
    // Newsletter events: only show those tied to an active list item.
    // Individual events: always show — they don't have a listItem row.
    return recentEvents.filter(
      (e: any) => e.sendType === "individual" || activeIds.has(e.campaignId),
    );
  }, [recentEvents, activeIds]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTopIdRef = useRef<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (paused) return; // no flash animation while frozen
    if (!events || events.length === 0) return;
    const topId = events[0]._id;
    if (lastTopIdRef.current !== null && lastTopIdRef.current !== topId) {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setFlashId(topId);
      const timeout = setTimeout(() => setFlashId(null), 1500);
      lastTopIdRef.current = topId;
      return () => clearTimeout(timeout);
    }
    lastTopIdRef.current = topId;
  }, [events, paused]);

  const isLoading = !activeItems || !recentEvents;

  return (
    <Card className="h-full max-h-[540px] rounded-2xl border-border/60 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-bold tracking-tight">Live activity</h3>
          <p className="text-[11px] font-mono text-muted-foreground/70 tracking-tight">
            real-time events · autoscrolling
          </p>
        </div>
        <div className="inline-flex items-center gap-2">
          {paused ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted">
              <span className="inline-flex w-1.5 h-1.5 rounded-full bg-muted-foreground/70" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground">
                PAUSED
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100/80 dark:bg-rose-950/40">
              <span className="relative flex w-1.5 h-1.5">
                <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-rose-500" />
              </span>
              <span className="text-[10px] font-mono font-bold tracking-wider text-rose-600 dark:text-rose-400">
                LIVE
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume live updates" : "Pause live updates"}
            aria-pressed={paused}
            title={paused ? "Resume live updates" : "Pause live updates"}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid="live-stats-pause-toggle"
          >
            {paused ? (
              <Play className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <Pause className="w-3.5 h-3.5" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      <div className="border-t border-border/60" />

      {/* Event list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto divide-y divide-border/60 scroll-smooth"
        data-testid="live-stats-feed"
      >
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          events.map((event) => {
            const linkFromMetadata =
              event.metadata && typeof event.metadata.link === "string"
                ? event.metadata.link
                : null;
            const reactionEmojiFromMetadata =
              event.eventType === "reacted" && event.metadata?.emoji
                ? String(event.metadata.emoji)
                : null;
            const reactionEmojiFromClick =
              event.eventType === "clicked"
                ? parseReactionEmojiFromLink(linkFromMetadata)
                : null;
            const reactionEmoji = reactionEmojiFromMetadata ?? reactionEmojiFromClick;
            const effectiveType = reactionEmoji ? "reacted" : event.eventType;
            const cfg = EVENT_CONFIG[effectiveType] ?? EVENT_CONFIG.queued;
            const Icon = cfg.icon;
            const isIndividual = (event as any).sendType === "individual";
            const title = isIndividual
              ? "Direct email"
              : titleByCampaign.get((event as any).campaignId) ?? "Newsletter";
            const clickedPath =
              event.eventType === "clicked" && linkFromMetadata && !reactionEmojiFromClick
                ? (() => {
                    try {
                      return new URL(linkFromMetadata, window.location.origin).pathname;
                    } catch {
                      return linkFromMetadata;
                    }
                  })()
                : null;
            return (
              <div
                key={event._id}
                className={`flex items-start gap-3 px-5 py-3.5 transition-colors duration-1000 ${
                  flashId === event._id ? "bg-rose-50/60 dark:bg-rose-950/20" : ""
                }`}
                data-testid={`live-event-${event.eventType}`}
              >
                <div
                  className={`w-8 h-8 rounded-full ${cfg.bubbleBg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  {reactionEmoji ? (
                    <span className="text-base leading-none" aria-hidden>
                      {reactionEmoji}
                    </span>
                  ) : (
                    <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} strokeWidth={2.25} />
                  )}
                </div>
                <p className="flex-1 text-[13px] leading-snug text-foreground">
                  <span className="font-bold">{event.recipientEmail}</span>
                  {reactionEmoji ? (
                    <>
                      <span className="text-muted-foreground"> reacted </span>
                      <span aria-hidden>{reactionEmoji}</span>
                      <span className="text-muted-foreground"> in </span>
                      <span className="font-bold">{title}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground"> {cfg.verb} </span>
                      <span className="font-bold">{title}</span>
                    </>
                  )}
                  {clickedPath && (
                    <span className="text-muted-foreground/70 font-mono">
                      {" "}
                      {clickedPath}
                    </span>
                  )}
                </p>
                <span className="text-[11px] font-mono text-muted-foreground/60 flex-shrink-0 whitespace-nowrap pt-0.5">
                  {formatRelativeTime(event.occurredAt)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-5 py-12">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <p className="text-xs font-medium text-muted-foreground/80">
              No activity yet
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/50 mt-1">
              events will appear here
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
