import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CalendarClock, ChevronRight, Calendar, Clock, MapPin, User, Mail, Timer } from "lucide-react";
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
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: appointmentsData, isLoading } = useQuery<{ appointments: Appointment[] }>({
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
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return appointmentDate >= now && appointmentDate <= sevenDaysFromNow;
    })
    .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
    .slice(0, 5);

  const getCustomerName = (customer?: AppointmentCustomer) => {
    if (!customer) return "Unknown Customer";
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    }
    if (customer.firstName) {
      return customer.firstName;
    }
    if (customer.lastName) {
      return customer.lastName;
    }
    return customer.email;
  };

  const getStatusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "no_show":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMonthName = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(date)).toUpperCase();
  };

  const getDayNumber = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(new Date(date));
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));
  };

  const formatFullDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800 rounded-xl h-full shadow-sm border border-gray-100 dark:border-gray-700">
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-700">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-500" />
            Upcoming Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-xl h-full shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-500" />
            Upcoming Schedule
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              No appointments scheduled for the next 7 days
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-6">
              {upcomingAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  className="flex items-center gap-4 cursor-pointer group w-full text-left"
                  aria-label={`View appointment: ${appointment.title}`}
                  onClick={() => handleViewAppointment(appointment)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleViewAppointment(appointment);
                    }
                  }}
                >
                  {/* Date Box */}
                  <div className="flex flex-col items-center justify-center w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 group-hover:border-blue-200 transition-colors">
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide leading-none mb-1">
                      {getMonthName(appointment.appointmentDate)}
                    </span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                      {getDayNumber(appointment.appointmentDate)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                        {appointment.title}
                      </h3>
                      <Badge className={`${getStatusColor(appointment.status)} text-xs px-2 py-0.5 rounded-full capitalize whitespace-nowrap`}>
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 truncate">
                      <Clock className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                      {formatTime(appointment.appointmentDate)}
                      <span className="mx-2 flex-shrink-0">•</span>
                      <User className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                      <span className="truncate">{getCustomerName(appointment.customer)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          className="w-full mt-8 border-2 border-dashed border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 py-6 h-auto text-base font-medium rounded-xl"
          onClick={() => setLocation("/reminders")}
        >
          <CalendarClock className="h-5 w-5 mr-2" />
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
                  <Calendar className="h-5 w-5" />
                  Appointment Details
                </SheetTitle>
                <SheetDescription>
                  View appointment information
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Customer Information */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                      <p className="font-medium">{getCustomerName(selectedAppointment.customer)}</p>
                    </div>
                    {selectedAppointment.customer?.email && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                        <p className="text-sm flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedAppointment.customer.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Details
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Title</p>
                      <p className="font-medium">{selectedAppointment.title}</p>
                    </div>
                    {selectedAppointment.description && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
                        <p className="text-sm">{selectedAppointment.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Date & Time</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatFullDateTime(selectedAppointment.appointmentDate)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAppointment.duration && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                          <p className="text-sm flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {selectedAppointment.duration} min
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                        <Badge className={getStatusColor(selectedAppointment.status)}>
                          {selectedAppointment.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    {selectedAppointment.location && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                        <p className="text-sm flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
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
