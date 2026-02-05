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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
      {/* Overview Stats */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            {t('reminders.overview.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('reminders.overview.total')}</span>
            <Badge variant="secondary" className="text-base font-semibold px-3">{allAppointments.length}</Badge>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('reminders.overview.upcoming')}</span>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-base font-semibold px-3">{upcomingAppointments.length}</Badge>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('reminders.overview.confirmed')}</span>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-base font-semibold px-3">{confirmedCount}</Badge>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('reminders.overview.remindersSent')}</span>
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-base font-semibold px-3">{remindersSentCount}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
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
            <div className="space-y-2">
              {upcomingAppointments.slice(0, 5).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                  onClick={() => onViewAppointment(appointment)}
                >
                  <div className="text-left min-w-0 flex-1 mr-3">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {appointment.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getCustomerName(appointment.customer)} • {formatDateTime(appointment.appointmentDate)}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(appointment.status)} text-[10px] px-2 py-0.5 h-5 whitespace-nowrap font-medium`}>
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
