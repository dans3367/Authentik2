import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import UsersPage from "@/pages/users";
import ShopsPage from "@/pages/shops";

export default function ManagementPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Management</h1>
      </div>
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="shops">Shops</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="users">
            <UsersPage />
          </TabsContent>
          <TabsContent value="shops">
            <ShopsPage />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
