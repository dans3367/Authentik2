import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useAppSelector } from "@/store";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Bell,
  Mail,
  AlertTriangle,
  Send,
  CalendarPlus,
  LayoutDashboard,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityTab, AppointmentSettingsTab } from "@/components/availability";

// Import extracted components
import {
  DeleteConfirmDialog,
  AppointmentEditDialog,
  AppointmentDetailsContainer,
  CreateAppointmentDialog,
  AppointmentsWeekBoard,
  TabHeaderCard,
} from "@/components/appointments";
import type { EditReminderData } from "@/components/appointments";
import type { NewAppointmentData } from "@/components/appointments";

// Import extracted utilities
import {
  formatDateTime,
  isAppointmentOverlapError,
  TIMING_MAP,
  type AppointmentOverlapConflict,
  type Appointment,
  type AppointmentWithCustomer,
  type Customer,
  type AppointmentReminder,
} from "@/utils/appointment-utils";

export default function RemindersPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useReduxAuth();
  const userTimezone = user?.timezone || 'America/Chicago';
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const { providers } = useAssignableUsers();

  const [activeTab, setActiveTab] = useState<"appointments" | "availability" | "settings">("appointments");

  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('reminders.pageTitle'), icon: Bell }
  ]);

  // Modal state
  const [newAppointmentModalOpen, setNewAppointmentModalOpen] = useState(false);
  const [newAppointmentDefaults, setNewAppointmentDefaults] = useState<Partial<NewAppointmentData> | undefined>(undefined);
  const [newAppointmentSeedCustomer, setNewAppointmentSeedCustomer] = useState<AppointmentWithCustomer['customer']>(undefined);
  const [editAppointmentModalOpen, setEditAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [viewAppointmentPanelOpen, setViewAppointmentPanelOpen] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string>("");
  const [cancelConfirmModalOpen, setCancelConfirmModalOpen] = useState(false);

  // Email dialog state (edit-flow thank-you only; view-flow dialogs live in AppointmentDetailsContainer)
  const [thankYouEmailDialogOpen, setThankYouEmailDialogOpen] = useState(false);
  const [pendingEditCompleted, setPendingEditCompleted] = useState<{
    appointment: AppointmentWithCustomer;
    reminderEnabled: boolean;
    reminderData: EditReminderData;
  } | null>(null);
  const [overbookConfirmOpen, setOverbookConfirmOpen] = useState(false);
  const [pendingOverbookUpdate, setPendingOverbookUpdate] = useState<{
    appointment: AppointmentWithCustomer;
    reminderEnabled: boolean;
    reminderData: EditReminderData;
    sendThankYouEmail: boolean;
    conflicts: AppointmentOverlapConflict[];
  } | null>(null);

  // Cleanup old query cache on mount
  useEffect(() => {
    const queryCache = queryClient.getQueryCache();
    queryCache.getAll().forEach(query => {
      if (
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === '/api/appointments' &&
        query.queryKey.some(key => typeof key === 'object' && key && 'showArchived' in key)
      ) {
        queryCache.remove(query);
      }
    });
  }, []);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const {
    data: appointmentsData,
    refetch: refetchAppointments
  } = useQuery<{ appointments: AppointmentWithCustomer[] }>({
    queryKey: ['/api/appointments', { shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/appointments${selectedShopId ? `?shopId=${selectedShopId}` : ''}`
      );
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: customersData } = useQuery<{ contacts: Customer[] }>({
    queryKey: ['/api/email-contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-contacts');
      return response.json();
    },
  });

  const {
    data: remindersData,
    refetch: refetchReminders
  } = useQuery<{ reminders: AppointmentReminder[] }>({
    queryKey: ['/api/appointment-reminders'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/appointment-reminders');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Derived data
  const allAppointments: AppointmentWithCustomer[] = appointmentsData?.appointments || [];
  const customers: Customer[] = customersData?.contacts || [];
  const reminders: AppointmentReminder[] = remindersData?.reminders || [];

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const response = await apiRequest('PUT', `/api/appointment-reminders/${reminderId}/status`, { status: 'cancelled' });
      return response.json();
    },
    onSuccess: () => { refetchReminders(); },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to delete reminder', variant: 'destructive' });
    }
  });

  const createScheduledReminderMutation = useMutation({
    mutationFn: async ({ appointmentId, data }: { appointmentId: string; data: { reminderType: string; reminderTiming: string; customMinutesBefore?: number; scheduledFor: Date; timezone?: string; content?: string } }) => {
      const response = await apiRequest('POST', '/api/appointment-reminders', {
        appointmentId,
        reminderType: data.reminderType,
        reminderTiming: data.reminderTiming,
        customMinutesBefore: data.customMinutesBefore,
        scheduledFor: data.scheduledFor,
        timezone: data.timezone || 'America/Chicago',
        content: data.content,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.reminderScheduled') });
      try { await refetchReminders(); } catch {}
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/appointments' });
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.reminderScheduleError'), variant: 'destructive' });
    }
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> & { forceOverbook?: boolean } }) => {
      const response = await apiRequest('PATCH', `/api/appointments/${id}`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.appointmentUpdated') });
      if (data?.appointment) {
        queryClient.setQueryData(
          ['/api/appointments'],
          (old: { appointments: AppointmentWithCustomer[] } | undefined) => {
            if (!old?.appointments) return old;
            return { ...old, appointments: old.appointments.map(apt => apt.id === data.appointment.id ? { ...apt, ...data.appointment } : apt) };
          }
        );
      }
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/appointments' });
      refetchAppointments();
      setEditAppointmentModalOpen(false);
      setEditingAppointment(null);
    },
    onError: (error: any) => {
      if (isAppointmentOverlapError(error)) {
        return;
      }
      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.appointmentUpdateError'), variant: "destructive" });
    },
  });

  const sendThankYouEmailMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest("POST", `/api/appointments/${appointmentId}/send-thank-you-email`);
      return response.json();
    },
    onSuccess: () => { toast({ title: "Email Sent", description: "Thank-you email sent to customer" }); },
    onError: (error: any) => { toast({ title: t("reminders.toasts.error"), description: error.message || "Failed to send thank-you email", variant: "destructive" }); },
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest('DELETE', `/api/appointments/${appointmentId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Appointment deleted successfully' });
      refetchAppointments();
      refetchReminders();
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to delete appointment', variant: "destructive" });
    },
  });

  // ─── Validation ────────────────────────────────────────────────────────────

  const validateEmailReminder = async (email: string): Promise<string | null> => {
    const customer = customers.find(c => c.email === email);
    if (customer && (customer.status === 'unsubscribed' || customer.status === 'bounced')) {
      return `Cannot schedule email reminder: Customer is ${customer.status}`;
    }
    try {
      const response = await apiRequest('GET', `/api/suppression/check/${encodeURIComponent(email)}`);
      const data = await response.json();
      if (data.isSuppressed) {
        return `Cannot schedule email reminder: Address is in global do-not-contact list (${data.suppressionDetails?.reason || 'Suppressed'})`;
      }
      return null;
    } catch {
      return null;
    }
  };

  // ─── Event Handlers ───────────────────────────────────────────────────────

  const handleViewAppointment = (appointment: AppointmentWithCustomer) => {
    setViewingAppointment(appointment);
    setViewAppointmentPanelOpen(true);
  };

  // Open the create dialog pre-seeded to a calendar day (default 9:00 AM).
  const handleAddAppointmentForDate = (date: Date) => {
    const seed = new Date(date);
    seed.setHours(9, 0, 0, 0);
    setNewAppointmentDefaults({ appointmentDate: seed });
    setNewAppointmentSeedCustomer(undefined);
    setNewAppointmentModalOpen(true);
  };

  const handleEditAppointment = (appointment: AppointmentWithCustomer) => {
    setEditingAppointment(appointment);
    setEditAppointmentModalOpen(true);
  };

  const buildAppointmentUpdatePayload = (
    appointment: AppointmentWithCustomer,
    forceOverbook = false,
  ): Partial<Appointment> & { forceOverbook?: boolean } => ({
    title: appointment.title,
    description: appointment.description,
    appointmentDate: appointment.appointmentDate,
    duration: appointment.duration,
    location: appointment.location,
    serviceType: appointment.serviceType,
    status: appointment.status,
    notes: appointment.notes,
    providerId: appointment.providerId ?? null,
    recurrenceFrequency: appointment.recurrenceFrequency ?? 'none',
    recurrenceInterval: appointment.recurrenceInterval ?? 1,
    recurrenceCount: appointment.recurrenceFrequency === 'none' ? null : appointment.recurrenceCount ?? null,
    recurrenceEndDate: appointment.recurrenceFrequency === 'none' ? null : appointment.recurrenceEndDate ?? null,
    recurrenceSeriesId: appointment.recurrenceFrequency === 'none' ? null : appointment.recurrenceSeriesId ?? null,
    recurrenceParentId: appointment.recurrenceFrequency === 'none' ? null : appointment.recurrenceParentId ?? null,
    ...(forceOverbook ? { forceOverbook: true } : {}),
  });

  const syncReminderStateForAppointment = (
    appointment: AppointmentWithCustomer,
    reminderEnabled: boolean,
    reminderData: EditReminderData,
  ) => {
    const existingReminder = reminders.find(
      (reminder) => reminder.appointmentId === appointment.id && reminder.status === 'pending'
    );

    if (reminderEnabled) {
      const appointmentDate = new Date(appointment.appointmentDate);
      const scheduledFor =
        reminderData.reminderTiming === 'custom' && reminderData.customMinutesBefore
          ? new Date(appointmentDate.getTime() - reminderData.customMinutesBefore * 60 * 1000)
          : new Date(appointmentDate.getTime() - (TIMING_MAP[reminderData.reminderTiming] || 60) * 60 * 1000);

      if (existingReminder) {
        deleteReminderMutation.mutate(existingReminder.id);
      }
      createScheduledReminderMutation.mutate({
        appointmentId: appointment.id,
        data: {
          reminderType: reminderData.reminderType,
          reminderTiming: reminderData.reminderTiming,
          customMinutesBefore: reminderData.customMinutesBefore,
          scheduledFor,
          timezone: reminderData.timezone,
          content: reminderData.content,
        },
      });
      return;
    }

    if (existingReminder) {
      deleteReminderMutation.mutate(existingReminder.id);
    }
  };

  const submitAppointmentUpdate = ({
    appointment,
    reminderEnabled,
    reminderData,
    sendThankYouEmail = false,
    forceOverbook = false,
  }: {
    appointment: AppointmentWithCustomer;
    reminderEnabled: boolean;
    reminderData: EditReminderData;
    sendThankYouEmail?: boolean;
    forceOverbook?: boolean;
  }) => {
    updateAppointmentMutation.mutate(
      {
        id: appointment.id,
        data: buildAppointmentUpdatePayload(appointment, forceOverbook),
      },
      {
        onSuccess: () => {
          syncReminderStateForAppointment(appointment, reminderEnabled, reminderData);
          if (sendThankYouEmail) {
            sendThankYouEmailMutation.mutate(appointment.id);
            setThankYouEmailDialogOpen(false);
            setPendingEditCompleted(null);
          }
          setOverbookConfirmOpen(false);
          setPendingOverbookUpdate(null);
        },
        onError: (error: any) => {
          if (isAppointmentOverlapError(error)) {
            setPendingOverbookUpdate({
              appointment,
              reminderEnabled,
              reminderData,
              sendThankYouEmail,
              conflicts: error.data.conflicts,
            });
            setOverbookConfirmOpen(true);
          }
          if (sendThankYouEmail) {
            setThankYouEmailDialogOpen(false);
            setPendingEditCompleted(null);
          }
        },
      }
    );
  };

  const handleUpdateAppointment = async (appointment: AppointmentWithCustomer, reminderEnabled: boolean, reminderData: EditReminderData) => {
    // Validate reminder timing
    if (reminderEnabled && reminderData.reminderTiming === 'custom' && !reminderData.customMinutesBefore) {
      toast({ title: t('reminders.toasts.validationError'), description: 'Please fill in all required fields', variant: "destructive" });
      return;
    }

    if (reminderEnabled) {
      const appointmentDate = new Date(appointment.appointmentDate);
      let scheduledFor: Date;
      if (reminderData.reminderTiming === 'custom' && reminderData.customMinutesBefore) {
        scheduledFor = new Date(appointmentDate.getTime() - reminderData.customMinutesBefore * 60 * 1000);
      } else {
        const minutes = TIMING_MAP[reminderData.reminderTiming] || 60;
        scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
      }
      if (scheduledFor < new Date()) {
        toast({ title: t('reminders.toasts.validationError'), description: "Reminder time cannot be in the past", variant: "destructive" });
        return;
      }
    }

    // Validate email suppression
    if (reminderEnabled && reminderData.reminderType === 'email') {
      const customer = customers.find(c => c.id === appointment.customerId) || appointment.customer;
      if (customer?.email) {
        const errorMessage = await validateEmailReminder(customer.email);
        if (errorMessage) {
          toast({ title: t('reminders.toasts.validationError'), description: errorMessage, variant: "destructive" });
          return;
        }
      }
    }

    // If status changed to completed, show thank-you email dialog first
    if (appointment.status === 'completed' && editingAppointment?.status !== 'completed') {
      setPendingEditCompleted({ appointment, reminderEnabled, reminderData });
      setThankYouEmailDialogOpen(true);
      return;
    }

    submitAppointmentUpdate({ appointment, reminderEnabled, reminderData });
  };

  const handleThankYouEmailConfirm = (sendEmail: boolean) => {
    if (!pendingEditCompleted) return;
    const { appointment, reminderEnabled, reminderData: editReminderData } = pendingEditCompleted;
    submitAppointmentUpdate({
      appointment: { ...appointment, status: 'completed' },
      reminderEnabled,
      reminderData: editReminderData,
      sendThankYouEmail: sendEmail,
    });
  };

  const confirmOverbookUpdate = () => {
    if (!pendingOverbookUpdate) return;
    submitAppointmentUpdate({
      appointment: pendingOverbookUpdate.appointment,
      reminderEnabled: pendingOverbookUpdate.reminderEnabled,
      reminderData: pendingOverbookUpdate.reminderData,
      sendThankYouEmail: pendingOverbookUpdate.sendThankYouEmail,
      forceOverbook: true,
    });
  };

  const handleCancelAppointment = (appointmentId: string) => {
    setCancelAppointmentId(appointmentId);
    setCancelConfirmModalOpen(true);
  };

  const confirmCancelAppointment = () => {
    if (!cancelAppointmentId) return;
    cancelAppointmentMutation.mutate(cancelAppointmentId);
    setCancelConfirmModalOpen(false);
    setCancelAppointmentId("");
  };

  const handleCreateNewFromPast = (appointment: AppointmentWithCustomer) => {
    setViewAppointmentPanelOpen(false);
    setNewAppointmentDefaults({
      customerId: appointment.customerId,
      providerId: appointment.providerId ?? null,
      shopId: appointment.shop?.id ?? null,
      duration: appointment.duration,
      location: appointment.location ?? "",
      serviceType: appointment.serviceType ?? "",
      status: 'scheduled',
      notes: "",
    });
    setNewAppointmentSeedCustomer(appointment.customer);
    setNewAppointmentModalOpen(true);
  };

  const primaryOverbookConflict = pendingOverbookUpdate?.conflicts[0];
  const overbookProviderName =
    primaryOverbookConflict?.providerName ||
    providers.find((provider) => provider.id === primaryOverbookConflict?.providerId)?.name ||
    providers.find((provider) => provider.id === primaryOverbookConflict?.providerId)?.email ||
    'this provider';

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "appointments" | "availability" | "settings")} className="flex flex-col gap-6">
          <TabsList className="self-end">
            <TabsTrigger value="appointments">{t('reminders.tabs.appointments')}</TabsTrigger>
            <TabsTrigger value="availability">{t('reminders.availability.tabLabel')}</TabsTrigger>
            <TabsTrigger value="settings">{t('reminders.tabs.settings')}</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="flex flex-col gap-6 mt-0">
            {/* Page header — list/scheduling functions live in the board below */}
            <TabHeaderCard
              title={t('reminders.pageTitle')}
              subtitle={t('reminders.pageSubtitle')}
              action={
                <Button
                  onClick={() => {
                    setNewAppointmentDefaults(undefined);
                    setNewAppointmentSeedCustomer(undefined);
                    setNewAppointmentModalOpen(true);
                  }}
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  {t('reminders.appointments.newAppointment')}
                </Button>
              }
            />

            {/* Week board: stats sidebar + upcoming-this-week table */}
            <AppointmentsWeekBoard
              appointments={allAppointments}
              onViewAppointment={handleViewAppointment}
              onAddAppointment={handleAddAppointmentForDate}
            />
          </TabsContent>

          <TabsContent value="availability" className="flex flex-col gap-6 mt-0">
            <AvailabilityTab />
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col gap-6 mt-0">
            <TabHeaderCard
              title={t('reminders.tabs.settings')}
              subtitle={t('reminders.settings.pageSubtitle')}
            />
            <AppointmentSettingsTab />
          </TabsContent>
        </Tabs>

        {/* ─── Dialogs & Sheets (Extracted Components) ───────────────────── */}

        {/* Create Appointment Dialog (also used for "Create New" from past appointments) */}
        <CreateAppointmentDialog
          open={newAppointmentModalOpen}
          onOpenChange={(open) => {
            setNewAppointmentModalOpen(open);
            if (!open) {
              setNewAppointmentDefaults(undefined);
              setNewAppointmentSeedCustomer(undefined);
            }
          }}
          defaults={newAppointmentDefaults}
          seedCustomer={newAppointmentSeedCustomer}
          onCreated={() => { refetchAppointments(); }}
          hideTrigger
        />

        {/* Edit Appointment Dialog */}
        <AppointmentEditDialog
          open={editAppointmentModalOpen}
          onOpenChange={setEditAppointmentModalOpen}
          appointment={editingAppointment}
          customers={customers}
          providers={providers}
          reminders={reminders}
          userTimezone={userTimezone}
          onSubmit={handleUpdateAppointment}
          isSubmitting={updateAppointmentMutation.isPending}
          validateEmailReminder={validateEmailReminder}
        />

        {/* Delete Confirmation */}
        <DeleteConfirmDialog
          open={cancelConfirmModalOpen}
          onOpenChange={setCancelConfirmModalOpen}
          appointment={allAppointments.find(apt => apt.id === cancelAppointmentId) || null}
          onConfirm={confirmCancelAppointment}
          isDeleting={cancelAppointmentMutation.isPending}
        />

        {/* View Appointment Details */}
        <AppointmentDetailsContainer
          appointment={viewingAppointment}
          open={viewAppointmentPanelOpen}
          onOpenChange={setViewAppointmentPanelOpen}
          onEdit={(apt) => handleEditAppointment(apt)}
          onCreateNewAppointment={handleCreateNewFromPast}
          onAppointmentChange={(apt) => setViewingAppointment(apt)}
        />

        {/* Thank-You Email Confirmation (edit-flow) */}
        <AlertDialog open={thankYouEmailDialogOpen} onOpenChange={setThankYouEmailDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-500" />Send Thank-You Email?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Would you like to send a thank-you email to the customer for completing their appointment?</p>
                <p className="text-sm text-muted-foreground">The email will include the appointment summary and a warm thank-you message from your business.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={() => handleThankYouEmailConfirm(false)} disabled={updateAppointmentMutation.isPending}>
                No, Just Mark Completed
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => handleThankYouEmailConfirm(true)} disabled={updateAppointmentMutation.isPending || sendThankYouEmailMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                <Send className="h-4 w-4 mr-2" />Yes, Send Thank-You
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={overbookConfirmOpen}
          onOpenChange={(open) => {
            setOverbookConfirmOpen(open);
            if (!open) {
              setPendingOverbookUpdate(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Overbook appointment?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>{overbookProviderName} already has an appointment during this time.</p>
                {primaryOverbookConflict && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Existing appointment: <span className="font-medium text-foreground">{primaryOverbookConflict.conflictingTitle}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {primaryOverbookConflict.conflictingCustomerName} · {formatDateTime(primaryOverbookConflict.conflictingStart)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New appointment: <span className="font-medium text-foreground">{pendingOverbookUpdate?.appointment.title}</span> · {formatDateTime(primaryOverbookConflict.requestedStart)}
                    </p>
                  </>
                )}
                {pendingOverbookUpdate && pendingOverbookUpdate.conflicts.length > 1 && (
                  <p className="text-sm text-muted-foreground">
                    {pendingOverbookUpdate.conflicts.length - 1} more overlap
                    {pendingOverbookUpdate.conflicts.length > 2 ? 's' : ''} detected.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel disabled={updateAppointmentMutation.isPending}>
                Keep Editing
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  onClick={(event) => {
                    event.preventDefault();
                    confirmOverbookUpdate();
                  }}
                  disabled={updateAppointmentMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {updateAppointmentMutation.isPending ? 'Saving...' : 'Overbook Appointment'}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}
