import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreHorizontal, TrendingUp, TrendingDown, Store, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function HighlightsCard() {
  // Mock data matching the reference image
  const salesData = {
    total: "$295.7k",
    growth: "+2.7%",
    metronic: 65, // percentage for progress bar
    bundle: 25, // percentage  
    metronicNest: 10, // percentage
  };

  const channelData = [
    { name: "Summer Sale", icon: Store, amount: "200", change: "650", isPositive: true },
    { name: "Winter Tire Benefits", icon: Facebook, amount: "750", change: "700", isPositive: false },
    { name: "How to save on gas", icon: Instagram, amount: "20", change: "550", isPositive: true },
    { name: "Tire safety", icon: () => (
      <div className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">G</div>
    ), amount: "550", change: "250", isPositive: true },
  ];

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-xl h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Highlights
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="p-2 text-sm text-gray-500">More options</div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* All Time Sales Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            All Newsletter Stats
          </h3>
          
          {/* Large Number Display with Growth */}
          <div className="flex items-center gap-2 mb-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {salesData.total}
            </div>
            <div className="text-sm font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
              {salesData.growth}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
            <div className="flex h-2 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-full" 
                style={{ width: `${salesData.metronic}%` }}
              ></div>
              <div 
                className="bg-red-500 h-full" 
                style={{ width: `${salesData.bundle}%` }}
              ></div>
              <div 
                className="bg-purple-500 h-full" 
                style={{ width: `${salesData.metronicNest}%` }}
              ></div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">Success</span>
            </div>
            <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">Error</span>
            </div>
          </div>
        </div>

        {/* Channel Performance List */}
        <div className="space-y-3">
          {channelData.map((channel, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {channel.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {channel.amount}
                </span>
                <div className={`flex items-center gap-1 text-xs ${
                  channel.isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {channel.isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{channel.change}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
