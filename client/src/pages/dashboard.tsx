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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-slate-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="rounded-2xl border border-gray-100/80 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/60 backdrop-blur px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                {t('navigation.dashboard')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t('dashboard.welcomeBack', { name: user.name || user.email })}
              </p>
            </div>
          </div>
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
