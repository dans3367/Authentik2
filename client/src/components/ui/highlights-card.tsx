import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Newspaper,
  CalendarCheck,
  BarChart3,
} from "lucide-react";
import { useDashboardHighlights, type StatMetric } from "@/hooks/useStats";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

interface MetricItem {
  label: string;
  icon: React.ElementType;
  metric: StatMetric | undefined;
  accentColor: string;
  bgColor: string;
  darkBgColor: string;
}

function AnimatedNumber({ value }: { value: number }) {
  return <span>{value.toLocaleString()}</span>;
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null || change === undefined) return null;
  const isPositive = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${isPositive
          ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30"
          : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30"
        }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isPositive ? "+" : ""}
      {change}%
    </span>
  );
}

export function HighlightsCard() {
  const { data, isLoading } = useDashboardHighlights();
  const { t } = useTranslation();

  const metrics: MetricItem[] = [
    {
      label: t("dashboard.highlights.contacts"),
      icon: Users,
      metric: data?.totalContacts,
      accentColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50",
      darkBgColor: "dark:bg-blue-900/20",
    },
    {
      label: t("dashboard.highlights.emailsSent"),
      icon: Mail,
      metric: data?.emailsSentThisMonth,
      accentColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50",
      darkBgColor: "dark:bg-emerald-900/20",
    },
    {
      label: t("dashboard.highlights.newsletters"),
      icon: Newspaper,
      metric: data?.newslettersSent,
      accentColor: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50",
      darkBgColor: "dark:bg-violet-900/20",
    },
    {
      label: t("dashboard.highlights.appointments"),
      icon: CalendarCheck,
      metric: data?.upcomingAppointments,
      accentColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50",
      darkBgColor: "dark:bg-amber-900/20",
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <CardTitle className="text-lg font-bold">{t("dashboard.highlights.title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((item, index) => (
          <div
            key={index}
            className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors duration-200"
          >
            {/* Icon */}
            <div
              className={`w-9 h-9 rounded-lg ${item.bgColor} ${item.darkBgColor} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}
            >
              <item.icon className={`w-4 h-4 ${item.accentColor}`} />
            </div>

            {/* Label & Value */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium truncate">
                {item.label}
              </p>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Skeleton className="h-5 w-14" />
                ) : (
                  <>
                    <span className="text-lg font-bold leading-tight">
                      <AnimatedNumber
                        value={item.metric?.value ?? 0}
                      />
                    </span>
                    <ChangeBadge change={item.metric?.change ?? null} />
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Activity Bar */}
        {!isLoading && (
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="font-medium">{t("dashboard.highlights.activityBreakdown")}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="flex h-full rounded-full overflow-hidden">
                {(() => {
                  const totalContacts = data?.totalContacts?.value ?? 0;
                  const emailsSent = data?.emailsSentThisMonth?.value ?? 0;
                  const newslettersSent = data?.newslettersSent?.value ?? 0;
                  const total =
                    totalContacts + emailsSent + newslettersSent || 1;
                  const contactsPct = Math.round(
                    (totalContacts / total) * 100
                  );
                  const emailsPct = Math.round((emailsSent / total) * 100);
                  const newslettersPct = 100 - contactsPct - emailsPct;
                  return (
                    <>
                      <div
                        className="bg-blue-500 h-full transition-all duration-700"
                        style={{ width: `${contactsPct}%` }}
                      />
                      <div
                        className="bg-emerald-500 h-full transition-all duration-700"
                        style={{ width: `${emailsPct}%` }}
                      />
                      <div
                        className="bg-violet-500 h-full transition-all duration-700"
                        style={{ width: `${newslettersPct}%` }}
                      />
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-[11px] text-muted-foreground">
                  {t("dashboard.highlights.contacts_legend")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[11px] text-muted-foreground">
                  {t("dashboard.highlights.emails_legend")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-violet-500 rounded-full" />
                <span className="text-[11px] text-muted-foreground">
                  {t("dashboard.highlights.newsletters_legend")}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
