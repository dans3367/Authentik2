import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CustomCalendar from "./CustomCalendar";
import {
  Mail,
  Eye,
  MousePointer,
  AlertTriangle,
  Ban,
  Shield,
  UserMinus,
  Check,
  Zap,
  RefreshCw,
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight,
  Settings
} from "lucide-react";
import ActivityIcon from "@assets/28_new.svg";
import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";

interface EmailActivity {
  id: string;
  activityType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'preference_updated';
  occurredAt: string;
  activityData?: string;
  userAgent?: string;
  ipAddress?: string;
  webhookId?: string;
  webhookData?: string;
  campaign?: {
    id: string;
    name: string;
  };
  newsletter?: {
    id: string;
    name: string;
  };
  createdAt?: string;
}

interface EmailActivityTimelineProps {
  contactId: string;
  pageSize?: number;
  initialPage?: number;
}

// Custom clock icon component for fallback
const CustomClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12,6 12,12 16,14"></polyline>
  </svg>
);

const getActivityIcon = (activityType: EmailActivity['activityType']) => {
  const iconMap = {
    sent: Mail,
    delivered: Check,
    opened: Eye,
    clicked: MousePointer,
    bounced: AlertTriangle,
    complained: Shield,
    unsubscribed: UserMinus,
    preference_updated: Settings,
  };
  return iconMap[activityType] || CustomClockIcon;
};

const getActivityColor = (activityType: EmailActivity['activityType']) => {
  const colorMap = {
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    opened: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    clicked: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    bounced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    complained: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    unsubscribed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    preference_updated: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  };
  return colorMap[activityType] || "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
};

