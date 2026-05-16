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
    <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6 overflow-y-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pt-1">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-[0.15em]">
            {t('navigation.management')}
          </p>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-[2rem] font-extrabold tracking-tight leading-none text-foreground">{t('management.title')}</h1>
            <p className="text-sm text-muted-foreground/80 mt-1.5">
              {t('management.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max justify-start bg-card border border-border/60 p-1 text-muted-foreground">
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
        </div>
        <TabsContent value="account-usage" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <AccountUsageCard />
            <ResourceUsageCard />
          </div>
        </TabsContent>
        <TabsContent value="users" className="mt-5">
          <UsersPage />
        </TabsContent>
        <TabsContent value="shops" className="mt-5">
          <ShopsPage />
        </TabsContent>
        <TabsContent value="tags" className="mt-5">
          <ManagementTags />
        </TabsContent>
        <TabsContent value="email-design" className="mt-5">
          <ManagementEmailDesign />
        </TabsContent>
        <TabsContent value="blog-design" className="mt-5">
          <ManagementBlogDesign />
        </TabsContent>
        <TabsContent value="review-and-send" className="mt-5">
          <ManagementReviewAndSend />
        </TabsContent>
        <TabsContent value="custom-fields" className="mt-5">
          <ManagementCustomFields />
        </TabsContent>
        <TabsContent value="bulk-import" className="mt-5">
          <ManagementBulkImport />
        </TabsContent>
        <TabsContent value="activity-logs" className="mt-5">
          <ManagementActivityLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
