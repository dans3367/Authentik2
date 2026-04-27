import { useState, useEffect } from "react";
import { isPast } from "date-fns";
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { TIMEZONE_OPTIONS } from "@/utils/appointment-utils";
import type { AppointmentWithCustomer, Customer, Appointment, AppointmentReminder, AppointmentProvider } from "@/utils/appointment-utils";

const PROVIDER_UNASSIGNED = "__unassigned__";
type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
import {
  toLocalDateString,
  toLocalTimeString,
  mergeDateAndTime,
} from "@/utils/appointment-utils";

export interface EditReminderData {
  reminderType: 'email' | 'sms' | 'push';
  reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
  customMinutesBefore?: number;
  timezone: string;
  content?: string;
}

interface AppointmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithCustomer | null;
  customers: Customer[];
  providers?: AppointmentProvider[];
  reminders: AppointmentReminder[];
  userTimezone: string;
  onSubmit: (appointment: AppointmentWithCustomer, reminderEnabled: boolean, reminderData: EditReminderData) => void;
  isSubmitting: boolean;
  validateEmailReminder: (email: string) => Promise<string | null>;
}

export function AppointmentEditDialog({
  open,
  onOpenChange,
  appointment: initialAppointment,
  customers,
  providers = [],
  reminders,
  userTimezone,
  onSubmit,
  isSubmitting,
  validateEmailReminder,
}: AppointmentEditDialogProps) {
  const { t } = useTranslation();

  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderData, setReminderData] = useState<EditReminderData>({
    reminderType: 'email',
    reminderTiming: '1h',
    customMinutesBefore: undefined,
    timezone: userTimezone,
    content: '',
  });
  const [errors, setErrors] = useState<{ customMinutesBefore?: boolean }>({});
  const [reminderValidationError, setReminderValidationError] = useState<string | null>(null);
  const [reminderSaveRef, setReminderSaveRef] = useState(false);

  // Initialize form when appointment changes
  useEffect(() => {
    if (initialAppointment && open) {
      setEditingAppointment({
        ...initialAppointment,
        recurrenceFrequency: initialAppointment.recurrenceFrequency ?? 'none',
        recurrenceInterval: initialAppointment.recurrenceInterval ?? 1,
        recurrenceCount: initialAppointment.recurrenceCount ?? null,
        recurrenceEndDate: initialAppointment.recurrenceEndDate ?? null,
      });

      const existingReminder = reminders.find(
        r => r.appointmentId === initialAppointment.id && r.status === 'pending'
      );

      if (existingReminder) {
        setReminderEnabled(true);
        setReminderData({
          reminderType: existingReminder.reminderType,
          reminderTiming: existingReminder.reminderTiming,
          customMinutesBefore: existingReminder.customMinutesBefore || undefined,
          timezone: (existingReminder as any).timezone || userTimezone,
          content: existingReminder.content || '',
        });
      } else {
        setReminderEnabled(false);
        setReminderData({
          reminderType: 'email',
          reminderTiming: '1h',
          customMinutesBefore: undefined,
          timezone: userTimezone,
          content: '',
        });
      }
      setErrors({});
      setReminderModalOpen(false);
    }
  }, [initialAppointment, open, reminders, userTimezone]);

  const runEmailValidation = async (email?: string | null) => {
    if (!email) {
      setReminderValidationError(null);
      return;
    }
    const errorMessage = await validateEmailReminder(email);
    setReminderValidationError(errorMessage);
  };

  const handleSubmit = () => {
    if (!editingAppointment) return;

    const newErrors: typeof errors = {};
    if (reminderEnabled && reminderData.reminderTiming === 'custom' && !reminderData.customMinutesBefore) {
      newErrors.customMinutesBefore = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit(editingAppointment, reminderEnabled, reminderData);
  };

  if (!editingAppointment) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('reminders.appointments.editAppointment')}</DialogTitle>
          <DialogDescription>
            {t('reminders.appointments.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1">
          <div>
            <Label>{t('reminders.appointments.provider', { defaultValue: 'Provider' })}</Label>
            <Select
              value={editingAppointment.providerId ?? PROVIDER_UNASSIGNED}
              onValueChange={(value) =>
                setEditingAppointment(prev => prev ? {
                  ...prev,
                  providerId: value === PROVIDER_UNASSIGNED ? null : value,
                  provider: value === PROVIDER_UNASSIGNED
                    ? null
                    : providers.find(p => p.id === value) ?? prev.provider ?? null,
                } : null)
              }
            >
              <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
                <SelectValue placeholder={t('reminders.appointments.selectProvider', { defaultValue: 'Select a provider (optional)' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROVIDER_UNASSIGNED}>
                  {t('reminders.appointments.unassigned', { defaultValue: 'Unassigned' })}
                </SelectItem>
                {providers.map((p) => {
                  const label = p.name || p.email || p.id;
                  const suffix = [p.role, p.isActive === false ? 'inactive' : null]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      <span>{label}</span>
                      {suffix && (
                        <span className="ml-2 text-xs text-muted-foreground">({suffix})</span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('reminders.appointments.title')}</Label>
            <Input
              value={editingAppointment.title}
              onChange={(e) => setEditingAppointment(prev => prev ? { ...prev, title: e.target.value } : null)}
              placeholder={t('reminders.appointments.titlePlaceholder')}
              className="focus-visible:ring-0"
            />
          </div>

          <div>
            <Label>{t('reminders.appointments.dateTime')}</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                type="date"
                min={toLocalDateString(new Date())}
                value={toLocalDateString(new Date(editingAppointment.appointmentDate))}
                onChange={(e) => setEditingAppointment(prev => prev ? {
                  ...prev,
                  appointmentDate: mergeDateAndTime(new Date(prev.appointmentDate), e.target.value, undefined)
                } : null)}
                className="focus-visible:ring-0"
              />
              <Input
                type="time"
                value={toLocalTimeString(new Date(editingAppointment.appointmentDate))}
                onChange={(e) => setEditingAppointment(prev => prev ? {
                  ...prev,
                  appointmentDate: mergeDateAndTime(new Date(prev.appointmentDate), undefined, e.target.value)
                } : null)}
                className="focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('reminders.appointments.repeat', { defaultValue: 'Repeat' })}</Label>
              <Select
                value={(editingAppointment.recurrenceFrequency ?? 'none') as RecurrenceFrequency}
                onValueChange={(value: RecurrenceFrequency) =>
                  setEditingAppointment(prev => prev ? {
                    ...prev,
                    recurrenceFrequency: value,
                    recurrenceInterval: value === 'none' ? 1 : prev.recurrenceInterval || 1,
                    recurrenceCount: value === 'none' ? null : prev.recurrenceCount || 2,
                    recurrenceEndDate: value === 'none' ? null : prev.recurrenceEndDate ?? null,
                    recurrenceSeriesId: value === 'none' ? null : prev.recurrenceSeriesId ?? null,
                    recurrenceParentId: value === 'none' ? null : prev.recurrenceParentId ?? null,
                  } : null)
                }
              >
                <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('reminders.appointments.repeatNone', { defaultValue: 'Does not repeat' })}</SelectItem>
                  <SelectItem value="daily">{t('reminders.appointments.repeatDaily', { defaultValue: 'Daily' })}</SelectItem>
                  <SelectItem value="weekly">{t('reminders.appointments.repeatWeekly', { defaultValue: 'Weekly' })}</SelectItem>
                  <SelectItem value="monthly">{t('reminders.appointments.repeatMonthly', { defaultValue: 'Monthly' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(editingAppointment.recurrenceFrequency ?? 'none') !== 'none' && (
              <div>
                <Label>{t('reminders.appointments.repeatEvery', { defaultValue: 'Every' })}</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={editingAppointment.recurrenceInterval ?? 1}
                  onChange={(e) => setEditingAppointment(prev => prev ? {
                    ...prev,
                    recurrenceInterval: Math.max(1, parseInt(e.target.value) || 1),
                  } : null)}
                  className="focus-visible:ring-0"
                />
              </div>
            )}

            {(editingAppointment.recurrenceFrequency ?? 'none') !== 'none' && (
              <>
                <div>
                  <Label>{t('reminders.appointments.occurrences', { defaultValue: 'Occurrences' })}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={editingAppointment.recurrenceCount ?? ''}
                    onChange={(e) => setEditingAppointment(prev => prev ? {
                      ...prev,
                      recurrenceCount: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : null,
                    } : null)}
                    className="focus-visible:ring-0"
                  />
                </div>
                <div>
                  <Label>{t('reminders.appointments.endsOn', { defaultValue: 'Ends on' })}</Label>
                  <Input
                    type="date"
                    min={toLocalDateString(new Date(editingAppointment.appointmentDate))}
                    value={editingAppointment.recurrenceEndDate ? toLocalDateString(new Date(editingAppointment.recurrenceEndDate)) : ''}
                    onChange={(e) => setEditingAppointment(prev => prev ? {
                      ...prev,
                      recurrenceEndDate: e.target.value ? new Date(`${e.target.value}T23:59:59`) : null,
                    } : null)}
                    className="focus-visible:ring-0"
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <Label>{t('reminders.appointments.duration')}</Label>
            <Input
              type="number"
              value={editingAppointment.duration}
              onChange={(e) => setEditingAppointment(prev => prev ? { ...prev, duration: parseInt(e.target.value) } : null)}
              min="15"
              step="15"
              className="focus-visible:ring-0"
            />
          </div>

          <div>
            <Label>{t('reminders.appointments.location')}</Label>
            <Input
              value={editingAppointment.location || ''}
              onChange={(e) => setEditingAppointment(prev => prev ? { ...prev, location: e.target.value } : null)}
              placeholder={t('reminders.appointments.locationPlaceholder')}
              className="focus-visible:ring-0"
            />
          </div>

          <div>
            <Label>{t('reminders.appointments.status')}</Label>
            <Select
              value={editingAppointment.status}
              onValueChange={(value) => setEditingAppointment(prev => prev ? { ...prev, status: value as Appointment['status'] } : null)}
            >
              <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!isPast(new Date(editingAppointment.appointmentDate)) && (
                  <>
                    <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                    <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
                  </>
                )}
                <SelectItem value="cancelled">{t('reminders.appointments.cancelled')}</SelectItem>
                <SelectItem value="completed">{t('reminders.appointments.completed')}</SelectItem>
                <SelectItem value="no_show">{t('reminders.appointments.noShow')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('reminders.appointments.notes')}</Label>
            <Textarea
              value={editingAppointment.notes || ''}
              onChange={(e) => setEditingAppointment(prev => prev ? { ...prev, notes: e.target.value } : null)}
              placeholder={t('reminders.appointments.notesPlaceholder')}
              rows={3}
              className="focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-4 border-t">
          <div className="flex items-center gap-3">
            <Label htmlFor="edit-reminder-enabled" className="cursor-pointer">
              {t('reminders.scheduleReminder.title')}
            </Label>
            <Switch
              id="edit-reminder-enabled"
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
              {isSubmitting ? t('reminders.appointments.saving') : t('reminders.appointments.saveChanges')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Reminder Configuration Modal - separate from outer dialog to avoid nested dialog pointer-events issues */}
    <Dialog open={reminderModalOpen} onOpenChange={(modalOpen) => {
      setReminderModalOpen(modalOpen);
      if (!modalOpen) {
        if (!reminderSaveRef) {
          setReminderEnabled(false);
        }
        setReminderSaveRef(false);
        setReminderValidationError(null);
      } else {
        if (reminderData.reminderType === 'email') {
          const customer = customers.find(c => c.id === editingAppointment.customerId) || editingAppointment.customer;
          runEmailValidation(customer?.email);
        }
      }
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('reminders.scheduleReminder.title')}</DialogTitle>
          <DialogDescription>
            {t('reminders.appointments.editDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t('reminders.scheduleReminder.reminderType')}</Label>
            <Select
              value={reminderData.reminderType}
              onValueChange={(value: 'email' | 'sms' | 'push') => {
                setReminderData(prev => ({ ...prev, reminderType: value }));
                if (value === 'email') {
                  const customer = customers.find(c => c.id === editingAppointment.customerId) || editingAppointment.customer;
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
              onValueChange={(value: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom') =>
                setReminderData(prev => ({ ...prev, reminderTiming: value }))
              }
            >
              <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
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

          {reminderData.reminderTiming === 'custom' && (
            <div>
              <Label className={errors.customMinutesBefore ? "text-red-500 dark:text-red-400" : ""}>
                {t('reminders.scheduleReminder.customMinutesLabel')} <span className="text-red-500 dark:text-red-400">*</span>
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
                className={`focus-visible:ring-0 ${errors.customMinutesBefore ? 'border-red-500 dark:border-red-400' : ''}`}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('reminders.scheduleReminder.customMinutesHelp')}</p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
          <Button onClick={() => {
            setReminderSaveRef(true);
            setReminderModalOpen(false);
          }} disabled={!!reminderValidationError && reminderData.reminderType === 'email'}>
            {t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default AppointmentEditDialog;
