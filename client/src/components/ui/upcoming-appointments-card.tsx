import { useState } from "react";
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
  CalendarClock,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Timer,
  CalendarPlus,
  CalendarDays,
  ArrowRight,
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

  const upcomingAppointments = appointments
    .filter((appointment) => {
      const appointmentDate = new Date(appointment.appointmentDate);
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return appointmentDate >= now && appointmentDate <= sevenDaysFromNow;
    })
    .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
    .slice(0, 5);

  const getCustomerName = (customer?: AppointmentCustomer) => {
    if (!customer) return t("dashboard.appointments.unknownCustomer");
    if (customer.firstName && customer.lastName) return `${customer.firstName} ${customer.lastName}`;
    if (customer.firstName) return customer.firstName;
    if (customer.lastName) return customer.lastName;
    return customer.email;
  };

  const getStatusConfig = (status: Appointment["status"]) => {
    switch (status) {
      case "scheduled":
        return { color: "bg-blue-500/10 text-blue-700 dark:text-blue-400", dot: "bg-blue-500" };
      case "confirmed":
        return { color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
      case "cancelled":
        return { color: "bg-red-500/10 text-red-700 dark:text-red-400", dot: "bg-red-500" };
      case "completed":
        return { color: "bg-gray-500/10 text-gray-700 dark:text-gray-400", dot: "bg-gray-500" };
      case "no_show":
        return { color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
      default:
        return { color: "bg-gray-500/10 text-gray-700 dark:text-gray-400", dot: "bg-gray-500" };
    }
  };

  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(date));

  const formatFullDateTime = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(date));

  const getDayLabel = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const appointmentDate = new Date(date);
    if (appointmentDate.toDateString() === today.toDateString()) return t("dashboard.appointments.today");
    if (appointmentDate.toDateString() === tomorrow.toDateString()) return t("dashboard.appointments.tomorrow");
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(appointmentDate);
  };

  const getRelativeDay = (date: Date) => {
    const today = new Date();
    const appointmentDate = new Date(date);
    return appointmentDate.toDateString() === today.toDateString();
  };

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

  return (
    <Card className="h-full rounded-2xl border-border/50">
      <CardHeader className="pb-2 px-5 pt-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-bold flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            {t("dashboard.appointments.title")}
          </CardTitle>
          {upcomingAppointments.length > 0 && (
            <span className="text-[10px] font-bold text-muted-foreground/50 bg-muted/60 px-2 py-1 rounded-lg">
              {upcomingAppointments.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-8 space-y-3">
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
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
            {upcomingAppointments.map((appointment) => {
              const statusConfig = getStatusConfig(appointment.status);
              const dayLabel = getDayLabel(appointment.appointmentDate);
              const isToday = getRelativeDay(appointment.appointmentDate);

              return (
                <button
                  key={appointment.id}
                  type="button"
                  className={`flex items-center gap-3 cursor-pointer group w-full text-left p-3 rounded-xl transition-all duration-200 ${
                    isToday
                      ? "bg-primary/[0.04] dark:bg-primary/[0.08] border border-primary/10 hover:border-primary/20"
                      : "hover:bg-muted/40 border border-transparent"
                  }`}
                  aria-label={`View appointment: ${appointment.title}`}
                  onClick={() => handleViewAppointment(appointment)}
                >
                  {/* Time indicator */}
                  <div className="flex flex-col items-center flex-shrink-0 w-12">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground/50"}`}>
                      {dayLabel}
                    </span>
                    <span className="text-sm font-bold text-foreground/80 leading-tight">
                      {formatTime(appointment.appointmentDate)}
                    </span>
                  </div>

                  {/* Vertical line */}
                  <div className={`w-px h-10 flex-shrink-0 ${isToday ? "bg-primary/30" : "bg-border/60"}`} />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground/90 truncate group-hover:text-primary transition-colors leading-tight">
                      {appointment.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className={`${statusConfig.color} text-[9px] px-1.5 py-0 h-[18px] rounded-md capitalize border-0 font-semibold`}>
                        <span className={`w-1 h-1 rounded-full ${statusConfig.dot} mr-1`} />
                        {appointment.status.replace("_", " ")}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground/50 truncate">
                        {getCustomerName(appointment.customer)}
                      </span>
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full mt-3 border-dashed border-border/60 py-4 h-auto text-xs font-semibold rounded-xl hover:bg-muted/30 transition-colors"
          onClick={() => setLocation("/reminders")}
          data-testid="button-schedule-appointment"
        >
          <CalendarPlus className="h-3.5 w-3.5 mr-2 text-primary" />
          {t("dashboard.appointments.scheduleNew")}
        </Button>
      </CardContent>

      {/* Appointment Details Sheet */}
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
                        <Badge className={getStatusConfig(selectedAppointment.status).color}>
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
