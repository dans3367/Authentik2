import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { computeScheduledFor, TIMEZONE_OPTIONS } from "@/utils/appointment-utils";
import type { AppointmentWithCustomer, Customer } from "@/hooks/useAppointments";

export interface ScheduleReminderData {
  reminderType: 'email' | 'sms' | 'push';
  reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
  customMinutesBefore?: number;
  scheduledFor: Date;
  timezone: string;
  content: string;
}

interface ReminderScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithCustomer | null;
  customers: Customer[];
  userTimezone: string;
  onSchedule: (appointmentId: string, data: ScheduleReminderData) => void;
  isScheduling: boolean;
  validateEmailReminder: (email: string) => Promise<string | null>;
}

export function ReminderScheduleDialog({
  open,
  onOpenChange,
  appointment,
  customers,
  userTimezone,
  onSchedule,
  isScheduling,
  validateEmailReminder,
}: ReminderScheduleDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [scheduleData, setScheduleData] = useState<ScheduleReminderData>({
    reminderType: 'email',
    reminderTiming: '1h',
    scheduledFor: new Date(),
    timezone: userTimezone,
    content: ''
  });
  
  const [reminderValidationError, setReminderValidationError] = useState<string | null>(null);

  // Update defaults when appointment or timezone changes
  useEffect(() => {
    if (appointment) {
      const baseDate = new Date(appointment.appointmentDate);
      const defaultScheduled = new Date(baseDate.getTime() - 1 * 60 * 60 * 1000); // default 1h before
      setScheduleData({
        reminderType: 'email',
        reminderTiming: '1h',
        scheduledFor: defaultScheduled,
        timezone: userTimezone,
        content: ''
      });
    }
  }, [appointment, userTimezone]);

  // Validate email when dialog opens
  useEffect(() => {
    if (open && appointment && scheduleData.reminderType === 'email') {
      const customerEmail = appointment.customer?.email || customers.find(c => c.id === appointment.customerId)?.email;
      if (customerEmail) {
        runEmailValidation(customerEmail);
      }
    } else if (!open) {
      setReminderValidationError(null);
    }
  }, [open, appointment, scheduleData.reminderType]);

  const runEmailValidation = async (email?: string | null) => {
    if (!email) {
      setReminderValidationError(null);
      return;
    }
    const errorMessage = await validateEmailReminder(email);
    setReminderValidationError(errorMessage);
  };

  const handleTimingChange = (timing: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom') => {
    if (!appointment) return;
    
    const appointmentDate = new Date(appointment.appointmentDate);
    setScheduleData(prev => ({
      ...prev,
      reminderTiming: timing,
      customMinutesBefore: timing === 'custom' ? prev.customMinutesBefore : undefined,
      scheduledFor: timing === 'custom' ? prev.scheduledFor : computeScheduledFor(appointmentDate, timing)
    }));
  };

  const handleCustomMinutesChange = (minutes: number) => {
    if (!appointment) return;
    
    const appointmentDate = new Date(appointment.appointmentDate);
    if (!isNaN(minutes) && minutes > 0 && minutes <= 10080) {
      setScheduleData(prev => ({
        ...prev,
        customMinutesBefore: minutes,
        scheduledFor: computeScheduledFor(appointmentDate, 'custom', minutes)
      }));
    }
  };

  const handleSchedule = async () => {
    if (!appointment) return;

    if (scheduleData.scheduledFor < new Date()) {
      toast({
        title: t('reminders.toasts.validationError'),
        description: "Reminder time cannot be in the past",
        variant: "destructive",
      });
      return;
    }

    if (scheduleData.reminderType === 'email') {
      const customerEmail = appointment.customer?.email || customers.find(c => c.id === appointment.customerId)?.email;
      if (customerEmail) {
        const errorMessage = await validateEmailReminder(customerEmail);
        if (errorMessage) {
          setReminderValidationError(errorMessage);
          return;
        }
      }
    }

    onSchedule(appointment.id, scheduleData);
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setReminderValidationError(null);
      } else {
        const customerEmail = appointment?.customer?.email || customers.find(c => c.id === appointment?.customerId)?.email;
        if (customerEmail && scheduleData.reminderType === 'email') {
          runEmailValidation(customerEmail);
        }
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reminders.scheduleReminder.title')}</DialogTitle>
          <DialogDescription>
            {t('reminders.scheduleReminder.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('reminders.scheduleReminder.reminderType')}</Label>
            <Select 
              value={scheduleData.reminderType} 
              onValueChange={(v) => {
                const newType = v as "email" | "sms" | "push";
                setScheduleData(prev => ({ ...prev, reminderType: newType }));

                if (newType === 'email') {
                  const customerEmail = appointment?.customer?.email || customers.find(c => c.id === appointment?.customerId)?.email;
                  runEmailValidation(customerEmail);
                } else {
                  runEmailValidation(null);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">{t('reminders.scheduleReminder.email')}</SelectItem>
                <SelectItem value="sms" disabled>{t('reminders.scheduleReminder.sms')}</SelectItem>
                <SelectItem value="push" disabled>{t('reminders.scheduleReminder.push')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('reminders.scheduleReminder.timing')}</Label>
            <Select
              value={scheduleData.reminderTiming}
              onValueChange={(v) => handleTimingChange(v as '5m' | '30m' | '1h' | '5h' | '10h' | 'custom')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">{t('reminders.scheduleReminder.5mBefore')}</SelectItem>
                <SelectItem value="30m">{t('reminders.scheduleReminder.30mBefore')}</SelectItem>
                <SelectItem value="1h">{t('reminders.scheduleReminder.1hBefore')}</SelectItem>
                <SelectItem value="5h">{t('reminders.scheduleReminder.5hBefore')}</SelectItem>
                <SelectItem value="10h">{t('reminders.scheduleReminder.10hBefore')}</SelectItem>
                <SelectItem value="custom">{t('reminders.scheduleReminder.customTime')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleData.reminderTiming === 'custom' && (
            <div>
              <Label>{t('reminders.scheduleReminder.customMinutesLabel')}</Label>
              <Input
                type="number"
                min="1"
                max="10080"
                placeholder={t('reminders.scheduleReminder.customMinutesPlaceholder')}
                value={scheduleData.customMinutesBefore || ''}
                onChange={(e) => handleCustomMinutesChange(parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('reminders.scheduleReminder.customMinutesHelp')}
              </p>
            </div>
          )}

          <div>
            <Label>Timezone</Label>
            <Select 
              value={scheduleData.timezone} 
              onValueChange={(v) => setScheduleData(prev => ({ ...prev, timezone: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {TIMEZONE_OPTIONS.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              The reminder will be sent at the scheduled time in this timezone
            </p>
          </div>

          <div>
            <Label>{t('reminders.scheduleReminder.message')}</Label>
            <Textarea
              placeholder={t('reminders.scheduleReminder.messagePlaceholder')}
              value={scheduleData.content}
              onChange={(e) => setScheduleData(prev => ({ ...prev, content: e.target.value }))}
            />
          </div>

          {reminderValidationError && scheduleData.reminderType === 'email' && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{reminderValidationError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                onOpenChange(false);
                setReminderValidationError(null);
              }}
            >
              {t('reminders.scheduleReminder.cancel')}
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={isScheduling || !appointment || (!!reminderValidationError && scheduleData.reminderType === 'email')}
            >
              {isScheduling ? t('reminders.scheduleReminder.scheduling') : t('reminders.scheduleReminder.schedule')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReminderScheduleDialog;
