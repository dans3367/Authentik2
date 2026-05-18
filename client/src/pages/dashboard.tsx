import { useState, useEffect, useRef } from "react";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useLocation } from "wouter";
import { useQuery as useConvexQuery } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import { useAppSelector } from "@/store";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { LiveStatsCard } from "@/components/ui/live-stats-card";
import { UpcomingBirthdaysCard } from "@/components/ui/upcoming-birthdays-card";
import { UpcomingAppointmentsCard } from "@/components/ui/upcoming-appointments-card";
import { UpcomingScheduledEmailsCard } from "@/components/ui/upcoming-scheduled-emails-card";
import { NewsletterStatsCard } from "@/components/ui/newsletter-stats-card";
import { Button } from "@/components/ui/button";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LayoutDashboard,
  Sparkles,
  Mail,
  Users,
  Newspaper,
  CalendarPlus,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
  Plus,
  CheckCircle2,
  ArrowUpRight,
  Send,
  UserPlus,
  GripVertical,
  Settings2,
  Check,
  RotateCcw,
  Eye,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDashboardHighlights } from "@/hooks/useStats";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorPickerModal } from "@/components/EditorPickerModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

const CARD_ORDER_KEY = "dashboard.cardOrder";
const CARD_SIZES_KEY = "dashboard.cardSizes";
const CARD_VISIBILITY_KEY = "dashboard.cardVisibility";
const GRID_GAP_PX = 16; // tailwind gap-4
const MIN_COL_SPAN = 3;
const MAX_COL_SPAN = 12;

const DEFAULT_CARD_ORDER = [
  "mainSlot",
  "liveStats",
  "scheduledEmails",
  "appointments",
  "birthdays",
] as const;
type CardId = (typeof DEFAULT_CARD_ORDER)[number];

const DEFAULT_CARD_SIZES: Record<CardId, number> = {
  mainSlot: 8,
  liveStats: 4,
  scheduledEmails: 6,
  appointments: 6,
  birthdays: 7,
};

const DEFAULT_CARD_VISIBILITY: Record<CardId, boolean> = {
  mainSlot: true,
  liveStats: true,
  scheduledEmails: true,
  appointments: true,
  birthdays: true,
};

const CARD_LABELS: Record<CardId, string> = {
  mainSlot: "Newsletter stats",
  liveStats: "Live activity",
  scheduledEmails: "Scheduled emails",
  appointments: "Upcoming appointments",
  birthdays: "Upcoming birthdays",
};

function readCardOrder(): CardId[] {
  if (typeof window === "undefined") return [...DEFAULT_CARD_ORDER];
  try {
    const raw = window.localStorage.getItem(CARD_ORDER_KEY);
    if (!raw) return [...DEFAULT_CARD_ORDER];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_CARD_ORDER];
    const valid = parsed.filter(
      (id): id is CardId =>
        typeof id === "string" && (DEFAULT_CARD_ORDER as readonly string[]).includes(id),
    );
    const missing = DEFAULT_CARD_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return [...DEFAULT_CARD_ORDER];
  }
}

function readCardSizes(): Record<CardId, number> {
  if (typeof window === "undefined") return { ...DEFAULT_CARD_SIZES };
  try {
    const raw = window.localStorage.getItem(CARD_SIZES_KEY);
    if (!raw) return { ...DEFAULT_CARD_SIZES };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_CARD_SIZES };
    const result: Record<CardId, number> = { ...DEFAULT_CARD_SIZES };
    for (const id of DEFAULT_CARD_ORDER) {
      const val = (parsed as Record<string, unknown>)[id];
      if (typeof val === "number" && Number.isFinite(val)) {
        result[id] = Math.max(MIN_COL_SPAN, Math.min(MAX_COL_SPAN, Math.round(val)));
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_CARD_SIZES };
  }
}

function readCardVisibility(): Record<CardId, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_CARD_VISIBILITY };
  try {
    const raw = window.localStorage.getItem(CARD_VISIBILITY_KEY);
    if (!raw) return { ...DEFAULT_CARD_VISIBILITY };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_CARD_VISIBILITY };
    const result: Record<CardId, boolean> = { ...DEFAULT_CARD_VISIBILITY };
    for (const id of DEFAULT_CARD_ORDER) {
      const val = (parsed as Record<string, unknown>)[id];
      if (typeof val === "boolean") result[id] = val;
    }
    return result;
  } catch {
    return { ...DEFAULT_CARD_VISIBILITY };
  }
}

