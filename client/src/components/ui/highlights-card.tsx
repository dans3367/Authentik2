import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Newspaper,
  CalendarCheck,
  Activity,
} from "lucide-react";
import { useDashboardHighlights, type StatMetric } from "@/hooks/useStats";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector } from "@/store";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface MetricItem {
  label: string;
  icon: React.ElementType;
  metric: StatMetric | undefined;
  color: string;
  chartColor: string;
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null || change === undefined) return null;
  const isPositive = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isPositive
          ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15"
          : "text-red-700 bg-red-500/10 dark:text-red-400 dark:bg-red-500/15"
        }`}
    >
      {isPositive ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : (
        <TrendingDown className="w-2.5 h-2.5" />
      )}
      {isPositive ? "+" : ""}
      {change}%
    </span>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">{payload[0].name}</p>
        <p className="text-muted-foreground">{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export function HighlightsCard() {
  const { data, isLoading } = useDashboardHighlights();
  const { t } = useTranslation();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const { data: shopsData } = useQuery<{ shops: { id: string; name: string; status: string }[] }>({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops?limit=100");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const selectedShopName = selectedShopId
    ? shopsData?.shops?.find((s) => s.id === selectedShopId)?.name
    : null;

  const metrics: MetricItem[] = [
    {
      label: t("dashboard.highlights.contacts"),
      icon: Users,
      metric: data?.totalContacts,
      color: "text-blue-600 dark:text-blue-400",
      chartColor: "#3b82f6",
    },
    {
      label: t("dashboard.highlights.emailsSent"),
      icon: Mail,
      metric: data?.emailsSentThisMonth,
      color: "text-emerald-600 dark:text-emerald-400",
      chartColor: "#10b981",
    },
    {
      label: t("dashboard.highlights.newsletters"),
      icon: Newspaper,
      metric: data?.newslettersSent,
      color: "text-violet-600 dark:text-violet-400",
      chartColor: "#8b5cf6",
    },
    {
      label: t("dashboard.highlights.appointments"),
      icon: CalendarCheck,
      metric: data?.upcomingAppointments,
      color: "text-amber-600 dark:text-amber-400",
      chartColor: "#f59e0b",
    },
  ];

  const chartData = metrics.map((m) => ({
    name: m.label,
    value: Math.max(m.metric?.value ?? 0, 1),
    color: m.chartColor,
  }));

  const totalValue = metrics.reduce((sum, m) => sum + (m.metric?.value ?? 0), 0);

  return (
    <Card className="h-full rounded-2xl border-border/50">
      <CardHeader className="pb-2 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <CardTitle className="text-base font-bold tracking-tight">
            {selectedShopName
              ? t("dashboard.highlights.title") + " for " + selectedShopName
              : t("dashboard.highlights.title") + " for All Shops"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading ? (
          <div className="space-y-4 pt-2">
            <Skeleton className="h-32 w-32 rounded-full mx-auto" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Donut Chart */}
            <div className="relative flex items-center justify-center">
              <div className="w-40 h-40 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      isAnimationActive={true}
                      activeIndex={-1}
                      style={{ cursor: "default", outline: "none" }}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <span className="text-2xl font-extrabold tracking-tight leading-none">
                  {totalValue.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mt-0.5">
                  Total
                </span>
              </div>
            </div>

            {/* Metric rows */}
            <div className="space-y-1.5">
              {metrics.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors duration-150"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.chartColor }}
                  />
                  <span className="text-xs text-muted-foreground font-medium flex-1 truncate">
                    {item.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {(item.metric?.value ?? 0).toLocaleString()}
                  </span>
                  <ChangeBadge change={item.metric?.change ?? null} />
                </div>
              ))}
            </div>

            {/* Activity Breakdown Bar */}
            <div className="pt-2 border-t border-border/40">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.12em] mb-2">
                {t("dashboard.highlights.activityBreakdown")}
              </p>
              <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
                <div className="flex h-full rounded-full overflow-hidden">
                  {(() => {
                    const totalContacts = data?.totalContacts?.value ?? 0;
                    const emailsSent = data?.emailsSentThisMonth?.value ?? 0;
                    const newslettersSent = data?.newslettersSent?.value ?? 0;
                    const total = totalContacts + emailsSent + newslettersSent || 1;
                    const contactsPct = Math.round((totalContacts / total) * 100);
                    const emailsPct = Math.round((emailsSent / total) * 100);
                    const newslettersPct = 100 - contactsPct - emailsPct;
                    return (
                      <>
                        <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${contactsPct}%` }} />
                        <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${emailsPct}%` }} />
                        <div className="bg-violet-500 h-full transition-all duration-700" style={{ width: `${newslettersPct}%` }} />
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span className="text-[10px] text-muted-foreground/60">{t("dashboard.highlights.contacts_legend")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-[10px] text-muted-foreground/60">{t("dashboard.highlights.emails_legend")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full" />
                  <span className="text-[10px] text-muted-foreground/60">{t("dashboard.highlights.newsletters_legend")}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
