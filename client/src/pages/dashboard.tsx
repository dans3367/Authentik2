import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useLocation } from "wouter";
import { NewsletterCard } from "@/components/ui/newsletter-card";
import { HighlightsCard } from "@/components/ui/highlights-card";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useReduxAuth();

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
    <div className="min-h-screen bg-white dark:bg-slate-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Welcome back, {user.name || user.email}
              </p>
            </div>
          </div>
        </div>
        
        {/* Add minimal spacer after the header section */}
        <div className="h-3"></div>

        {/* Newsletter Creation and Highlights Cards */}
        <div className="flex flex-col lg:flex-row gap-6 max-w-7xl w-full">
          {/* Swift Setup - Wider */}
          <div className="flex-[2]">
            <NewsletterCard />
          </div>
          
          {/* Highlights - Narrower */}
          <div className="flex-[1]">
            <HighlightsCard />
          </div>
        </div>
      </div>
    </div>
  );
}