const getActivityDescription = (activityType: EmailActivity['activityType']) => {
  const descriptionMap = {
    sent: "Email was sent",
    delivered: "Email was delivered successfully",
    opened: "Email was opened",
    clicked: "Link in email was clicked",
    bounced: "Email bounced and couldn't be delivered",
    complained: "Recipient marked as spam",
    unsubscribed: "Recipient unsubscribed",
    preference_updated: "Email preferences were updated",
  };
  return descriptionMap[activityType] || "Activity recorded";
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function EmailActivityTimeline({ contactId, pageSize = 20, initialPage = 1 }: EmailActivityTimelineProps) {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{from?: Date; to?: Date}>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [holdScrollLock, setHoldScrollLock] = useState(false);
  const [showManualLoading, setShowManualLoading] = useState(false);
  
  // Disable background scroll while the date range popover is open
  useEffect(() => {
    if (isDatePickerOpen || holdScrollLock) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isDatePickerOpen, holdScrollLock]);
  
  // Fetch all activities to get dates with activity for calendar indicators
  const { data: allActivitiesResponse } = useQuery({
    queryKey: ['/api/email-contacts', contactId, 'activity', 'all'],
    queryFn: async () => {
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${contactId}/activity?limit=1000`);
      const data = await apiResponse.json();
      return data;
    },
    enabled: !!contactId,
    placeholderData: keepPreviousData,
    staleTime: 30000, // Keep calendar data for 30 seconds as it changes less frequently
  });
  
  const { data: response, isLoading, error, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['/api/email-contacts', contactId, 'activity', { page: currentPage, limit: pageSize, dateRange }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      
      if (dateRange.from) {
        // Send from date as start of day in local timezone
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        params.append('from', fromDate.toISOString());
      }
      if (dateRange.to) {
        // Send to date as end of day in local timezone
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        params.append('to', toDate.toISOString());
      }
      
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${contactId}/activity?${params.toString()}`);
      const data = await apiResponse.json();
      return data;
    },
    enabled: !!contactId,
    placeholderData: keepPreviousData,
    staleTime: 5000, // Keep data fresh for 5 seconds to avoid unnecessary refetches
  });

  const activities: EmailActivity[] = (response as any)?.activities || [];
  const pagination = (response as any)?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: 0,
    pages: 0,
  };
  const totalPages = pagination.pages || 0;

  const handleRefresh = () => {
    // Show loading spinner for 2 seconds minimum
    setShowManualLoading(true);
    setTimeout(() => setShowManualLoading(false), 2000);
    
    // Invalidate both queries to ensure fresh data
    queryClient.invalidateQueries({ 
      queryKey: ['/api/email-contacts', contactId, 'activity']
    });
    refetch();
  };

  const clearDateFilter = () => {
    setDateRange({});
    setIsDatePickerOpen(false);
    // Hold scroll lock briefly to avoid scroll jump on close
    setHoldScrollLock(true);
    setTimeout(() => setHoldScrollLock(false), 150);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    // Scroll to top of timeline
    const timelineElement = document.querySelector('[data-component="email-activity-timeline"]');
    if (timelineElement) {
      timelineElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNextPage = () => goToPage(currentPage + 1);
  const handlePrevPage = () => goToPage(currentPage - 1);

  // Reset to page 1 when date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange.from, dateRange.to]);

  const hasDateFilter = dateRange.from || dateRange.to;
  
  const formatDateRange = () => {
    if (!hasDateFilter) return "Filter by date";
    
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    } else if (dateRange.from) {
      return `From ${format(dateRange.from, "MMM d, yyyy")}`;
    } else if (dateRange.to) {
      return `Until ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    return "Filter by date";
  };

  // Get dates with activities for calendar indicators
  const allActivities: EmailActivity[] = (allActivitiesResponse as any)?.activities || [];
  
  // Convert activities to calendar format
  const activityData = allActivities.reduce((acc, activity) => {
    const dateStr = format(new Date(activity.occurredAt), 'yyyy-MM-dd');
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    
    // Check if this activity type already exists for this date
    const existingActivity = acc[dateStr].find(a => a.type === activity.activityType);
    if (existingActivity) {
      existingActivity.count++;
    } else {
      acc[dateStr].push({
        type: activity.activityType,
        count: 1
      });
    }
    
    return acc;
  }, {} as Record<string, Array<{ type: EmailActivity['activityType']; count: number }>>);
  
  // Activity data prepared for calendar
  
  const activityDates = new Set(
    allActivities.map(activity => format(new Date(activity.occurredAt), 'yyyy-MM-dd'))
  );

  // Get activity types for a specific date to determine dot color
  const getActivityTypesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allActivities
      .filter(activity => format(new Date(activity.occurredAt), 'yyyy-MM-dd') === dateStr)
      .map(activity => activity.activityType);
  };

  // Determine dot color based on activity types (prioritize important activities)
  const getDotColorForDate = (date: Date) => {
    const activityTypes = getActivityTypesForDate(date);
    if (activityTypes.includes('bounced') || activityTypes.includes('complained')) return 'bg-red-500';
    if (activityTypes.includes('clicked')) return 'bg-orange-500';
    if (activityTypes.includes('opened')) return 'bg-blue-500';
    if (activityTypes.includes('delivered')) return 'bg-green-400';
    if (activityTypes.includes('sent')) return 'bg-gray-400';
    return 'bg-gray-400';
  };

  const getDotColorForActivityType = (activityType: string): string => {
    switch (activityType) {
      case 'bounced':
      case 'complained':
        return 'bg-red-500';
      case 'clicked':
        return 'bg-orange-500';
      case 'opened':
        return 'bg-blue-500';
      case 'delivered':
        return 'bg-green-400';
      case 'sent':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const formatLastUpdated = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if ((isLoading && !isFetching) || showManualLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading activity...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 dark:text-red-400">Failed to load activity timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0 && !isFetching) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Activity Timeline
              </CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Recent email activities for this contact
                  {hasDateFilter && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                      • Filtered
                    </span>
                  )}
                </p>
                {dataUpdatedAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Last updated: {formatLastUpdated(dataUpdatedAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Popover 
                open={isDatePickerOpen} 
                onOpenChange={(open) => {
                  // Keep open while selecting a range (has from but no to)
                  setIsDatePickerOpen(open || (!!dateRange?.from && !dateRange?.to));
                }}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant={hasDateFilter ? "default" : "outline"}
                    size="sm"
                    className="relative"
                  >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    {formatDateRange()}
                    {hasDateFilter && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearDateFilter();
                        }}
                        className="ml-2 hover:bg-white hover:bg-opacity-20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[700px] p-0"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  onInteractOutside={(e) => {
                    if (dateRange?.from && !dateRange?.to) e.preventDefault();
                  }}
                  onEscapeKeyDown={(e) => {
                    if (dateRange?.from && !dateRange?.to) e.preventDefault();
                  }}
                >
                  <div className="relative">
                    <CustomCalendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        if (range && typeof range === 'object' && 'from' in range) {
                          setDateRange(range);
                          // Show loading spinner for 2 seconds when date range changes
                          if (range.from && range.to) {
                            setShowManualLoading(true);
                            setTimeout(() => setShowManualLoading(false), 2000);
                          }
                          // Only close when both dates are selected
                          if (range.from && range.to) {
                            setIsDatePickerOpen(false);
                            // Hold scroll lock briefly after completing range
                            setHoldScrollLock(true);
                            setTimeout(() => setHoldScrollLock(false), 150);
                          }
                        } else {
                          setDateRange({});
                        }
                      }}
                      numberOfMonths={2}
                      activityData={activityData}
                    />
                    
                    {/* Activity Legend */}
                    <div className="border-t p-3 bg-gray-50 dark:bg-gray-800">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Activity Legend:
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span>Issues</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>Clicked</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span>Opened</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-300"></div>
                          <span>Delivered</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Dots indicate email activity. Hover over dots for details.
                      </div>
                    </div>
                  </div>

                  <div className="p-3 border-t">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          const lastWeek = addDays(today, -7);
                          setDateRange({ from: lastWeek, to: today });
                          // Show loading spinner for 2 seconds
                          setShowManualLoading(true);
                          setTimeout(() => setShowManualLoading(false), 2000);
                          setIsDatePickerOpen(false);
                        }}
                      >
                        Last 7 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          const lastMonth = addDays(today, -30);
                          setDateRange({ from: lastMonth, to: today });
                          // Show loading spinner for 2 seconds
                          setShowManualLoading(true);
                          setTimeout(() => setShowManualLoading(false), 2000);
                          setIsDatePickerOpen(false);
                        }}
                      >
                        Last 30 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearDateFilter}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || showManualLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${(isLoading || showManualLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <img src={ActivityIcon} className="w-[200px] h-auto text-gray-400 mx-auto mb-2" alt="Activity Timeline Icon" />
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              {hasDateFilter ? "No activities found for the selected date range" : "No activity recorded yet"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {hasDateFilter
                ? "Try adjusting the date range or clearing the filter to see more activities"
                : "Email activities will appear here when emails are sent to this contact"
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Activity Timeline
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recent email activities for this contact
                {hasDateFilter && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                    • Filtered
                  </span>
                )}
              </p>
              {dataUpdatedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Last updated: {formatLastUpdated(dataUpdatedAt)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Popover 
              open={isDatePickerOpen} 
              onOpenChange={(open) => {
                // Keep open while selecting a range (has from but no to)
                setIsDatePickerOpen(open || (!!dateRange?.from && !dateRange?.to));
              }}
              modal={false}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={hasDateFilter ? "default" : "outline"}
                  size="sm"
                  className="relative"
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  {formatDateRange()}
                  {hasDateFilter && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDateFilter();
                      }}
                      className="ml-2 hover:bg-white hover:bg-opacity-20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[700px] p-0"
                align="start"
                side="bottom"
                sideOffset={4}
                onInteractOutside={(e) => {
                  if (dateRange?.from && !dateRange?.to) e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                  if (dateRange?.from && !dateRange?.to) e.preventDefault();
                }}
              >
                <div className="relative">
                  <CustomCalendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range && typeof range === 'object' && 'from' in range) {
                        setDateRange(range);
                        // Show loading spinner for 2 seconds when date range changes
                        if (range.from && range.to) {
                          setShowManualLoading(true);
                          setTimeout(() => setShowManualLoading(false), 2000);
                        }
                        // Only close when both dates are selected
                        if (range.from && range.to) {
                          setIsDatePickerOpen(false);
                          // Hold scroll lock briefly after completing range
                          setHoldScrollLock(true);
                          setTimeout(() => setHoldScrollLock(false), 150);
                        }
                      } else {
                        setDateRange({});
                      }
                    }}
                    numberOfMonths={2}
                    activityData={activityData}
                  />
                  
                  {/* Activity Legend */}
                  <div className="border-t p-3 bg-gray-50 dark:bg-gray-800">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Activity Legend:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Issues</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Clicked</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Opened</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-300"></div>
                        <span>Delivered</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Dots indicate email activity. Hover over dots for details.
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const lastWeek = addDays(today, -7);
                        setDateRange({ from: lastWeek, to: today });
                        // Show loading spinner for 2 seconds
                        setShowManualLoading(true);
                        setTimeout(() => setShowManualLoading(false), 2000);
                        setIsDatePickerOpen(false);
                        // Hold scroll lock briefly to avoid scroll jump on close
                        setHoldScrollLock(true);
                        setTimeout(() => setHoldScrollLock(false), 150);
                      }}
                    >
                      Last 7 days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const lastMonth = addDays(today, -30);
                        setDateRange({ from: lastMonth, to: today });
                        // Show loading spinner for 2 seconds
                        setShowManualLoading(true);
                        setTimeout(() => setShowManualLoading(false), 2000);
                        setIsDatePickerOpen(false);
                        // Hold scroll lock briefly to avoid scroll jump on close
                        setHoldScrollLock(true);
                        setTimeout(() => setHoldScrollLock(false), 150);
                      }}
                    >
                      Last 30 days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearDateFilter}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || showManualLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${(isLoading || showManualLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
          
          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                  <Mail className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {hasDateFilter ? 'No email activity found for the selected date range.' : 'No email activity recorded yet.'}
                </p>
                {hasDateFilter && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={clearDateFilter}
                    className="mt-2"
                  >
                    Clear date filter to see all activities
                  </Button>
                )}
              </div>
            ) : (
              activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.activityType);
              const colorClass = getActivityColor(activity.activityType);
              const description = getActivityDescription(activity.activityType);
              
              let parsedActivityData = null;
              try {
                parsedActivityData = activity.activityData ? JSON.parse(activity.activityData) : null;
              } catch {
                // Ignore JSON parsing errors
              }

              return (
                <div key={activity.id} className="relative flex items-start gap-3">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${colorClass.includes('blue') ? 'bg-blue-100 dark:bg-blue-900/30' : 
                    colorClass.includes('green') ? 'bg-green-100 dark:bg-green-900/30' :
                    colorClass.includes('purple') ? 'bg-purple-100 dark:bg-purple-900/30' :
                    colorClass.includes('orange') ? 'bg-orange-100 dark:bg-orange-900/30' :
                    colorClass.includes('red') ? 'bg-red-100 dark:bg-red-900/30' :
                    colorClass.includes('yellow') ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                    'bg-gray-100 dark:bg-gray-900/30'
                  } border-2 border-white dark:border-gray-800`}>
                    <Icon className={`h-4 w-4 ${
                      colorClass.includes('blue') ? 'text-blue-600 dark:text-blue-400' :
                      colorClass.includes('green') ? 'text-green-600 dark:text-green-400' :
                      colorClass.includes('purple') ? 'text-purple-600 dark:text-purple-400' :
                      colorClass.includes('orange') ? 'text-orange-600 dark:text-orange-400' :
                      colorClass.includes('red') ? 'text-red-600 dark:text-red-400' :
                      colorClass.includes('yellow') ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-gray-600 dark:text-gray-400'
                    }`} />
                  </div>

                  {/* Timeline content */}
                  <div className="flex-1 min-w-0 pb-4">
                    {/* Primary Info: Badge, Subject, and DateTime */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Badge className={colorClass}>
                          {activity.activityType}
                        </Badge>
                        {parsedActivityData?.subject ? (
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {parsedActivityData.subject}
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {description}
                          </p>
                        )}
                      </div>
                      <time className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDateTime(activity.occurredAt)}
                      </time>
                    </div>
                    
                    {/* Recipient Info - Always show if available */}
                    {parsedActivityData?.recipient && (
                      <div className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">To:</span> {parsedActivityData.recipient}
                      </div>
                    )}
                    
                    {/* Campaign and Newsletter info */}
                    {(activity.campaign || activity.newsletter) && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {activity.campaign && (
                          <p><span className="font-medium">Campaign:</span> {activity.campaign.name}</p>
                        )}
                        {activity.newsletter && (
                          <p><span className="font-medium">Newsletter:</span> {activity.newsletter.name}</p>
                        )}
                      </div>
                    )}

                    {/* Additional details - Collapsible */}
                    {parsedActivityData && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {parsedActivityData.from && (
                          <p><span className="font-medium">From:</span> {parsedActivityData.from}</p>
                        )}
                        {parsedActivityData.email_id && (
                          <p><span className="font-medium">Email ID:</span> <span className="font-mono text-xs">{parsedActivityData.email_id}</span></p>
                        )}
                        {parsedActivityData.messageId && parsedActivityData.messageId !== parsedActivityData.email_id && (
                          <p><span className="font-medium">Message ID:</span> <span className="font-mono text-xs">{parsedActivityData.messageId}</span></p>
                        )}
                      </div>
                    )}
                    
                    {/* Preference update details */}
                    {activity.activityType === 'preference_updated' && parsedActivityData?.preferences && (
                      <div className="mt-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-md space-y-1.5">
                        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Channel preferences:</p>
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { key: 'marketing', label: 'Marketing' },
                            { key: 'customerEngagement', label: 'Customer Engagement' },
                            { key: 'newsletters', label: 'Newsletters' },
                            { key: 'surveysForms', label: 'Surveys & Forms' },
                          ].map((ch) => (
                            <div key={ch.key} className="flex items-center gap-1.5 text-xs">
                              <span className={`inline-block w-2 h-2 rounded-full ${parsedActivityData.preferences[ch.key] ? 'bg-green-500' : 'bg-red-400'}`} />
                              <span className="text-gray-700 dark:text-gray-300">{ch.label}</span>
                            </div>
                          ))}
                        </div>
                        {parsedActivityData.unsubscribedFrom?.length > 0 && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Opted out of: {parsedActivityData.unsubscribedFrom.map((c: string) => c.replace(/_/g, ' ')).join(', ')}
                          </p>
                        )}
                        {parsedActivityData.source && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Via: {parsedActivityData.source.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Unsubscribe details */}
                    {activity.activityType === 'unsubscribed' && parsedActivityData && (
                      <div className="mt-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md space-y-1">
                        {parsedActivityData.categories && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Scope:</span> {parsedActivityData.categories === 'all' ? 'All email categories' : parsedActivityData.categories}
                          </p>
                        )}
                        {parsedActivityData.source && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Via: {parsedActivityData.source.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* User agent and IP for certain activities */}
                    {(activity.activityType === 'opened' || activity.activityType === 'clicked') && (activity.userAgent || activity.ipAddress) && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {activity.ipAddress && (
                          <p><span className="font-medium">IP:</span> {activity.ipAddress}</p>
                        )}
                        {activity.userAgent && (
                          <p><span className="font-medium">User Agent:</span> {activity.userAgent}</p>
                        )}
                      </div>
                    )}

                    {/* Webhook technical details */}
                    {activity.webhookId && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <p><span className="font-medium">Webhook ID:</span> {activity.webhookId}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Pagination Info */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {activities.length > 0 ? ((currentPage - 1) * pageSize + 1) : 0} to{' '}
                {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} activities
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || isFetching}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {/* Show first page if not nearby */}
                  {currentPage > 3 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(1)}
                        disabled={isFetching}
                        className="w-9 h-9 p-0"
                      >
                        1
                      </Button>
                      {currentPage > 4 && <span className="px-2 text-gray-400">...</span>}
                    </>
                  )}

                  {/* Show pages around current page */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    if (currentPage > 3 && pageNum === 1) return null;
                    if (currentPage < totalPages - 2 && pageNum === totalPages) return null;
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        disabled={isFetching}
                        className="w-9 h-9 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  {/* Show last page if not nearby */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="px-2 text-gray-400">...</span>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(totalPages)}
                        disabled={isFetching}
                        className="w-9 h-9 p-0"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || isFetching}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
