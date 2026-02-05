import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, AlertTriangle } from "lucide-react";
import {
  getCustomerName,
  toLocalDateString,
  toLocalTimeString,
  mergeDateAndTime,
  TIMEZONE_OPTIONS
} from "@/utils/appointment-utils";
import type { Customer } from "@/hooks/useAppointments";
import type { Appointment } from "@shared/schema";

export interface NewAppointmentData {
  customerId: string;
  title: string;
  description: string;
  appointmentDate: Date;
  duration: number;
  location: string;
  serviceType: string;
  status: Appointment['status'];
  notes: string;
}

export interface ReminderData {
  reminderType: 'email' | 'sms' | 'push';
  reminderTiming: 'now' | '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
  customMinutesBefore?: number;
  timezone: string;
  content?: string;
}

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  userTimezone: string;
  onSubmit: (data: NewAppointmentData, reminderEnabled: boolean, reminderData: ReminderData) => void;
  isSubmitting: boolean;
  validateEmailReminder: (email: string) => Promise<string | null>;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  customers,
  userTimezone,
  onSubmit,
  isSubmitting,
  validateEmailReminder,
}: AppointmentFormDialogProps) {
  const { t } = useTranslation();

  const [appointmentData, setAppointmentData] = useState<NewAppointmentData>({
    customerId: "",
    title: "",
    description: "",
    appointmentDate: new Date(),
    duration: 60,
    location: "",
    serviceType: "",
    status: 'scheduled',
    notes: "",
  });

  const [errors, setErrors] = useState<{
    customerId?: boolean;
    title?: boolean;
    customMinutesBefore?: boolean;
  }>({});

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderData, setReminderData] = useState<ReminderData>({
    reminderType: 'email',
    reminderTiming: '1h',
    customMinutesBefore: undefined,
    timezone: userTimezone,
    content: '',
  });

  const [reminderValidationError, setReminderValidationError] = useState<string | null>(null);

  // Update timezone when userTimezone changes
  useEffect(() => {
    if (userTimezone) {
      setReminderData(prev => ({ ...prev, timezone: userTimezone }));
    }
  }, [userTimezone]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setAppointmentData({
        customerId: "",
        title: "",
        description: "",
        appointmentDate: new Date(),
        duration: 60,
        location: "",
        serviceType: "",
        status: 'scheduled',
        notes: "",
      });
      setErrors({});
      setReminderEnabled(false);
      setReminderModalOpen(false);
      setReminderData({
        reminderType: 'email',
        reminderTiming: '1h',
        customMinutesBefore: undefined,
        timezone: userTimezone,
        content: '',
      });
      setReminderValidationError(null);
    }
  }, [open, userTimezone]);

  const runEmailValidation = async (email?: string | null) => {
    if (!email) {
      setReminderValidationError(null);
      return;
    }
    const errorMessage = await validateEmailReminder(email);
    setReminderValidationError(errorMessage);
  };

  const handleSubmit = () => {
    const newErrors: typeof errors = {};

    if (!appointmentData.customerId) {
      newErrors.customerId = true;
    }
    if (!appointmentData.title) {
      newErrors.title = true;
    }
    if (reminderEnabled && reminderData.reminderTiming === 'custom' && !reminderData.customMinutesBefore) {
      newErrors.customMinutesBefore = true;
    }

    // Validate that the selected customer actually exists
    if (appointmentData.customerId) {
      const selectedCustomer = customers.find(c => c.id === appointmentData.customerId);
      if (!selectedCustomer) {
        newErrors.customerId = true;
      }
    }
  }

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  setErrors({});
  onSubmit(appointmentData, reminderEnabled, reminderData);
};

const selectedCustomer = customers.find(c => c.id === appointmentData.customerId);
const isCustomerBlocked = selectedCustomer &&
  reminderData.reminderType === 'email' &&
  (selectedCustomer.status === 'unsubscribed' || selectedCustomer.status === 'bounced');

