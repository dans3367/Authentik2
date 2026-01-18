import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronRight, Calendar } from "lucide-react";
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
  appointmentDate: Date;
  status: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";
  customer?: AppointmentCustomer;
}

export function UpcomingAppointmentsCard() {
  const [, setLocation] = useLocation();

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

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800 rounded-xl h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Upcoming Appointments
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
    <Card className="bg-white dark:bg-gray-800 rounded-xl h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Upcoming Appointments
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/reminders")}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              No appointments in the next 7 days
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/reminders")}
              className="text-xs"
            >
              Schedule an Appointment
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
              <span>{upcomingAppointments.length} upcoming</span>
              <span>Next 7 days</span>
            </div>
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {appointment.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {getCustomerName(appointment.customer)} • {formatDateTime(appointment.appointmentDate)}
                    </p>
                  </div>
                  <Badge
                    className={`${getStatusColor(appointment.status)} text-[10px] px-1.5 py-0 h-5 whitespace-nowrap ml-3`}
                    variant="outline"
                  >
                    {appointment.status}
                  </Badge>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/reminders")}
              className="w-full mt-4"
            >
              Manage Appointments
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
