import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarDays, CalendarPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AppointmentDetailsContainer,
  CreateAppointmentDialog,
} from "@/components/appointments";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppointmentWithCustomer } from "@/utils/appointment-utils";

type StatusKey =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

const STATUS_DOT: Record<StatusKey, string> = {
  scheduled: "border-[color:var(--accent-coral)]",
  confirmed: "border-[color:var(--good)]",
  cancelled: "border-[color:var(--bad)]",
  completed: "border-[color:var(--ink-4)]",
  no_show: "border-[color:var(--warn)]",
};

const STATUS_BADGE: Record<StatusKey, string> = {
  scheduled:
    "bg-[color:var(--accent-coral)]/10 text-[color:var(--accent-coral)]",
  confirmed: "bg-[color:var(--good)]/10 text-[color:var(--good)]",
  cancelled: "bg-[color:var(--bad)]/10 text-[color:var(--bad)]",
  completed: "bg-muted text-muted-foreground",
  no_show: "bg-[color:var(--warn)]/15 text-[color:var(--warn)]",
};

export function UpcomingAppointmentsCard() {
  const { t } = useTranslation();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: appointmentsData, isLoading } = useQuery<{ appointments: AppointmentWithCustomer[] }>({
    queryKey: ["/api/appointments", "upcoming-dashboard", { shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/appointments");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const appointments = appointmentsData?.appointments || [];

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return appointments
      .filter((a) => {
        const d = new Date(a.appointmentDate);
        return d >= now && d <= sevenDaysFromNow;
      })
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());
  }, [appointments]);

  const dayGroups = useMemo(() => {
    const groups = new Map<string, { date: Date; items: AppointmentWithCustomer[] }>();
    for (const a of upcomingAppointments) {
      const d = new Date(a.appointmentDate);
      const key = d.toDateString();
      if (!groups.has(key)) groups.set(key, { date: d, items: [] });
      groups.get(key)!.items.push(a);
    }
    return Array.from(groups.values());
  }, [upcomingAppointments]);

  const getCustomerName = (customer?: AppointmentWithCustomer["customer"]) => {
    if (!customer) return t("dashboard.appointments.unknownCustomer");
    if (customer.firstName && customer.lastName) return `${customer.firstName} ${customer.lastName}`;
    if (customer.firstName) return customer.firstName;
    if (customer.lastName) return customer.lastName;
    return customer.email;
  };

  const formatTime = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(new Date(date));
    let hm = "";
    let ap = "";
    for (const p of parts) {
      if (p.type === "hour" || p.type === "minute" || p.type === "literal") hm += p.value;
      if (p.type === "dayPeriod") ap = p.value.toUpperCase();
    }
    return { hm: hm.trim(), ap };
  };

  const formatDuration = (minutes?: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const getDayLabel = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return t("dashboard.appointments.today");
    if (date.toDateString() === tomorrow.toDateString()) return t("dashboard.appointments.tomorrow");
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  };

  const getDayTag = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
      .format(date)
      .replace(",", " ·");

  const handleViewAppointment = (appointment: AppointmentWithCustomer) => {
    setSelectedAppointment(appointment);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="h-full rounded-2xl border-border/50">
        <CardHeader className="pb-2 px-5 pt-5">
          <CardTitle className="text-base font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            {t("dashboard.appointments.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/20 border-t-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCount = upcomingAppointments.length;

  return (
    <Card className="h-full rounded-2xl border-border/50 overflow-hidden flex flex-col">
      <CardHeader className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2.5 tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
            </div>
            {t("dashboard.appointments.title")}
            {totalCount > 0 && (
              <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
          </CardTitle>
          <span className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wide">
            {t("dashboard.appointments.agendaView")}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-0 py-0 flex-1 min-h-0 flex flex-col">
        {totalCount === 0 ? (
          <div className="text-center py-10 px-5 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
              <Calendar className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground/80 mb-0.5">
                {t("dashboard.appointments.scheduleClear")}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {t("dashboard.appointments.noAppointmentsDesc")}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            {dayGroups.map((group) => (
              <div key={group.date.toDateString()} className="pt-2">
                <div className="flex items-baseline gap-3 px-5 py-2 sticky top-0 bg-card/95 backdrop-blur z-10">
                  <span className="text-lg font-semibold tracking-tight text-foreground">
                    {getDayLabel(group.date)}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    {getDayTag(group.date)}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground/70">
                    {t("dashboard.appointments.events", { count: group.items.length })}
                  </span>
                </div>

                <div className="pt-1 pb-3">
                  {group.items.map((appointment, idx) => {
                    const { hm, ap } = formatTime(appointment.appointmentDate);
                    const statusKey = appointment.status as StatusKey;
                    const dot = STATUS_DOT[statusKey] ?? STATUS_DOT.scheduled;
                    const badge = STATUS_BADGE[statusKey] ?? STATUS_BADGE.scheduled;
                    const duration = formatDuration(appointment.duration);
                    const customerName = getCustomerName(appointment.customer);
                    const isFirst = idx === 0;
                    const isLast = idx === group.items.length - 1;

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        className="relative w-full text-left flex items-center gap-4 px-5 py-2.5 hover:bg-muted/40 transition-colors"
                        onClick={() => handleViewAppointment(appointment)}
                        aria-label={`View appointment: ${appointment.title}`}
                      >
                        {!isFirst && (
                          <span
                            className="absolute left-[84px] top-0 h-1/2 w-px bg-border"
                            aria-hidden
                          />
                        )}
                        {!isLast && (
                          <span
                            className="absolute left-[84px] top-1/2 h-1/2 w-px bg-border"
                            aria-hidden
                          />
                        )}

                        <span className="w-11 font-mono leading-tight text-right flex-none">
                          <span className="block text-xs text-foreground/80">{hm}</span>
                          <span className="block text-[10px] text-muted-foreground/70">{ap}</span>
                        </span>

                        <span
                          className={`relative w-[9px] h-[9px] rounded-full bg-card border-2 ${dot} flex-none z-[1]`}
                          aria-hidden
                        />

                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold tracking-tight truncate">
                            {appointment.title}
                          </span>
                          <span className="flex items-center gap-2 mt-1 text-xs text-muted-foreground min-w-0">
                            <Badge
                              className={`${badge} text-[10px] font-mono font-medium lowercase px-1.5 py-0 h-[18px] rounded-md border-0 gap-1`}
                            >
                              <span className="w-1 h-1 rounded-full bg-current" />
                              {appointment.status.replace("_", " ")}
                            </Badge>
                            <span className="truncate">{customerName}</span>
                          </span>
                        </span>

                        {duration && (
                          <span className="text-[11px] font-mono text-muted-foreground/70 flex-none">
                            {duration}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end px-5 py-3 mt-auto border-t border-border/40">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                onClick={() => setCreateOpen(true)}
                data-testid="button-schedule-appointment"
                aria-label={t("dashboard.appointments.scheduleNewTooltip", {
                  defaultValue: "Create a new appointment",
                })}
              >
                <CalendarPlus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              {t("dashboard.appointments.scheduleNewTooltip", {
                defaultValue: "Create a new appointment",
              })}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>

      <AppointmentDetailsContainer
        appointment={selectedAppointment}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <CreateAppointmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        hideTrigger
      />
    </Card>
  );
}
