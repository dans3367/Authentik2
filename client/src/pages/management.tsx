import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { LayoutDashboard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import UsersPage from "@/pages/users";
import ShopsPage from "@/pages/shops";
import ManagementTags from "@/pages/management-tags";
import ManagementEmailDesign from "@/pages/management-email-design";
import ManagementRolesPermissions from "@/pages/management-roles-permissions";
import ManagementNewsletterReviewer from "@/pages/management-newsletter-reviewer";
import { AccountUsageCard, ResourceUsageCard } from "@/components/ui/account-usage-card";

export default function ManagementPage() {
  const { t } = useTranslation();

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('management.title'), icon: Settings }
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('management.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('management.subtitle')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="account-usage" className="w-full">
          <TabsList>
            <TabsTrigger value="account-usage">{t('management.tabs.accountUsage', 'Account Usage')}</TabsTrigger>
            <TabsTrigger value="users">{t('management.tabs.users')}</TabsTrigger>
            <TabsTrigger value="shops">{t('management.tabs.shops')}</TabsTrigger>
            <TabsTrigger value="tags">{t('management.tabs.tags')}</TabsTrigger>
            <TabsTrigger value="roles-permissions">{t('management.tabs.rolesPermissions', 'Roles & Permissions')}</TabsTrigger>
            <TabsTrigger value="email-design">{t('management.tabs.emailDesign')}</TabsTrigger>
            <TabsTrigger value="newsletter-reviewer">{t('management.tabs.newsletterReviewer', 'Reviewer')}</TabsTrigger>
          </TabsList>
          <div className="mt-6">
            <TabsContent value="account-usage">
              <div className="grid gap-6 lg:grid-cols-2">
                <AccountUsageCard />
                <ResourceUsageCard />
              </div>
            </TabsContent>
            <TabsContent value="users">
              <UsersPage />
            </TabsContent>
            <TabsContent value="shops">
              <ShopsPage />
            </TabsContent>
            <TabsContent value="tags">
              <ManagementTags />
            </TabsContent>
            <TabsContent value="roles-permissions">
              <ManagementRolesPermissions />
            </TabsContent>
            <TabsContent value="email-design">
              <ManagementEmailDesign />
            </TabsContent>
            <TabsContent value="newsletter-reviewer">
              <ManagementNewsletterReviewer />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
