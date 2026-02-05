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
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('reminders.overview.total')}</span>
            <Badge variant="outline">{allAppointments.length}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('reminders.overview.upcoming')}</span>
            <Badge variant="outline">{upcomingAppointments.length}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('reminders.overview.confirmed')}</span>
            <Badge variant="outline">{confirmedCount}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('reminders.overview.remindersSent')}</span>
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
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('reminders.appointments.noUpcoming')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 5).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => onViewAppointment(appointment)}
                >
                  <div>
                    <p className="font-medium">{appointment.title}</p>
                    <p className="text-xs text-gray-500">
                      {getCustomerName(appointment.customer)} • {formatDateTime(appointment.appointmentDate)}
                    </p>
                  </div>
                  <Badge className={getStatusColor(appointment.status)}>
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
