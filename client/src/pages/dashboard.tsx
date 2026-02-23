import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useLocation } from "wouter";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { HighlightsCard } from "@/components/ui/highlights-card";
import { UpcomingBirthdaysCard } from "@/components/ui/upcoming-birthdays-card";
import { UpcomingAppointmentsCard } from "@/components/ui/upcoming-appointments-card";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import {
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  Mail,
  Users,
  Newspaper,
  CalendarPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

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

  const quickActions = [
    {
      label: t("dashboard.quickActions.newNewsletter"),
      icon: Newspaper,
      path: "/newsletter/create",
      color: "from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-200/60 dark:border-blue-500/20",
    },
    {
      label: t("dashboard.quickActions.sendEmail"),
      icon: Mail,
      path: "/email-compose",
      color: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-emerald-200/60 dark:border-emerald-500/20",
    },
    {
      label: t("dashboard.quickActions.addContact"),
      icon: Users,
      path: "/email-contacts",
      color: "from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20",
      iconColor: "text-violet-600 dark:text-violet-400",
      borderColor: "border-violet-200/60 dark:border-violet-500/20",
    },
    {
      label: t("dashboard.quickActions.bookAppointment"),
      icon: CalendarPlus,
      path: "/reminders",
      color: "from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-200/60 dark:border-amber-500/20",
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
      {/* Hero Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent border border-primary/10 dark:border-primary/15 p-6 sm:p-8">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-blue-400/5 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground tracking-wide">
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
              className="text-sm sm:text-base text-muted-foreground max-w-lg"
              data-testid="text-dashboard-welcome"
            >
              {t("dashboard.welcomeMessage")}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => setLocation(action.path)}
              className={`group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-gradient-to-br ${action.color} border ${action.borderColor} hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer`}
            >
              <div
                className={`w-10 h-10 rounded-xl bg-background/80 dark:bg-background/40 backdrop-blur-sm flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}
              >
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <NewsletterCard />
        </div>
        <div className="lg:col-span-4">
          <HighlightsCard />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <UpcomingBirthdaysCard />
        </div>
        <div className="lg:col-span-4">
          <UpcomingAppointmentsCard />
        </div>
      </div>
    </div>
  );
}
