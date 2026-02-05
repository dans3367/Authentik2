import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Timer,
  MapPin,
  Clock,
  CheckCircle,
  Edit,
  Eye,
  MoreVertical,
  Send,
  Trash2,
  Loader2
} from "lucide-react";
import {
  getCustomerName,
  getStatusColor,
  formatDateTime,
  hasAppointmentSentReminder,
  hasAppointmentPendingReminder,
  type AppointmentWithCustomer,
  type AppointmentReminder,
} from "@/utils/appointment-utils";

interface AppointmentCardProps {
  appointment: AppointmentWithCustomer;
  reminders: AppointmentReminder[];
  isSelected: boolean;
  isPending: boolean;
  isPendingReminder: boolean;
  onSelect: (checked: boolean) => void;
  onClick: () => void;
  onEdit: () => void;
  onView: () => void;
  onConfirm: () => void;
  onSendReminder: () => void;
  onScheduleReminder: () => void;
  onDelete: () => void;
}

export function AppointmentCard({
  appointment,
  reminders,
  isSelected,
  isPending,
  isPendingReminder,
  onSelect,
  onClick,
  onEdit,
  onView,
  onConfirm,
  onSendReminder,
  onScheduleReminder,
  onDelete,
}: AppointmentCardProps) {
  const { t } = useTranslation();

  const hasSentReminder = hasAppointmentSentReminder(appointment, reminders);
  const hasPendingReminder = hasAppointmentPendingReminder(appointment, reminders);

  return (
    <Card
      className={`overflow-hidden ${isPending ? 'opacity-70 pointer-events-none animate-pulse' : 'cursor-pointer'}`}
      onClick={() => !isPending && onClick()}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with checkbox and status */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div onClick={(event) => event.stopPropagation()}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary mt-1" />
                ) : (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelect(checked as boolean)}
                    className="mt-1"
                  />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base">{appointment.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{getCustomerName(appointment.customer)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">{appointment.customer?.email}</p>
              </div>
            </div>
            {isPending ? (
              <Badge className="bg-blue-100 text-blue-800">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Saving...
              </Badge>
            ) : (
              <Badge className={getStatusColor(appointment.status)}>
                {appointment.status.replace('_', ' ')}
              </Badge>
            )}
          </div>

          {/* Appointment details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>{formatDateTime(appointment.appointmentDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Timer className="h-4 w-4 text-gray-500" />
              <span>{appointment.duration} {t('reminders.appointments.minutes')}</span>
            </div>
            {appointment.location && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span>{appointment.location}</span>
              </div>
            )}

            {/* Reminder status */}
            <div className="flex items-center gap-2">
              {(isPending || isPendingReminder) ? (
                <div className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : hasSentReminder ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{t('reminders.reminderHistory.sent')}</span>
                </div>
              ) : hasPendingReminder ? (
                <div className="flex items-center gap-1 text-blue-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Scheduled</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{t('reminders.reminderHistory.notSet')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onView();
              }}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onConfirm(); }}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Appointment
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendReminder(); }}>
                  <Send className="h-4 w-4 mr-2" />
                  {t('reminders.actions.sendReminder')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onScheduleReminder(); }}>
                  <Clock className="h-4 w-4 mr-2" />
                  {t('reminders.actions.scheduleReminder')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AppointmentCard;
