import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Calendar } from "lucide-react";
import { getCustomerName, getStatusColor, formatDateTime, type AppointmentWithCustomer } from "@/utils/appointment-utils";

interface AppointmentStatsProps {
  allAppointments: AppointmentWithCustomer[];
  upcomingAppointments: AppointmentWithCustomer[];
  onViewAppointment: (appointment: AppointmentWithCustomer) => void;
}

export function AppointmentStats({
  allAppointments,
  upcomingAppointments,
  onViewAppointment,
}: AppointmentStatsProps) {
  const { t } = useTranslation();

  const confirmedCount = allAppointments.filter(apt => apt.status === 'confirmed').length;
  const remindersSentCount = allAppointments.filter(apt => apt.reminderSent).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Overview Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('reminders.overview.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('reminders.overview.total')}</span>
            <Badge variant="outline">{allAppointments.length}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('reminders.overview.upcoming')}</span>
            <Badge variant="outline">{upcomingAppointments.length}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('reminders.overview.confirmed')}</span>
            <Badge variant="outline">{confirmedCount}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('reminders.overview.remindersSent')}</span>
            <Badge variant="outline">{remindersSentCount}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('reminders.overview.upcomingThisWeek')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-4">
              <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {t('reminders.appointments.noUpcoming')}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {upcomingAppointments.slice(0, 5).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-left min-w-0 flex-1 mr-3">
                    <button
                      type="button"
                      onClick={() => onViewAppointment(appointment)}
                      className="text-sm font-medium text-left hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded block w-full truncate"
                    >
                      {appointment.title}
                    </button>
                    <p className="text-xs text-muted-foreground truncate">
                      {getCustomerName(appointment.customer)} • {formatDateTime(appointment.appointmentDate)}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(appointment.status)} text-[10px] px-1.5 py-0 h-5 whitespace-nowrap`} variant="outline">
                    {appointment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AppointmentStats;
