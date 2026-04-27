import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useAppSelector } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AppointmentFormDialog,
  type NewAppointmentData,
  type ReminderData,
} from "./AppointmentFormDialog";
import {
  TIMING_MAP,
  formatDateTime,
  getCustomerName,
  isAppointmentOverlapError,
  type AppointmentOverlapConflict,
  type Appointment,
  type AppointmentWithCustomer,
  type Customer,
} from "@/utils/appointment-utils";

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOptimisticAdd?: (tempId: string) => void;
  onOptimisticResolve?: (tempId: string) => void;
  onCreated?: (appointment: AppointmentWithCustomer) => void;
  hideTrigger?: boolean;
  defaults?: Partial<NewAppointmentData>;
  seedCustomer?: Customer | null;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  onOptimisticAdd,
  onOptimisticResolve,
  onCreated,
  hideTrigger = false,
  defaults,
  seedCustomer,
}: CreateAppointmentDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useReduxAuth();
  const userTimezone = user?.timezone || "America/Chicago";
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const [pastDateConfirmOpen, setPastDateConfirmOpen] = useState(false);
  const pendingCreateRef = useRef<{
    data: NewAppointmentData;
    reminderEnabled: boolean;
    reminderData: ReminderData;
  } | null>(null);
  const [overbookConfirmOpen, setOverbookConfirmOpen] = useState(false);
  const pendingOverbookRef = useRef<{
    appointmentData: Record<string, unknown>;
    createReminder: boolean;
    reminderSettings: ReminderData;
    overrideShopId?: string | null;
    conflicts: AppointmentOverlapConflict[];
  } | null>(null);

  const { data: customersData } = useQuery<{ contacts: Customer[] }>({
    queryKey: ["/api/email-contacts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/email-contacts");
      return response.json();
    },
  });
  const customers: Customer[] = customersData?.contacts || [];
  const { providers } = useAssignableUsers();

  // "All Shops" mode (selectedShopId === null) requires the user to pick a shop
  // at create time. Otherwise the x-shop-id header from the global selector
  // already scopes the POST.
  const requireShopSelection = !selectedShopId;
  const { data: shopsData } = useQuery<{ shops: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops?limit=100");
      return response.json();
    },
    enabled: requireShopSelection && open,
    staleTime: 5 * 60 * 1000,
  });
  const shops = shopsData?.shops ?? [];

  const createScheduledReminderMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      data,
    }: {
      appointmentId: string;
      data: {
        reminderType: string;
        reminderTiming: string;
        customMinutesBefore?: number;
        scheduledFor: Date;
        timezone?: string;
        content?: string;
      };
    }) => {
      const response = await apiRequest("POST", "/api/appointment-reminders", {
        appointmentId,
        reminderType: data.reminderType,
        reminderTiming: data.reminderTiming,
        customMinutesBefore: data.customMinutesBefore,
        scheduledFor: data.scheduledFor,
        timezone: data.timezone || "America/Chicago",
        content: data.content,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "/api/appointment-reminders",
      });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "/api/appointments",
      });
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || t("reminders.toasts.reminderScheduleError"),
        variant: "destructive",
      });
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (params: {
      appointmentData: any;
      createReminder: boolean;
      reminderSettings: any;
      overrideShopId?: string | null;
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/appointments",
        params.appointmentData,
        params.overrideShopId
          ? { headers: { "x-shop-id": params.overrideShopId } }
          : undefined,
      );
      return response.json();
    },
    onMutate: async (params) => {
      const { appointmentData } = params;
      const selectedCustomer = customers.find((c) => c.id === appointmentData.customerId);
      if (!selectedCustomer) throw new Error("Selected customer not found.");

      // Optimistic cache uses the effective shopId (either the globally
      // selected shop, or the shop picked in the dialog when in "All" mode).
      const effectiveShopId = params.overrideShopId ?? selectedShopId;

      await queryClient.cancelQueries({
        queryKey: ["/api/appointments", { shopId: effectiveShopId }],
      });
      const previousAppointments = queryClient.getQueryData<{
        appointments: Appointment[];
      }>(["/api/appointments", { shopId: effectiveShopId }]);

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const selectedProvider = appointmentData.providerId
        ? providers.find((p) => p.id === appointmentData.providerId) ?? null
        : null;
      const optimisticAppointment: AppointmentWithCustomer = {
        id: tempId,
        customerId: appointmentData.customerId,
        providerId: appointmentData.providerId ?? null,
        title: appointmentData.title,
        description: appointmentData.description,
        appointmentDate: new Date(appointmentData.appointmentDate),
        duration: appointmentData.duration,
        location: appointmentData.location,
        serviceType: appointmentData.serviceType,
        status: appointmentData.status || "scheduled",
        notes: appointmentData.notes,
        recurrenceFrequency: appointmentData.recurrenceFrequency,
        recurrenceInterval: appointmentData.recurrenceInterval,
        recurrenceCount: appointmentData.recurrenceCount,
        recurrenceEndDate: appointmentData.recurrenceEndDate,
        recurrenceSeriesId: null,
        recurrenceParentId: null,
        reminderSent: false,
        confirmationReceived: false,
        customer: selectedCustomer,
        provider: selectedProvider,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      onOptimisticAdd?.(tempId);
      queryClient.setQueryData<{ appointments: AppointmentWithCustomer[] }>(
        ["/api/appointments", { shopId: effectiveShopId }],
        (old) => ({
          appointments: old?.appointments
            ? [optimisticAppointment, ...old.appointments]
            : [optimisticAppointment],
        })
      );
      return { previousAppointments, tempId, effectiveShopId };
    },
    onSuccess: (data, variables, context) => {
      pendingOverbookRef.current = null;
      setOverbookConfirmOpen(false);
      onOpenChange(false);
      toast({
        title: t("reminders.toasts.success"),
        description: t("reminders.toasts.appointmentCreated"),
      });
      if (context?.tempId) onOptimisticResolve?.(context.tempId);

      if (data?.appointment) {
        const createdAppointments = Array.isArray(data.appointments)
          ? data.appointments
          : [data.appointment];
        queryClient.setQueryData<{ appointments: AppointmentWithCustomer[] }>(
          ["/api/appointments", { shopId: context?.effectiveShopId ?? selectedShopId }],
          (old) => {
            if (!old?.appointments) return old;
            return {
              appointments: old.appointments.flatMap((apt) =>
                apt.id === context?.tempId
                  ? createdAppointments.map((created: AppointmentWithCustomer) => ({
                      ...created,
                      customer: created.customer || apt.customer,
                    }))
                  : [apt]
              ),
            };
          }
        );
        queryClient.invalidateQueries({
          predicate: (query) => {
            if (query.queryKey[0] !== "/api/appointments") return false;
            const second = query.queryKey[1];
            const isPrimaryKey =
              typeof second === "object" &&
              second !== null &&
              !Array.isArray(second);
            return !isPrimaryKey;
          },
        });
        onCreated?.(data.appointment);
      } else {
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "/api/appointments",
        });
      }

      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "/api/stats/highlights",
      });

      if (variables.createReminder && data.appointment) {
        const appointmentDate = new Date(data.appointment.appointmentDate);
        const rs = variables.reminderSettings;
        let scheduledFor: Date;
        if (rs.reminderTiming === "now") {
          scheduledFor = new Date();
        } else if (rs.reminderTiming === "custom" && rs.customMinutesBefore) {
          scheduledFor = new Date(
            appointmentDate.getTime() - rs.customMinutesBefore * 60 * 1000
          );
        } else {
          const minutes = TIMING_MAP[rs.reminderTiming] || 60;
          scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
        }
        createScheduledReminderMutation.mutate({
          appointmentId: data.appointment.id,
          data: {
            reminderType: rs.reminderType,
            reminderTiming: rs.reminderTiming,
            customMinutesBefore: rs.customMinutesBefore,
            scheduledFor,
            timezone: rs.timezone,
            content: rs.content,
          },
        });
      }
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(
          ["/api/appointments", { shopId: context.effectiveShopId ?? selectedShopId }],
          context.previousAppointments
        );
      }
      if (context?.tempId) onOptimisticResolve?.(context.tempId);
      if (isAppointmentOverlapError(error)) {
        pendingOverbookRef.current = {
          appointmentData: _variables.appointmentData,
          createReminder: _variables.createReminder,
          reminderSettings: _variables.reminderSettings,
          overrideShopId: _variables.overrideShopId ?? null,
          conflicts: error.data.conflicts,
        };
        setOverbookConfirmOpen(true);
        return;
      }
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || t("reminders.toasts.appointmentCreateError"),
        variant: "destructive",
      });
    },
  });

  const validateEmailReminder = async (email: string): Promise<string | null> => {
    const customer = customers.find((c) => c.email === email);
    if (
      customer &&
      (customer.status === "unsubscribed" || customer.status === "bounced")
    ) {
      return `Cannot schedule email reminder: Customer is ${customer.status}`;
    }
    try {
      const response = await apiRequest(
        "GET",
        `/api/suppression/check/${encodeURIComponent(email)}`
      );
      const data = await response.json();
      if (data.isSuppressed) {
        return `Cannot schedule email reminder: Address is in global do-not-contact list (${data.suppressionDetails?.reason || "Suppressed"})`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleCreateAppointment = async (
    data: NewAppointmentData,
    reminderEnabled: boolean,
    reminderData: ReminderData
  ) => {
    const selectedCustomer = customers.find((c) => c.id === data.customerId);
    if (!selectedCustomer) {
      toast({
        title: t("reminders.toasts.validationError"),
        description: "Selected customer not found.",
        variant: "destructive",
      });
      return;
    }

    if (reminderEnabled && reminderData.reminderTiming !== "now") {
      const appointmentDate = new Date(data.appointmentDate);
      let scheduledFor: Date;
      if (
        reminderData.reminderTiming === "custom" &&
        reminderData.customMinutesBefore
      ) {
        scheduledFor = new Date(
          appointmentDate.getTime() - reminderData.customMinutesBefore * 60 * 1000
        );
      } else {
        const minutes = TIMING_MAP[reminderData.reminderTiming] || 60;
        scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
      }
      if (scheduledFor < new Date()) {
        toast({
          title: t("reminders.toasts.validationError"),
          description: "Reminder time cannot be in the past",
          variant: "destructive",
        });
        return;
      }
    }

    if (reminderEnabled && reminderData.reminderType === "email") {
      const errorMessage = await validateEmailReminder(selectedCustomer.email);
      if (errorMessage) {
        toast({
          title: t("reminders.toasts.validationError"),
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }
    }

    // Strip shopId from the body payload — server picks up shop via x-shop-id
    // header (overridden below when the user picked a shop in the dialog).
    const { shopId: pickedShopId, ...appointmentPayload } = data;

    if (new Date(data.appointmentDate) < new Date()) {
      pendingCreateRef.current = { data, reminderEnabled, reminderData };
      setPastDateConfirmOpen(true);
      return;
    }

    createAppointmentMutation.mutate({
      appointmentData: appointmentPayload,
      createReminder: reminderEnabled,
      reminderSettings: reminderData,
      overrideShopId: pickedShopId ?? null,
    });
  };

  const confirmPastDateAppointment = () => {
    setPastDateConfirmOpen(false);
    if (!pendingCreateRef.current) return;
    const { data, reminderEnabled, reminderData } = pendingCreateRef.current;
    pendingCreateRef.current = null;
    const { shopId: pickedShopId, ...appointmentPayload } = data;
    createAppointmentMutation.mutate({
      appointmentData: appointmentPayload,
      createReminder: reminderEnabled,
      reminderSettings: reminderData,
      overrideShopId: pickedShopId ?? null,
    });
  };

  const confirmOverbookAppointment = () => {
    if (!pendingOverbookRef.current) return;
    const pending = pendingOverbookRef.current;
    createAppointmentMutation.mutate({
      appointmentData: {
        ...pending.appointmentData,
        forceOverbook: true,
      },
      createReminder: pending.createReminder,
      reminderSettings: pending.reminderSettings,
      overrideShopId: pending.overrideShopId ?? null,
    });
  };

  const primaryConflict = pendingOverbookRef.current?.conflicts[0];
  const providerName =
    primaryConflict?.providerName ||
    providers.find((provider) => provider.id === primaryConflict?.providerId)?.name ||
    providers.find((provider) => provider.id === primaryConflict?.providerId)?.email ||
    "this provider";
  const conflictCustomer = primaryConflict
    ? primaryConflict.conflictingCustomerName || primaryConflict.conflictingCustomerEmail || "another customer"
    : null;
  const requestedCustomer = pendingOverbookRef.current?.appointmentData.customerId
    ? customers.find((customer) => customer.id === pendingOverbookRef.current?.appointmentData.customerId)
    : null;

  return (
    <>
      <AppointmentFormDialog
        open={open}
        onOpenChange={onOpenChange}
        customers={customers}
        providers={providers}
        shops={shops}
        requireShopSelection={requireShopSelection}
        userTimezone={userTimezone}
        onSubmit={handleCreateAppointment}
        isSubmitting={createAppointmentMutation.isPending}
        validateEmailReminder={validateEmailReminder}
        hideTrigger={hideTrigger}
        defaults={defaults}
        seedCustomer={seedCustomer}
      />

      <Dialog open={pastDateConfirmOpen} onOpenChange={setPastDateConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Past Date Warning
            </DialogTitle>
            <DialogDescription>
              You are scheduling an appointment for a date in the past. Are you
              sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="font-medium">
                {pendingCreateRef.current?.data.title || "Untitled Appointment"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Scheduled for:{" "}
                {pendingCreateRef.current?.data.appointmentDate
                  ? formatDateTime(pendingCreateRef.current.data.appointmentDate)
                  : ""}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                This date is in the past
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPastDateConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmPastDateAppointment}
                disabled={createAppointmentMutation.isPending}
              >
                {createAppointmentMutation.isPending
                  ? "Creating..."
                  : "Create Anyway"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overbookConfirmOpen}
        onOpenChange={(nextOpen) => {
          setOverbookConfirmOpen(nextOpen);
          if (!nextOpen) {
            pendingOverbookRef.current = null;
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Overbook appointment?
            </DialogTitle>
            <DialogDescription>
              {providerName} already has an appointment during this time. You can still save it as an overbooked appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {primaryConflict && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    New appointment
                  </p>
                  <p className="font-medium">
                    {String(pendingOverbookRef.current?.appointmentData.title || "Untitled Appointment")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {requestedCustomer ? getCustomerName(requestedCustomer) : "Selected customer"} ·{" "}
                    {formatDateTime(primaryConflict.requestedStart)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Existing appointment
                  </p>
                  <p className="font-medium">{primaryConflict.conflictingTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {conflictCustomer} · {formatDateTime(primaryConflict.conflictingStart)}
                  </p>
                </div>
                {pendingOverbookRef.current && pendingOverbookRef.current.conflicts.length > 1 && (
                  <p className="text-sm text-muted-foreground">
                    {pendingOverbookRef.current.conflicts.length - 1} more conflict
                    {pendingOverbookRef.current.conflicts.length > 2 ? "s" : ""} found.
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOverbookConfirmOpen(false);
                  pendingOverbookRef.current = null;
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmOverbookAppointment}
                disabled={createAppointmentMutation.isPending}
              >
                {createAppointmentMutation.isPending ? "Saving..." : "Overbook Appointment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
