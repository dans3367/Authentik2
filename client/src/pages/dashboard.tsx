import { useState } from "react";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useLocation } from "wouter";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { HighlightsCard } from "@/components/ui/highlights-card";
import { UpcomingBirthdaysCard } from "@/components/ui/upcoming-birthdays-card";
import { UpcomingAppointmentsCard } from "@/components/ui/upcoming-appointments-card";
import { UpcomingScheduledEmailsCard } from "@/components/ui/upcoming-scheduled-emails-card";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import {
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  Mail,
  Users,
  Newspaper,
  CalendarPlus,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
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

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useReduxAuth();
  const { t } = useTranslation();
  const greeting = getGreeting(t);
  const { data: highlights, isLoading: highlightsLoading } = useDashboardHighlights();

  useSetBreadcrumbs([{ label: "Dashboard", icon: LayoutDashboard }]);

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

  const [showEditorPicker, setShowEditorPicker] = useState(false);

  const quickActions = [
    {
      label: t("dashboard.quickActions.newNewsletter"),
      icon: Newspaper,
      path: "",
      onClick: () => setShowEditorPicker(true),
      gradient: "from-blue-500 to-indigo-600",
      lightBg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: t("dashboard.quickActions.sendEmail"),
      icon: Mail,
      path: "/email-compose",
      gradient: "from-emerald-500 to-teal-600",
      lightBg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: t("dashboard.quickActions.addContact"),
      icon: Users,
      path: "/email-contacts",
      gradient: "from-violet-500 to-purple-600",
      lightBg: "bg-violet-50 dark:bg-violet-950/40",
    },
    {
      label: t("dashboard.quickActions.bookAppointment"),
      icon: CalendarPlus,
      path: "/reminders",
      gradient: "from-amber-500 to-orange-600",
      lightBg: "bg-amber-50 dark:bg-amber-950/40",
    },
  ];

  const statCards = [
    {
      label: t("dashboard.highlights.contacts"),
      icon: Users,
      metric: highlights?.totalContacts,
      gradient: "from-blue-500 to-blue-600",
      bgAccent: "bg-blue-500/10 dark:bg-blue-500/20",
      textAccent: "text-blue-600 dark:text-blue-400",
    },
    {
      label: t("dashboard.highlights.emailsSent"),
      icon: Mail,
      metric: highlights?.emailsSentThisMonth,
      gradient: "from-emerald-500 to-emerald-600",
      bgAccent: "bg-emerald-500/10 dark:bg-emerald-500/20",
      textAccent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("dashboard.highlights.newsletters"),
      icon: Newspaper,
      metric: highlights?.newslettersSent,
      gradient: "from-violet-500 to-violet-600",
      bgAccent: "bg-violet-500/10 dark:bg-violet-500/20",
      textAccent: "text-violet-600 dark:text-violet-400",
    },
    {
      label: t("dashboard.highlights.appointments"),
      icon: CalendarCheck,
      metric: highlights?.upcomingAppointments,
      gradient: "from-amber-500 to-amber-600",
      bgAccent: "bg-amber-500/10 dark:bg-amber-500/20",
      textAccent: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            {getFormattedDate()}
          </p>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            data-testid="text-dashboard-title"
          >
            <span className="mr-2">{greeting.emoji}</span>
            {greeting.text}, {firstName}
          </h1>
          <p
            className="text-sm text-muted-foreground max-w-lg"
            data-testid="text-dashboard-welcome"
          >
            {t("dashboard.welcomeMessage")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => action.onClick ? action.onClick() : setLocation(action.path)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg ${action.lightBg} border border-transparent hover:border-border/50 hover:shadow-sm active:scale-[0.97] transition-all duration-200 cursor-pointer`}
              data-testid={`button-quick-${action.path.replace(/\//g, '-').substring(1)}`}
            >
              <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-sm`}>
                <action.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors hidden sm:inline">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 sm:p-5 hover:shadow-md hover:border-border transition-all duration-300"
            data-testid={`stat-card-${index}`}
          >
            <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.04] dark:opacity-[0.08] pointer-events-none">
              <stat.icon className="w-full h-full" />
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${stat.bgAccent} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.textAccent}`} />
              </div>
              <span className="text-xs font-medium text-muted-foreground truncate">
                {stat.label}
              </span>
            </div>

            <div className="flex items-end justify-between gap-2">
              {highlightsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold tracking-tight leading-none">
                  {(stat.metric?.value ?? 0).toLocaleString()}
                </span>
              )}
              {!highlightsLoading && stat.metric?.change !== null && stat.metric?.change !== undefined && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                    stat.metric.change >= 0
                      ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30"
                      : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30"
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
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-8">
          <NewsletterCard />
        </div>
        <div className="lg:col-span-4">
          <UpcomingAppointmentsCard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-8">
          <UpcomingBirthdaysCard />
        </div>
        <div className="lg:col-span-4">
          <HighlightsCard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-8">
          <UpcomingScheduledEmailsCard />
        </div>
      </div>
    </div>
    <EditorPickerModal open={showEditorPicker} onOpenChange={setShowEditorPicker} />
    </>
  );
}
