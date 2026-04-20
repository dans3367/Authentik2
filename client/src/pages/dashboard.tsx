import { useState, useEffect, useRef } from "react";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useLocation } from "wouter";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAppSelector } from "@/store";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { LiveStatsCard } from "@/components/ui/live-stats-card";
import { HighlightsCard } from "@/components/ui/highlights-card";
import { UpcomingBirthdaysCard } from "@/components/ui/upcoming-birthdays-card";
import { UpcomingAppointmentsCard } from "@/components/ui/upcoming-appointments-card";
import { UpcomingScheduledEmailsCard } from "@/components/ui/upcoming-scheduled-emails-card";
import { Button } from "@/components/ui/button";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
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
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDashboardHighlights } from "@/hooks/useStats";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorPickerModal } from "@/components/EditorPickerModal";

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
      onClick: () => setLocation("/email-contacts?action=add"),
      accent: "hover:border-violet-500/40 hover:bg-violet-500/5 dark:hover:bg-violet-500/10",
      iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: t("dashboard.quickActions.bookAppointment"),
      icon: CalendarPlus,
      onClick: () => setLocation("/reminders"),
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
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-[0.15em]">
              {getFormattedDate(i18n.language === 'es' ? 'es-ES' : 'en-US')}
            </p>
            <h1
              className="text-2xl sm:text-3xl lg:text-[2rem] font-extrabold tracking-tight leading-none"
              data-testid="text-dashboard-title"
            >
              {greeting.text}, {firstName}
              <span className="ml-2 inline-block">{greeting.emoji}</span>
            </h1>
            <p
              className="text-sm text-muted-foreground/80 max-w-md"
              data-testid="text-dashboard-welcome"
            >
              {t("dashboard.welcomeMessage")}
            </p>
          </div>
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

                {highlightsLoading ? (
                  <Skeleton className="h-9 w-28" />
                ) : (
                  <div className="serif flex items-baseline gap-1 text-[32px] sm:text-[38px] leading-none tracking-[-0.02em] text-foreground">
                    {(stat.metric?.value ?? 0).toLocaleString()}
                  </div>
                )}

                <div className="flex items-end justify-between gap-3 min-h-[28px]">
                  {hasChange ? (
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
                  {!highlightsLoading && stat.metric?.sparkline && stat.metric.sparkline.length > 1 && (
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

        {/* Bento Grid - Row 1 */}
        {activeNewslettersResolved ? (
          hasActiveNewsletter && tenantId ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <UpcomingAppointmentsCard />
              </div>
              <div className="lg:col-span-4">
                <LiveStatsCard tenantId={tenantId} shopId={selectedShopId} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <NewsletterCard />
              </div>
              <div className="lg:col-span-4">
                <UpcomingScheduledEmailsCard />
              </div>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Skeleton className="lg:col-span-8 h-[260px] rounded-2xl" />
            <Skeleton className="lg:col-span-4 h-[260px] rounded-2xl" />
          </div>
        )}

        {/* Bento Grid - Row 2: Highlights + Birthdays */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5">
            <HighlightsCard />
          </div>
          <div className="lg:col-span-7">
            <UpcomingBirthdaysCard />
          </div>
        </div>

        {/* Bento Grid - Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-12">
            {activeNewslettersResolved ? (
              hasActiveNewsletter && tenantId ? (
                <UpcomingScheduledEmailsCard />
              ) : (
                <UpcomingAppointmentsCard />
              )
            ) : (
              <Skeleton className="h-[240px] rounded-2xl w-full" />
            )}
          </div>
        </div>
      </div>
      <EditorPickerModal open={showEditorPicker} onOpenChange={setShowEditorPicker} />
    </>
  );
}