return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button>
        <CalendarPlus className="h-4 w-4 mr-2" />
        {t('reminders.appointments.newAppointment')}
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>{t('reminders.appointments.createAppointment')}</DialogTitle>
        <DialogDescription>
          {t('reminders.appointments.scheduleDescription')}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 overflow-y-auto flex-1">
        <div>
          <Label className={errors.customerId ? "text-red-500" : ""}>
            {t('reminders.appointments.customer')} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={appointmentData.customerId}
            onValueChange={async (value) => {
              setAppointmentData(prev => ({ ...prev, customerId: value }));
              setErrors(prev => ({ ...prev, customerId: false }));

              // Force validation check when customer is selected and reminder is enabled with email type
              if (reminderEnabled && reminderData.reminderType === 'email') {
                const customer = customers.find(c => c.id === value);
                runEmailValidation(customer?.email);
              }
            }}
          >
            <SelectTrigger className={`focus-visible:ring-0 focus:ring-0 ${errors.customerId ? 'border-red-500' : ''}`}>
              <SelectValue placeholder={t('reminders.appointments.selectCustomer')} />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {getCustomerName(customer)} ({customer.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className={errors.title ? "text-red-500" : ""}>
            {t('reminders.appointments.title')} <span className="text-red-500">*</span>
          </Label>
          <Input
            value={appointmentData.title}
            onChange={(e) => {
              setAppointmentData(prev => ({ ...prev, title: e.target.value }));
              setErrors(prev => ({ ...prev, title: false }));
            }}
            placeholder={t('reminders.appointments.titlePlaceholder')}
            className={`focus-visible:ring-0 ${errors.title ? 'border-red-500' : ''}`}
          />
        </div>

        <div>
          <Label>{t('reminders.appointments.dateTime')}</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="date"
              value={toLocalDateString(appointmentData.appointmentDate)}
              onChange={(e) => setAppointmentData(prev => ({
                ...prev,
                appointmentDate: mergeDateAndTime(prev.appointmentDate, e.target.value, undefined)
              }))}
              className="focus-visible:ring-0"
            />
            <Input
              type="time"
              value={toLocalTimeString(appointmentData.appointmentDate)}
              onChange={(e) => setAppointmentData(prev => ({
                ...prev,
                appointmentDate: mergeDateAndTime(prev.appointmentDate, undefined, e.target.value)
              }))}
              className="focus-visible:ring-0"
            />
          </div>
        </div>

        <div>
          <Label>{t('reminders.appointments.duration')}</Label>
          <Input
            type="number"
            value={appointmentData.duration}
            onChange={(e) => setAppointmentData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
            min="15"
            step="15"
            className="focus-visible:ring-0"
          />
        </div>

        <div>
          <Label>{t('reminders.appointments.location')}</Label>
          <Input
            value={appointmentData.location}
            onChange={(e) => setAppointmentData(prev => ({ ...prev, location: e.target.value }))}
            placeholder={t('reminders.appointments.locationPlaceholder')}
            className="focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-4 border-t">
        <div className="flex items-center gap-3">
          <Label htmlFor="new-reminder-enabled" className="cursor-pointer">
            {t('reminders.scheduleReminder.title')}
          </Label>
          <Switch
            id="new-reminder-enabled"
            checked={reminderEnabled}
            onCheckedChange={(checked) => {
              setReminderEnabled(checked);
              if (checked) {
                setReminderModalOpen(true);
              } else {
                setReminderModalOpen(false);
                setErrors(prev => ({ ...prev, customMinutesBefore: false }));
              }
            }}
            className="focus-visible:ring-0"
          />
          {reminderEnabled && (
            <button
              type="button"
              onClick={() => setReminderModalOpen(true)}
              className="text-sm underline text-muted-foreground hover:text-foreground"
            >
              {t('common.modify')}
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => {
            onOpenChange(false);
            setReminderModalOpen(false);
          }}>
            {t('reminders.appointments.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {t('reminders.appointments.createAppointment')}
          </Button>
        </div>
      </div>

      {/* Reminder Configuration Modal */}
      <Dialog open={reminderModalOpen} onOpenChange={(open) => {
        setReminderModalOpen(open);
        if (!open) {
          setReminderValidationError(null);
        } else {
          // Force validation check when opening
          if (appointmentData.customerId && reminderData.reminderType === 'email') {
            const customer = customers.find(c => c.id === appointmentData.customerId);
            runEmailValidation(customer?.email);
          } else {
            runEmailValidation(null);
          }
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('reminders.scheduleReminder.title')}</DialogTitle>
            <DialogDescription>
              {t('reminders.appointments.scheduleDescription')}
            </DialogDescription>
          </DialogHeader>

          {isCustomerBlocked ? (
            <>
              <div className="space-y-4">
                <div>
                  <Label>{t('reminders.scheduleReminder.reminderType')}</Label>
                  <Select
                    value={reminderData.reminderType}
                    onValueChange={(value: "email" | "sms" | "push") => {
                      setReminderData((prev) => ({ ...prev, reminderType: value }));
                      if (value === 'email' && appointmentData.customerId) {
                        const customer = customers.find(c => c.id === appointmentData.customerId);
                        runEmailValidation(customer?.email);
                      } else {
                        runEmailValidation(null);
                      }
                    }}
                  >
                    <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">{t('reminders.scheduleReminder.email')}</SelectItem>
                      <SelectItem value="sms" disabled>{t('reminders.scheduleReminder.sms')}</SelectItem>
                      <SelectItem value="push" disabled>{t('reminders.scheduleReminder.push')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium text-amber-800 dark:text-amber-400">
                        {t('reminders.emailUnavailable.title')}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-500">
                        {t('reminders.emailUnavailable.reason', {
                          reason: selectedCustomer?.status === 'unsubscribed'
                            ? t('reminders.emailUnavailable.unsubscribed')
                            : t('reminders.emailUnavailable.bounced')
                        })}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-600 mt-2">
                        {t('reminders.emailUnavailable.resolution')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setReminderModalOpen(false);
                  setReminderEnabled(false);
                }}>
                  {t('reminders.appointments.cancel')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label>{t('reminders.scheduleReminder.reminderType')}</Label>
                  <Select
                    value={reminderData.reminderType}
                    onValueChange={(value: "email" | "sms" | "push") => {
                      setReminderData((prev) => ({ ...prev, reminderType: value }));
                      if (value === 'email' && appointmentData.customerId) {
                        const customer = customers.find(c => c.id === appointmentData.customerId);
                        runEmailValidation(customer?.email);
                      } else {
                        runEmailValidation(null);
                      }
                    }}
                  >
                    <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
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
                    value={reminderData.reminderTiming}
                    onValueChange={(value: 'now' | '5m' | '30m' | '1h' | '5h' | '10h' | 'custom') =>
                      setReminderData(prev => ({ ...prev, reminderTiming: value }))
                    }
                  >
                    <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">{t('reminders.scheduleReminder.sendNow')}</SelectItem>
                      <SelectItem value="5m">{t('reminders.scheduleReminder.5mBefore')}</SelectItem>
                      <SelectItem value="30m">{t('reminders.scheduleReminder.30mBefore')}</SelectItem>
                      <SelectItem value="1h">{t('reminders.scheduleReminder.1hBefore')}</SelectItem>
                      <SelectItem value="5h">{t('reminders.scheduleReminder.5hBefore')}</SelectItem>
                      <SelectItem value="10h">{t('reminders.scheduleReminder.10hBefore')}</SelectItem>
                      <SelectItem value="custom">{t('reminders.scheduleReminder.customTime')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reminderData.reminderTiming === 'custom' && (
                  <div>
                    <Label className={errors.customMinutesBefore ? "text-red-500" : ""}>
                      {t('reminders.scheduleReminder.customMinutesLabel')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="10080"
                      placeholder={t('reminders.scheduleReminder.customMinutesPlaceholder')}
                      value={reminderData.customMinutesBefore || ''}
                      onChange={(e) => {
                        setReminderData(prev => ({
                          ...prev,
                          customMinutesBefore: e.target.value ? parseInt(e.target.value) : undefined
                        }));
                        setErrors(prev => ({ ...prev, customMinutesBefore: false }));
                      }}
                      className={`focus-visible:ring-0 ${errors.customMinutesBefore ? 'border-red-500' : ''}`}
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('reminders.scheduleReminder.customMinutesHelp')}</p>
                  </div>
                )}

                <div>
                  <Label>Timezone</Label>
                  <Select
                    value={reminderData.timezone}
                    onValueChange={(value) => setReminderData(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
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
                    value={reminderData.content}
                    onChange={(e) => setReminderData(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    className="focus-visible:ring-0"
                  />
                </div>

                {reminderValidationError && reminderData.reminderType === 'email' && (
                  <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{reminderValidationError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setReminderModalOpen(false);
                  setReminderEnabled(false);
                }}>
                  {t('reminders.appointments.cancel')}
                </Button>
                <Button
                  onClick={() => setReminderModalOpen(false)}
                  disabled={!!reminderValidationError && reminderData.reminderType === 'email'}
                >
                  {t('common.save')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DialogContent>
  </Dialog>
);
}

export default AppointmentFormDialog;
