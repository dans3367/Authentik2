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

  // Set breadcrumbs in header (dashboard is the root, so only show current page)
  useSetBreadcrumbs([
    { label: "Dashboard", icon: LayoutDashboard }
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('navigation.dashboard')}
          </h1>
          <p className="text-muted-foreground">
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
    </div>
  );
}
