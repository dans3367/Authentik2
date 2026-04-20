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
      color: "text-blue-600 dark:text-blue-400",
      bgIcon: "bg-blue-500/10 dark:bg-blue-500/20",
      ring: "ring-blue-500/20",
      accentBar: "bg-blue-500",
    },
    {
      label: t("dashboard.highlights.emailsSent"),
      icon: Mail,
      metric: highlights?.emailsSentThisMonth,
      color: "text-emerald-600 dark:text-emerald-400",
      bgIcon: "bg-emerald-500/10 dark:bg-emerald-500/20",
      ring: "ring-emerald-500/20",
      accentBar: "bg-emerald-500",
    },
    {
      label: t("dashboard.highlights.newsletters"),
      icon: Newspaper,
      metric: highlights?.newslettersSent,
      color: "text-violet-600 dark:text-violet-400",
      bgIcon: "bg-violet-500/10 dark:bg-violet-500/20",
      ring: "ring-violet-500/20",
      accentBar: "bg-violet-500",
    },
    {
      label: t("dashboard.highlights.appointments"),
      icon: CalendarCheck,
      metric: highlights?.upcomingAppointments,
      color: "text-amber-600 dark:text-amber-400",
      bgIcon: "bg-amber-500/10 dark:bg-amber-500/20",
      ring: "ring-amber-500/20",
      accentBar: "bg-amber-500",
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

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 sm:p-5 hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-black/20 hover:border-border/80 transition-all duration-300"
              data-testid={`stat-card-${index}`}
            >
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${stat.accentBar} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 rounded-xl ${stat.bgIcon} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                {!highlightsLoading && stat.metric?.change !== null && stat.metric?.change !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-lg ${stat.metric.change >= 0
                        ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15"
                        : "text-red-700 bg-red-500/10 dark:text-red-400 dark:bg-red-500/15"
                      }`}
                  >
                    {stat.metric.change >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {stat.metric.change >= 0 ? "+" : ""}
                    {stat.metric.change}%
                  </span>
                )}
              </div>

              {highlightsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none block">
                    {(stat.metric?.value ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground/70 mt-1.5 block uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bento Grid - Row 1 */}
        {activeNewslettersResolved ? (
          hasActiveNewsletter && tenantId ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <UpcomingScheduledEmailsCard />
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
                <UpcomingAppointmentsCard />
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
                <UpcomingAppointmentsCard />
              ) : (
                <UpcomingScheduledEmailsCard />
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
