import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Timer,
  CalendarPlus,
  CalendarDays,
  Plus,
} from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

interface AppointmentCustomer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface Appointment {
  id: string;
  title: string;
  description?: string;
  appointmentDate: Date;
  duration?: number;
  location?: string;
  status: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";
  customer?: AppointmentCustomer;
  createdAt?: Date;
  updatedAt?: Date;
}

type StatusKey = Appointment["status"];

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
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: appointmentsData, isLoading } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["/api/appointments/upcoming-dashboard", { shopId: selectedShopId }],
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
    const groups = new Map<string, { date: Date; items: Appointment[] }>();
    for (const a of upcomingAppointments) {
      const d = new Date(a.appointmentDate);
      const key = d.toDateString();
      if (!groups.has(key)) groups.set(key, { date: d, items: [] });
      groups.get(key)!.items.push(a);
    }
    return Array.from(groups.values());
  }, [upcomingAppointments]);

  const getCustomerName = (customer?: AppointmentCustomer) => {
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

  const formatFullDateTime = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));

  const formatDuration = (minutes?: number) => {
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

  const handleViewAppointment = (appointment: Appointment) => {
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

                <div className="relative pl-[72px] pr-5 pb-3 pt-1">
                  <div className="absolute left-[52px] top-3 bottom-3 w-px bg-border/70" />
                  {group.items.map((appointment) => {
                    const { hm, ap } = formatTime(appointment.appointmentDate);
                    const dot = STATUS_DOT[appointment.status] ?? STATUS_DOT.scheduled;
                    const badge = STATUS_BADGE[appointment.status] ?? STATUS_BADGE.scheduled;
                    const duration = formatDuration(appointment.duration);
                    const customerName = getCustomerName(appointment.customer);

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        className="relative w-full text-left grid grid-cols-[1fr_auto] gap-3 items-center rounded-lg border border-transparent hover:bg-muted/40 hover:border-border/60 transition-colors px-3 py-2.5 mb-1"
                        onClick={() => handleViewAppointment(appointment)}
                        aria-label={`View appointment: ${appointment.title}`}
                      >
                        <span
                          className={`absolute -left-[24px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full bg-card border-2 ${dot}`}
                          aria-hidden
                        />
                        <span className="absolute -left-[72px] top-1/2 -translate-y-1/2 w-11 text-right font-mono leading-tight">
                          <span className="block text-xs text-foreground/80">{hm}</span>
                          <span className="block text-[10px] text-muted-foreground/70">{ap}</span>
                        </span>

                        <span className="min-w-0">
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

        <button
          type="button"
          className="flex items-center justify-between gap-2 px-5 py-3 mt-auto border-t border-border/40 hover:bg-muted/40 transition-colors"
          onClick={() => setLocation("/reminders")}
          data-testid="button-schedule-appointment"
        >
          <span className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold">
              {t("dashboard.appointments.scheduleNew")}
            </span>
          </span>
          <CalendarPlus className="h-4 w-4 text-muted-foreground/60" />
        </button>
      </CardContent>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedAppointment && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  {t("dashboard.appointments.detailsTitle")}
                </SheetTitle>
                <SheetDescription>{t("dashboard.appointments.detailsDescription")}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {t("dashboard.appointments.customer")}
                  </h3>
                  <div className="bg-muted/40 p-4 rounded-xl space-y-2.5">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.name")}</p>
                      <p className="font-semibold text-sm text-foreground">{getCustomerName(selectedAppointment.customer)}</p>
                    </div>
                    {selectedAppointment.customer?.email && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.email")}</p>
                        <p className="text-sm flex items-center gap-1.5 text-foreground">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {selectedAppointment.customer.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("dashboard.appointments.details")}
                  </h3>
                  <div className="bg-muted/40 p-4 rounded-xl space-y-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.title_label")}</p>
                      <p className="font-semibold text-sm text-foreground">{selectedAppointment.title}</p>
                    </div>
                    {selectedAppointment.description && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.description_label")}</p>
                        <p className="text-sm text-foreground">{selectedAppointment.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.dateTime")}</p>
                      <p className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatFullDateTime(selectedAppointment.appointmentDate)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAppointment.duration && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.duration")}</p>
                          <p className="text-sm flex items-center gap-1.5 text-foreground">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            {t("dashboard.appointments.durationMin", { count: selectedAppointment.duration })}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.status")}</p>
                        <Badge className={STATUS_BADGE[selectedAppointment.status] ?? STATUS_BADGE.scheduled}>
                          {t(`dashboard.appointments.status_${selectedAppointment.status}`)}
                        </Badge>
                      </div>
                    </div>
                    {selectedAppointment.location && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">{t("dashboard.appointments.location")}</p>
                        <p className="text-sm flex items-center gap-1.5 text-foreground">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {selectedAppointment.location}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button className="flex-1" onClick={() => { setDetailsOpen(false); setLocation("/reminders"); }}>
                    {t("dashboard.appointments.viewFullDetails")}
                  </Button>
                  <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                    {t("dashboard.appointments.close")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
