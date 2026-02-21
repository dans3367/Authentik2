import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
import { useLocation } from "wouter";

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
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: appointmentsData, isLoading } = useQuery<{
    appointments: Appointment[];
  }>({
    queryKey: ["/api/appointments/upcoming-dashboard"],
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
      const sevenDaysFromNow = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      return appointmentDate >= now && appointmentDate <= sevenDaysFromNow;
    })
    .sort(
      (a, b) =>
        new Date(a.appointmentDate).getTime() -
        new Date(b.appointmentDate).getTime()
    )
    .slice(0, 5);

  const getCustomerName = (customer?: AppointmentCustomer) => {
    if (!customer) return "Unknown Customer";
    if (customer.firstName && customer.lastName)
      return `${customer.firstName} ${customer.lastName}`;
    if (customer.firstName) return customer.firstName;
    if (customer.lastName) return customer.lastName;
    return customer.email;
  };

  const getStatusConfig = (status: Appointment["status"]) => {
    switch (status) {
      case "scheduled":
        return {
          color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          dot: "bg-blue-500",
        };
      case "confirmed":
        return {
          color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          dot: "bg-emerald-500",
        };
      case "cancelled":
        return {
          color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          dot: "bg-red-500",
        };
      case "completed":
        return {
          color: "bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
          dot: "bg-gray-500",
        };
      case "no_show":
        return {
          color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          dot: "bg-amber-500",
        };
      default:
        return {
          color: "bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
          dot: "bg-gray-500",
        };
    }
  };

  const getMonthName = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short" })
      .format(new Date(date))
      .toUpperCase();

  const getDayNumber = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(new Date(date));

  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));

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

  const getDayLabel = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const appointmentDate = new Date(date);

    if (appointmentDate.toDateString() === today.toDateString()) return "Today";
    if (appointmentDate.toDateString() === tomorrow.toDateString())
      return "Tomorrow";
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
      appointmentDate
    );
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            Upcoming Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/20 border-t-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            Upcoming Schedule
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto">
              <Calendar className="h-7 w-7 text-primary/40" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                Schedule is clear
              </p>
              <p className="text-xs text-muted-foreground">
                No appointments for the next 7 days
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAppointments.map((appointment) => {
              const statusConfig = getStatusConfig(appointment.status);
              const dayLabel = getDayLabel(appointment.appointmentDate);
              const isToday = dayLabel === "Today";

              return (
                <button
                  key={appointment.id}
                  type="button"
                  className={`flex items-center gap-3 cursor-pointer group w-full text-left p-3 rounded-xl transition-all duration-200 ${isToday
                      ? "bg-gradient-to-r from-primary/5 to-blue-500/5 dark:from-primary/10 dark:to-blue-500/10 border border-primary/10 hover:shadow-md"
                      : "bg-muted/30 hover:bg-muted/60"
                    }`}
                  aria-label={`View appointment: ${appointment.title}`}
                  onClick={() => handleViewAppointment(appointment)}
                >
                  {/* Date Box */}
                  <div
                    className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl flex-shrink-0 ${isToday
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-muted/80 border border-border/50"
                      }`}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 ${isToday ? "text-primary-foreground/80" : "text-destructive"
                        }`}
                    >
                      {getMonthName(appointment.appointmentDate)}
                    </span>
                    <span
                      className={`text-lg font-bold leading-none ${isToday ? "text-primary-foreground" : "text-foreground"
                        }`}
                    >
                      {getDayNumber(appointment.appointmentDate)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {appointment.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(appointment.appointmentDate)}
                      </span>
                      <span className="text-border">•</span>
                      <span className="truncate">
                        {getCustomerName(appointment.customer)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge
                        className={`${statusConfig.color} text-[10px] px-2 py-0 h-5 rounded-md capitalize border-0 font-medium`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} mr-1`}
                        />
                        {appointment.status.replace("_", " ")}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {dayLabel}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full mt-4 border-dashed border-border/80 py-5 h-auto text-sm font-medium rounded-xl hover:bg-muted/50 transition-colors"
          onClick={() => setLocation("/reminders")}
          data-testid="button-schedule-appointment"
        >
          <CalendarPlus className="h-4 w-4 mr-2 text-primary" />
          Schedule New Appointment
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
                  Appointment Details
                </SheetTitle>
                <SheetDescription>View appointment information</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Customer Information */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Customer
                  </h3>
                  <div className="bg-muted/40 p-4 rounded-xl space-y-2.5">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">
                        Name
                      </p>
                      <p className="font-semibold text-sm text-foreground">
                        {getCustomerName(selectedAppointment.customer)}
                      </p>
                    </div>
                    {selectedAppointment.customer?.email && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">
                          Email
                        </p>
                        <p className="text-sm flex items-center gap-1.5 text-foreground">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {selectedAppointment.customer.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Details
                  </h3>
                  <div className="bg-muted/40 p-4 rounded-xl space-y-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">
                        Title
                      </p>
                      <p className="font-semibold text-sm text-foreground">
                        {selectedAppointment.title}
                      </p>
                    </div>
                    {selectedAppointment.description && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">
                          Description
                        </p>
                        <p className="text-sm text-foreground">
                          {selectedAppointment.description}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">
                        Date & Time
                      </p>
                      <p className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatFullDateTime(
                          selectedAppointment.appointmentDate
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAppointment.duration && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-0.5">
                            Duration
                          </p>
                          <p className="text-sm flex items-center gap-1.5 text-foreground">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            {selectedAppointment.duration} min
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">
                          Status
                        </p>
                        <Badge
                          className={
                            getStatusConfig(selectedAppointment.status).color
                          }
                        >
                          {selectedAppointment.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    {selectedAppointment.location && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">
                          Location
                        </p>
                        <p className="text-sm flex items-center gap-1.5 text-foreground">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {selectedAppointment.location}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setDetailsOpen(false);
                      setLocation("/reminders");
                    }}
                  >
                    View Full Details
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDetailsOpen(false)}
                  >
                    Close
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
