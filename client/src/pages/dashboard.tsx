import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useLocation } from "wouter";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { HighlightsCard } from "@/components/ui/highlights-card";
import { UpcomingBirthdaysCard } from "@/components/ui/upcoming-birthdays-card";
import { UpcomingAppointmentsCard } from "@/components/ui/upcoming-appointments-card";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useReduxAuth();
  const { t } = useTranslation();

  useSetBreadcrumbs([
    { label: "Dashboard", icon: LayoutDashboard }
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          {t('navigation.dashboard')}
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="text-dashboard-welcome">
          {t('dashboard.welcomeBack', { name: user.name || user.email })}
        </p>
      </div>

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
