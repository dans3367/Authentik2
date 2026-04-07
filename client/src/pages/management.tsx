import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { LayoutDashboard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import UsersPage from "@/pages/users";
import ShopsPage from "@/pages/shops";
import ManagementTags from "@/pages/management-tags";
import ManagementEmailDesign from "@/pages/management-email-design";
import ManagementBlogDesign from "@/pages/management-blog-design";
import ManagementReviewAndSend from "@/pages/management-review-and-send";
import ManagementCustomFields from "@/pages/management-custom-fields";
import ManagementBulkImport from "@/pages/management-bulk-import";
import ManagementActivityLogs from "@/pages/management-activity-logs";
import { AccountUsageCard, ResourceUsageCard } from "@/components/ui/account-usage-card";

export default function ManagementPage() {
  const { t } = useTranslation();

  // Read initial tab from URL query param (e.g., /management?tab=activity-logs)
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "account-usage";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update tab if URL changes (e.g., navigated from another page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);
  }, []);

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="account-usage">{t('management.tabs.accountUsage', 'Account Usage')}</TabsTrigger>
            <TabsTrigger value="users">{t('management.tabs.users')}</TabsTrigger>
            <TabsTrigger value="shops">{t('management.tabs.shops')}</TabsTrigger>
            <TabsTrigger value="tags">{t('management.tabs.tags')}</TabsTrigger>
            <TabsTrigger value="email-design">{t('management.tabs.emailDesign')}</TabsTrigger>
            <TabsTrigger value="blog-design">{t('management.tabs.blogDesign', 'Blog Design')}</TabsTrigger>
            <TabsTrigger value="review-and-send">{t('management.tabs.reviewAndSend', 'Review & Send')}</TabsTrigger>
            <TabsTrigger value="custom-fields">{t('management.tabs.customFields', 'Custom Fields')}</TabsTrigger>
            <TabsTrigger value="bulk-import">{t('management.tabs.bulkImport', 'Bulk Import')}</TabsTrigger>
            <TabsTrigger value="activity-logs">{t('management.tabs.activityLogs', 'Activity Logs')}</TabsTrigger>
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
            <TabsContent value="email-design">
              <ManagementEmailDesign />
            </TabsContent>
            <TabsContent value="blog-design">
              <ManagementBlogDesign />
            </TabsContent>
            <TabsContent value="review-and-send">
              <ManagementReviewAndSend />
            </TabsContent>
            <TabsContent value="custom-fields">
              <ManagementCustomFields />
            </TabsContent>
            <TabsContent value="bulk-import">
              <ManagementBulkImport />
            </TabsContent>
            <TabsContent value="activity-logs">
              <ManagementActivityLogs />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