function SortableCard({
  id,
  colSpan,
  gridRef,
  onResize,
  editMode,
  children,
}: {
  id: CardId;
  colSpan: number;
  gridRef: React.RefObject<HTMLDivElement>;
  onResize: (id: CardId, nextSpan: number) => void;
  editMode: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    gridColumn: `span ${colSpan} / span ${colSpan}`,
  };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const gridWidth = grid.getBoundingClientRect().width;
    const step = (gridWidth + GRID_GAP_PX) / 12;
    if (!Number.isFinite(step) || step <= 0) return;
    const startX = e.clientX;
    const startSpan = colSpan;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const deltaCols = Math.round((ev.clientX - startX) / step);
      const next = Math.max(
        MIN_COL_SPAN,
        Math.min(MAX_COL_SPAN, startSpan + deltaCols),
      );
      onResize(id, next);
    };
    const onUp = (ev: PointerEvent) => {
      try {
        handle.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-2xl ${
        editMode
          ? "outline-dashed outline-2 outline-offset-4 outline-primary/40"
          : ""
      }`}
    >
      {editMode && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder card"
          title="Drag to reorder"
          className="absolute -top-2 -left-2 z-20 w-7 h-7 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing touch-none"
          data-testid={`dashboard-drag-handle-${id}`}
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      )}
      {children}
      {editMode && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize card"
          aria-valuenow={colSpan}
          aria-valuemin={MIN_COL_SPAN}
          aria-valuemax={MAX_COL_SPAN}
          onPointerDown={onResizePointerDown}
          className="hidden lg:block absolute top-3 bottom-3 -right-1 w-1.5 rounded-full bg-primary/60 hover:bg-primary transition-colors cursor-col-resize z-20 touch-none"
          data-testid={`dashboard-resize-handle-${id}`}
        />
      )}
    </div>
  );
}

const DROP_ANIMATION: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

function Sparkline({
  data,
  className,
  trend,
}: {
  data: number[];
  className?: string;
  trend: "up" | "down" | "flat";
}) {
  if (!data || data.length < 2) {
    return <span className="h-7 w-[84px] flex-none" aria-hidden />;
  }
  const w = 84;
  const h = 28;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const color =
    trend === "down"
      ? "var(--bad)"
      : trend === "up"
        ? "var(--good)"
        : "var(--ink-4)";
  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

function getGreeting(t: (key: string) => string): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: t("dashboard.greeting.morning"), emoji: "☀️" };
  if (hour < 17) return { text: t("dashboard.greeting.afternoon"), emoji: "🌤️" };
  return { text: t("dashboard.greeting.evening"), emoji: "🌙" };
}

function getFormattedDate(locale: string = "en-US"): string {
  return new Date().toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useReduxAuth();
  const { t, i18n } = useTranslation();
  const greeting = getGreeting(t);
  const { data: highlights, isLoading: highlightsLoading } = useDashboardHighlights();
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [showEditorPicker, setShowEditorPicker] = useState(false);

  const tenantId = (user as any)?.tenantId as string | undefined;
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const activeNewsletters = useConvexQuery(
    api.newsletterListItems.listByTenant,
    tenantId
      ? {
          tenantId,
          shopId: selectedShopId ?? undefined,
          archived: false,
          emailType: "newsletter",
        }
      : "skip",
  );
  // Stale-while-revalidate: keep the last resolved value during shop changes
  // so the dashboard doesn't flash back to the "empty" layout while Convex
  // re-queries for the newly selected shop.
  const lastActiveRef = useRef<typeof activeNewsletters>(undefined);
  useEffect(() => {
    if (activeNewsletters !== undefined) {
      lastActiveRef.current = activeNewsletters;
    }
  }, [activeNewsletters]);
  const effectiveActive = activeNewsletters ?? lastActiveRef.current;
  const activeNewslettersResolved = effectiveActive !== undefined;
  const hasActiveNewsletter = !!effectiveActive && effectiveActive.length > 0;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout_success') === 'true') {
      setShowCheckoutSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const [cardOrder, setCardOrder] = useState<CardId[]>(readCardOrder);
  const [cardSizes, setCardSizes] = useState<Record<CardId, number>>(readCardSizes);
  const [cardVisibility, setCardVisibility] = useState<Record<CardId, boolean>>(
    readCardVisibility,
  );
  const [activeCardId, setActiveCardId] = useState<CardId | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const { layout: serverLayout, isFetched: layoutFetched, saveLayout } = useDashboardLayout();

  // One-time hydration from server into local state (server is source of truth across browsers).
  const hydratedFromServerRef = useRef(false);
  useEffect(() => {
    if (!layoutFetched || hydratedFromServerRef.current) return;
    hydratedFromServerRef.current = true;
    if (!serverLayout) return;

    if (Array.isArray(serverLayout.cardOrder) && serverLayout.cardOrder.length > 0) {
      const valid = serverLayout.cardOrder.filter(
        (id): id is CardId =>
          typeof id === "string" && (DEFAULT_CARD_ORDER as readonly string[]).includes(id),
      );
      const missing = DEFAULT_CARD_ORDER.filter((id) => !valid.includes(id));
      setCardOrder([...valid, ...missing]);
    }

    if (serverLayout.cardSizes && typeof serverLayout.cardSizes === "object") {
      setCardSizes((curr) => {
        const next = { ...curr };
        for (const id of DEFAULT_CARD_ORDER) {
          const val = serverLayout.cardSizes?.[id];
          if (typeof val === "number" && Number.isFinite(val)) {
            next[id] = Math.max(MIN_COL_SPAN, Math.min(MAX_COL_SPAN, Math.round(val)));
          }
        }
        return next;
      });
    }

    if (serverLayout.cardVisibility && typeof serverLayout.cardVisibility === "object") {
      setCardVisibility((curr) => {
        const next = { ...curr };
        for (const id of DEFAULT_CARD_ORDER) {
          const val = serverLayout.cardVisibility?.[id];
          if (typeof val === "boolean") next[id] = val;
        }
        return next;
      });
    }
  }, [layoutFetched, serverLayout]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(cardOrder));
    } catch {
      /* ignore storage errors (private mode, quota) */
    }
  }, [cardOrder]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CARD_SIZES_KEY, JSON.stringify(cardSizes));
    } catch {
      /* ignore storage errors (private mode, quota) */
    }
  }, [cardSizes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CARD_VISIBILITY_KEY, JSON.stringify(cardVisibility));
    } catch {
      /* ignore storage errors (private mode, quota) */
    }
  }, [cardVisibility]);

  // Baseline of the last layout we saved to the server. Used on "Done" to skip
  // the PATCH when nothing actually changed during the edit session.
  const savedLayoutRef = useRef<{
    cardOrder: CardId[];
    cardSizes: Record<CardId, number>;
    cardVisibility: Record<CardId, boolean>;
  } | null>(null);

  useEffect(() => {
    if (!hydratedFromServerRef.current || savedLayoutRef.current) return;
    savedLayoutRef.current = {
      cardOrder: [...cardOrder],
      cardSizes: { ...cardSizes },
      cardVisibility: { ...cardVisibility },
    };
  }, [cardOrder, cardSizes, cardVisibility]);

  const handleCardResize = (id: CardId, nextSpan: number) => {
    setCardSizes((curr) => (curr[id] === nextSpan ? curr : { ...curr, [id]: nextSpan }));
  };

  const handleToggleCardVisibility = (id: CardId) => {
    setCardVisibility((curr) => ({ ...curr, [id]: !curr[id] }));
  };

  const handleResetLayout = () => {
    setCardOrder([...DEFAULT_CARD_ORDER]);
    setCardSizes({ ...DEFAULT_CARD_SIZES });
    setCardVisibility({ ...DEFAULT_CARD_VISIBILITY });
  };

  const handleToggleEditMode = () => {
    if (editMode) {
      const saved = savedLayoutRef.current;
      const orderChanged =
        !saved ||
        saved.cardOrder.length !== cardOrder.length ||
        saved.cardOrder.some((id, i) => id !== cardOrder[i]);
      const sizesChanged =
        !saved ||
        DEFAULT_CARD_ORDER.some((id) => saved.cardSizes[id] !== cardSizes[id]);
      const visibilityChanged =
        !saved ||
        DEFAULT_CARD_ORDER.some(
          (id) => saved.cardVisibility[id] !== cardVisibility[id],
        );
      if (orderChanged || sizesChanged || visibilityChanged) {
        saveLayout({ cardOrder, cardSizes, cardVisibility });
        savedLayoutRef.current = {
          cardOrder: [...cardOrder],
          cardSizes: { ...cardSizes },
          cardVisibility: { ...cardVisibility },
        };
      }
    }
    setEditMode((v) => !v);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as CardId);
  };

  const handleDragCancel = () => setActiveCardId(null);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCardOrder((curr) => {
      const oldIdx = curr.indexOf(active.id as CardId);
      const newIdx = curr.indexOf(over.id as CardId);
      if (oldIdx < 0 || newIdx < 0) return curr;
      return arrayMove(curr, oldIdx, newIdx);
    });
  };

  useSetBreadcrumbs([{ label: t("sidebar.dashboard", "Dashboard"), icon: LayoutDashboard }]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">
            {t("dashboard.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const firstName = user.name?.split(" ")[0] || user.email?.split("@")[0] || "there";

  const statCards = [
    {
      label: t("dashboard.highlights.contacts"),
      icon: Users,
      metric: highlights?.totalContacts,
    },
    {
      label: t("dashboard.highlights.emailsSent"),
      icon: Mail,
      metric: highlights?.emailsSentThisMonth,
    },
    {
      label: t("dashboard.highlights.newsletters"),
      icon: Newspaper,
      metric: highlights?.newslettersSent,
    },
    {
      label: t("dashboard.highlights.appointments"),
      icon: CalendarCheck,
      metric: highlights?.upcomingAppointments,
    },
  ];

  const quickActions = [
    {
      label: t("dashboard.quickActions.newNewsletter"),
      icon: Newspaper,
      onClick: () => setShowEditorPicker(true),
      accent: "hover:border-blue-500/40 hover:bg-blue-500/5 dark:hover:bg-blue-500/10",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: t("dashboard.quickActions.sendEmail"),
      icon: Send,
      onClick: () => setLocation("/email-compose"),
      accent: "hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("dashboard.quickActions.addContact"),
      icon: UserPlus,
      onClick: () => setLocation("/contacts?action=add"),
      accent: "hover:border-violet-500/40 hover:bg-violet-500/5 dark:hover:bg-violet-500/10",
      iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: t("dashboard.quickActions.bookAppointment"),
      icon: CalendarPlus,
      onClick: () => setLocation("/appointments"),
      accent: "hover:border-amber-500/40 hover:bg-amber-500/5 dark:hover:bg-amber-500/10",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <>
      <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6 overflow-y-auto">
        {/* Checkout Success Notification */}
        {showCheckoutSuccess && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Payment Successful!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                Your subscription has been activated. You're all set to start using the platform.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCheckoutSuccess(false)}
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 rounded-xl"
            >
              ×
            </Button>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pt-1">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-[0.15em]">
              {getFormattedDate(i18n.language === 'es' ? 'es-ES' : 'en-US')}
            </p>
            <h1
              className="text-2xl sm:text-3xl lg:text-[2rem] font-extrabold tracking-tight leading-none"
              data-testid="text-dashboard-title"
            >
              {greeting.text}, {firstName}
            </h1>
            <p
              className="max-w-2xl text-sm leading-5 text-muted-foreground/80"
              data-testid="text-dashboard-welcome"
            >
              {t("dashboard.welcomeMessage")}
            </p>
          </div>
        </div>

        {/* Layout edit-mode toggle */}
        <div className="flex items-center justify-end gap-2">
          {editMode && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Show or hide dashboard cards"
                  title="Show or hide cards"
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                  data-testid="dashboard-cards-visibility"
                >
                  <Eye className="w-4 h-4" />
                  <span>Cards</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em] px-2 pb-1">
                    Visible cards
                  </p>
                  {DEFAULT_CARD_ORDER.map((id) => {
                    const visible = cardVisibility[id] ?? true;
                    const visibleCount = DEFAULT_CARD_ORDER.filter(
                      (cid) => cardVisibility[cid] ?? true,
                    ).length;
                    const disableOff = visible && visibleCount <= 1;
                    return (
                      <label
                        key={id}
                        className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-muted/40 cursor-pointer"
                      >
                        <span className="text-sm text-foreground truncate">
                          {CARD_LABELS[id]}
                        </span>
                        <Switch
                          checked={visible}
                          disabled={disableOff}
                          onCheckedChange={() => handleToggleCardVisibility(id)}
                          aria-label={`Show ${CARD_LABELS[id]}`}
                          data-testid={`dashboard-card-visibility-${id}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {editMode && (
            <button
              type="button"
              onClick={handleResetLayout}
              aria-label="Reset dashboard layout to defaults"
              title="Reset layout to defaults"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              data-testid="dashboard-reset-layout"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="dashboard-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleToggleEditMode}
            aria-pressed={editMode}
            aria-label={editMode ? "Save layout and exit edit mode" : "Edit dashboard layout"}
            title={editMode ? "Save and exit edit mode" : "Edit dashboard layout"}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
              editMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
            data-testid="dashboard-edit-layout-toggle"
          >
            {editMode ? (
              <Check className="w-4 h-4" />
            ) : (
              <Settings2 className="w-4 h-4" />
            )}
            <span>{editMode ? "Done" : "Edit layout"}</span>
          </button>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`group flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card transition-all duration-200 text-left ${action.accent}`}
              data-testid={`menu-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className={`w-9 h-9 rounded-lg ${action.iconBg} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                <action.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground/90 truncate block">
                  {action.label}
                </span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground/60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Stat Cards — Editorial Precision: single panel, hairline dividers, serif numerals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-[10px] border border-border bg-card overflow-hidden shadow-[0_1px_0_rgba(20,16,10,.02),0_1px_2px_rgba(20,16,10,.03)]">
          {statCards.map((stat, index) => {
            const change = stat.metric?.change;
            const hasChange = change !== null && change !== undefined;
            const isUp = hasChange && change >= 0;
            const borders = [
              "border-r border-b lg:border-b-0",
              "border-b lg:border-b-0 lg:border-r",
              "border-r",
              "",
            ][index];
            return (
              <div
                key={index}
                className={`relative flex flex-col gap-2.5 p-4 sm:p-5 min-w-0 border-border ${borders}`}
                data-testid={`stat-card-${index}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {stat.label}
                  </span>
                  <stat.icon
                    className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0"
                    strokeWidth={1.5}
                  />
                </div>

                {highlightsLoading || isRefreshing ? (
                  <Skeleton className="h-9 w-28" />
                ) : (
                  <div className="serif flex items-baseline gap-1 text-[32px] sm:text-[38px] leading-none tracking-[-0.02em] text-foreground">
                    {(stat.metric?.value ?? 0).toLocaleString()}
                  </div>
                )}

                <div className="flex items-end justify-between gap-3 min-h-[28px]">
                  {hasChange && !isRefreshing ? (
                    <span
                      className={`mono inline-flex items-center gap-1 text-[11px] font-medium ${
                        isUp
                          ? "text-[color:var(--good)]"
                          : "text-[color:var(--bad)]"
                      }`}
                    >
                      {isUp ? (
                        <TrendingUp className="w-2.5 h-2.5" strokeWidth={2} />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" strokeWidth={2} />
                      )}
                      {isUp ? "+" : ""}
                      {change}%
                      <span className="text-muted-foreground/60">· vs prev.</span>
                    </span>
                  ) : (
                    <span />
                  )}
                  {!highlightsLoading && !isRefreshing && stat.metric?.sparkline && stat.metric.sparkline.length > 1 && (
                    <Sparkline
                      data={stat.metric.sparkline}
                      trend={isUp ? "up" : hasChange ? "down" : "flat"}
                      className="h-7 w-[84px] flex-none"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reorderable Bento Grid */}
        {activeNewslettersResolved && !isRefreshing ? (
          (() => {
            const cardRegistry: Record<CardId, { render: () => React.ReactNode }> = {
              mainSlot: {
                render: () =>
                  hasActiveNewsletter && tenantId ? (
                    <NewsletterStatsCard />
                  ) : (
                    <NewsletterCard />
                  ),
              },
              liveStats: {
                render: () =>
                  tenantId ? (
                    <LiveStatsCard tenantId={tenantId} shopId={selectedShopId} />
                  ) : (
                    <Skeleton className="h-full w-full min-h-[260px] rounded-2xl" />
                  ),
              },
              scheduledEmails: { render: () => <UpcomingScheduledEmailsCard /> },
              appointments: { render: () => <UpcomingAppointmentsCard /> },
              birthdays: { render: () => <UpcomingBirthdaysCard /> },
            };
            const visibleCardOrder = cardOrder.filter(
              (id) => cardVisibility[id] ?? true,
            );
            return (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={visibleCardOrder} strategy={rectSortingStrategy}>
                  <div
                    ref={gridRef}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-4"
                  >
                    {visibleCardOrder.map((id) => (
                      <SortableCard
                        key={id}
                        id={id}
                        colSpan={cardSizes[id] ?? DEFAULT_CARD_SIZES[id]}
                        gridRef={gridRef}
                        onResize={handleCardResize}
                        editMode={editMode}
                      >
                        {cardRegistry[id].render()}
                      </SortableCard>
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={DROP_ANIMATION}>
                  {activeCardId ? (
                    <div className="rounded-2xl shadow-2xl ring-1 ring-border/60 cursor-grabbing h-full">
                      {cardRegistry[activeCardId].render()}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            );
          })()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Skeleton className="lg:col-span-8 h-[260px] rounded-2xl" />
            <Skeleton className="lg:col-span-4 h-[260px] rounded-2xl" />
            <Skeleton className="lg:col-span-6 h-[260px] rounded-2xl" />
            <Skeleton className="lg:col-span-6 h-[260px] rounded-2xl" />
            <Skeleton className="lg:col-span-12 h-[260px] rounded-2xl" />
          </div>
        )}
      </div>
      <EditorPickerModal open={showEditorPicker} onOpenChange={setShowEditorPicker} />
    </>
  );
}
