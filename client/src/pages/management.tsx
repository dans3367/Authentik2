import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { LayoutDashboard, Settings } from "lucide-react";
import UsersPage from "@/pages/users";
import ShopsPage from "@/pages/shops";
import ManagementTags from "@/pages/management-tags";
import ManagementEmailDesign from "@/pages/management-email-design";

export default function ManagementPage() {
  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Management", icon: Settings }
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage users, shops, tags, and email designs to organize your business operations
            </p>
          </div>
        </div>
        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="shops">Shops</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="email-design">Email Design</TabsTrigger>
          </TabsList>
          <div className="mt-6">
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
          </div>
        </Tabs>
      </div>
    </div>
  );
}
