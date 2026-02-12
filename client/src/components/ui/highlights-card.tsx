import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreHorizontal, TrendingUp, TrendingDown, Users, Mail, Newspaper, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardHighlights, type StatMetric } from "@/hooks/useStats";
import { Skeleton } from "@/components/ui/skeleton";

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return null;
  const isPositive = change >= 0;
  return (
    <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      <span>{isPositive ? '+' : ''}{change}%</span>
    </div>
  );
}

export function HighlightsCard() {
  const { data, isLoading } = useDashboardHighlights();

  const metrics: { label: string; icon: React.ElementType; metric: StatMetric | undefined }[] = [
    { label: "Total Contacts", icon: Users, metric: data?.totalContacts },
    { label: "Emails Sent", icon: Mail, metric: data?.emailsSentThisMonth },
    { label: "Newsletters Sent", icon: Newspaper, metric: data?.newslettersSent },
    { label: "Upcoming Appointments", icon: CalendarCheck, metric: data?.upcomingAppointments },
  ];

  // Compute progress bar from contacts growth
  const totalContacts = data?.totalContacts?.value ?? 0;
  const emailsSent = data?.emailsSentThisMonth?.value ?? 0;
  const newslettersSent = data?.newslettersSent?.value ?? 0;
  const total = totalContacts + emailsSent + newslettersSent || 1;
  const contactsPct = Math.round((totalContacts / total) * 100);
  const emailsPct = Math.round((emailsSent / total) * 100);
  const newslettersPct = 100 - contactsPct - emailsPct;

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">
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
        {/* Summary Section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Total Contacts
          </h3>

          {/* Large Number Display with Growth */}
          <div className="flex items-center gap-2 mb-4">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {totalContacts.toLocaleString()}
                </div>
                {data?.totalContacts?.change !== null && data?.totalContacts?.change !== undefined && (
                  <div className={`text-sm font-medium px-2 py-1 rounded ${data.totalContacts.change >= 0
                      ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                      : 'text-red-600 bg-red-50 dark:bg-red-900/20'
                    }`}>
                    {data.totalContacts.change >= 0 ? '+' : ''}{data.totalContacts.change}%
                  </div>
                )}
              </>
            )}
          </div>

          {/* Progress Bar */}
          {isLoading ? (
            <Skeleton className="h-2 w-full rounded-full mb-3" />
          ) : (
            <div className="w-full bg-secondary rounded-full h-2 mb-3">
              <div className="flex h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${contactsPct}%` }}
                ></div>
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${emailsPct}%` }}
                ></div>
                <div
                  className="bg-purple-500 h-full transition-all"
                  style={{ width: `${newslettersPct}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-muted-foreground">Contacts</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-muted-foreground">Emails</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-muted-foreground">Newsletters</span>
            </div>
          </div>
        </div>

        {/* Metrics List */}
        <div className="space-y-3">
          {metrics.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {isLoading ? (
                  <Skeleton className="h-4 w-12" />
                ) : (
                  <>
                    <span className="text-sm font-bold">
                      {(item.metric?.value ?? 0).toLocaleString()}
                    </span>
                    <ChangeBadge change={item.metric?.change ?? null} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
