import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import type { Appointment, AppointmentReminder } from "@shared/schema";
import type { AppointmentWithCustomer, Customer } from "./useAppointments";

// Reminder data types
export interface ReminderData {
  reminderType: 'email' | 'sms' | 'push';
  reminderTiming: 'now' | '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
  customMinutesBefore?: number;
  scheduledFor: Date;
  timezone?: string;
  content?: string;
}

export interface CreateAppointmentParams {
  appointmentData: {
    customerId: string;
    title: string;
    description?: string;
    appointmentDate: Date;
    duration: number;
    location?: string;
    serviceType?: string;
    status?: Appointment['status'];
    notes?: string;
  };
  createReminder: boolean;
  reminderSettings: ReminderData;
}

// Hook for creating appointments with optimistic updates
export function useCreateAppointment(
  customers: Customer[],
  isMountedRef: React.MutableRefObject<boolean>,
  setPendingAppointmentIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  createScheduledReminderMutation: ReturnType<typeof useCreateScheduledReminder>
) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (params: CreateAppointmentParams) => {
      const response = await apiRequest('POST', '/api/appointments', params.appointmentData);
      return response.json();
    },
    onMutate: async (params: CreateAppointmentParams) => {
      const { appointmentData } = params;

      // Validate customer exists before proceeding with optimistic update
      const selectedCustomer = customers.find(c => c.id === appointmentData.customerId);
      if (!selectedCustomer) {
        throw new Error('Selected customer not found. Please select a valid customer.');
      }

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/appointments'] });

      // Snapshot previous values
      const previousAppointments = queryClient.getQueryData<{ appointments: AppointmentWithCustomer[] }>(['/api/appointments']);

      // Create optimistic appointment with temporary ID
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const optimisticAppointment: AppointmentWithCustomer = {
        id: tempId,
        tenantId: '',
        userId: '',
        customerId: appointmentData.customerId,
        title: appointmentData.title,
        description: appointmentData.description || null,
        appointmentDate: new Date(appointmentData.appointmentDate),
        duration: appointmentData.duration,
        location: appointmentData.location || null,
        serviceType: appointmentData.serviceType || null,
        status: appointmentData.status || 'scheduled',
        notes: appointmentData.notes || null,
        reminderSent: false,
        reminderSentAt: null,
        confirmationReceived: false,
        confirmationReceivedAt: null,
        confirmationToken: null,
        reminderSettings: null,
        customer: selectedCustomer,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to pending set for loading indicator
      if (isMountedRef.current) {
        setPendingAppointmentIds(prev => new Set(prev).add(tempId));
      }

      // Optimistically update cache
      queryClient.setQueryData<{ appointments: AppointmentWithCustomer[] }>(
        ['/api/appointments'],
        (old) => ({
          appointments: old?.appointments ? [optimisticAppointment, ...old.appointments] : [optimisticAppointment],
        })
      );

      return { previousAppointments, tempId };
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: t('reminders.toasts.success'),
        description: t('reminders.toasts.appointmentCreated'),
      });

      // Remove temp ID from pending and add real ID briefly for smooth transition
      if (context?.tempId && isMountedRef.current) {
        setPendingAppointmentIds(prev => {
          const next = new Set(prev);
          next.delete(context.tempId);
          return next;
        });
      }

      // Replace optimistic appointment with real data from server
      if (data?.appointment) {
        const realAppointment = data.appointment;

        // Update cache with real appointment data (replace temp with real)
        queryClient.setQueryData<{ appointments: AppointmentWithCustomer[] }>(
          ['/api/appointments'],
          (old) => {
            if (!old?.appointments) return old;
            return {
              appointments: old.appointments.map(apt =>
                apt.id === context?.tempId ? { ...realAppointment, customer: realAppointment.customer || apt.customer } : apt
              ),
            };
          }
        );
      } else {
        // Fallback: invalidate to get fresh data if server response format is unexpected
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === '/api/appointments'
        });
      }

      // Schedule reminder if enabled (use captured settings from variables)
      if (variables.createReminder && data.appointment) {
        const appointmentDate = new Date(data.appointment.appointmentDate);
        const reminderSettings = variables.reminderSettings;
        let scheduledFor: Date;

        if (reminderSettings.reminderTiming === 'now') {
          scheduledFor = new Date();
        } else if (reminderSettings.reminderTiming === 'custom' && reminderSettings.customMinutesBefore) {
          scheduledFor = new Date(appointmentDate.getTime() - reminderSettings.customMinutesBefore * 60 * 1000);
        } else {
          const timingMap: Record<string, number> = {
            '5m': 5,
            '30m': 30,
            '1h': 60,
            '5h': 300,
            '10h': 600,
          };
          const minutes = timingMap[reminderSettings.reminderTiming] || 60;
          scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
        }

        // Create reminder in background (modal already closed)
        createScheduledReminderMutation.mutate({
          appointmentId: data.appointment.id,
          data: {
            reminderType: reminderSettings.reminderType,
            reminderTiming: reminderSettings.reminderTiming,
            customMinutesBefore: reminderSettings.customMinutesBefore,
            scheduledFor,
            timezone: reminderSettings.timezone,
            content: reminderSettings.content,
          },
        });
      }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousAppointments) {
        queryClient.setQueryData(['/api/appointments'], context.previousAppointments);
      }
      // Remove temp ID from pending
      if (context?.tempId && isMountedRef.current) {
        setPendingAppointmentIds(prev => {
          const next = new Set(prev);
          next.delete(context.tempId);
          return next;
        });
      }

      // Provide specific error messages for different types of failures
      let errorDescription = error?.message || t('reminders.toasts.appointmentCreateError');

      if (errorDescription.includes('Customer not found') || errorDescription.includes('Selected customer not found')) {
        errorDescription = 'Please select a valid customer from the list and try again.';
      } else if (errorDescription.includes('does not belong to your organization')) {
        errorDescription = 'The selected customer is not available in your organization.';
      } else if (errorDescription.includes('Validation failed')) {
        errorDescription = 'Please check all required fields and try again.';
      }

      toast({
        title: t('reminders.toasts.error'),
        description: errorDescription,
        variant: "destructive",
      });
    },
  });
}

// Hook for updating appointments
export function useUpdateAppointment(refetchAppointments: () => void) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
      const response = await apiRequest('PATCH', `/api/appointments/${id}`, data);
      return response.json();
    },
    onSuccess: (data: { appointment?: AppointmentWithCustomer }) => {
      toast({
        title: t('reminders.toasts.success'),
        description: t('reminders.toasts.appointmentUpdated'),
      });

      if (data?.appointment) {
        queryClient.setQueryData(
          ['/api/appointments'],
          (old: { appointments: AppointmentWithCustomer[] } | undefined) => {
            if (!old?.appointments) return old;
            return {
              ...old,
              appointments: old.appointments.map((apt) =>
                apt.id === data.appointment!.id ? { ...apt, ...data.appointment } : apt
              ),
            };
          }
        );
      }

      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === '/api/appointments'
      });
      refetchAppointments();
    },
    onError: (error: Error) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || t('reminders.toasts.appointmentUpdateError'),
        variant: "destructive",
      });
    },
  });
}

// Hook for deleting/canceling appointments
export function useDeleteAppointment(
  refetchAppointments: () => void,
  refetchReminders: () => void
) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest('DELETE', `/api/appointments/${appointmentId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('reminders.toasts.success'),
        description: 'Appointment deleted successfully',
      });
      refetchAppointments();
      refetchReminders();
    },
    onError: (error: Error) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || 'Failed to delete appointment',
        variant: "destructive",
      });
    },
  });
}

// Hook for confirming appointments
export function useConfirmAppointment(refetchAppointments: () => void) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest('PATCH', `/api/appointments/${appointmentId}`, {
        status: 'confirmed',
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('reminders.toasts.success'),
        description: 'Appointment confirmed successfully',
      });
      refetchAppointments();
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === '/api/appointments'
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || 'Failed to confirm appointment',
        variant: "destructive",
      });
    },
  });
}

// Hook for creating scheduled reminders
export function useCreateScheduledReminder(
  isMountedRef: React.MutableRefObject<boolean>,
  setPendingReminderAppointmentIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  refetchReminders: () => void
) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ appointmentId, data }: { appointmentId: string; data: ReminderData }) => {
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
    onMutate: async (variables) => {
      // Add to pending reminders set before the API call
      if (isMountedRef.current) {
        setPendingReminderAppointmentIds(prev => new Set(prev).add(variables.appointmentId));
      }
    },
    onSuccess: async (_data, variables) => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.reminderScheduled') });

      // Refetch reminders with error handling
      try {
        await refetchReminders();
      } catch (error) {
        console.error('Failed to refetch reminders:', error);
      }

      // Invalidate appointments queries to refresh the list with updated reminder status
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === '/api/appointments'
      });

      // Remove from pending reminders set (this will always execute even if refetch fails)
      if (isMountedRef.current) {
        setPendingReminderAppointmentIds(prev => {
          const next = new Set(prev);
          next.delete(variables.appointmentId);
          return next;
        });
      }
    },
    onError: (error: Error, variables) => {
      // Remove from pending reminders set on error
      if (isMountedRef.current) {
        setPendingReminderAppointmentIds(prev => {
          const next = new Set(prev);
          next.delete(variables.appointmentId);
          return next;
        });
      }

      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.reminderScheduleError'), variant: 'destructive' });
    }
  });
}

// Hook for deleting/canceling reminders
export function useDeleteReminder(refetchReminders: () => void) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const response = await apiRequest('PUT', `/api/appointment-reminders/${reminderId}/status`, {
        status: 'cancelled',
      });
      return response.json();
    },
    onSuccess: () => {
      refetchReminders();
    },
    onError: (error: Error) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to delete reminder', variant: 'destructive' });
    }
  });
}

// Hook for sending reminders immediately
export function useSendReminder(
  refetchAppointments: () => void,
  refetchReminders: () => void
) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ appointmentIds, reminderType = 'email' }: { appointmentIds: string[]; reminderType?: string }) => {
      const response = await apiRequest('POST', '/api/appointment-reminders/send', {
        appointmentIds,
        reminderType,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: t('reminders.toasts.success'),
        description: t('reminders.toasts.remindersSent', { count: variables.appointmentIds.length }),
      });
      refetchAppointments();
      refetchReminders();
    },
    onError: (error: Error) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || t('reminders.toasts.remindersSendError'),
        variant: "destructive",
      });
    },
  });
}

// Hook for sending reschedule email
export function useSendRescheduleEmail() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest("POST", `/api/appointments/${appointmentId}/send-reschedule-email`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Reschedule invitation email sent to customer",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error.message || "Failed to send reschedule email",
        variant: "destructive",
      });
    },
  });
}

// Hook for creating appointment notes
export function useCreateNote(refetchNotes: () => void) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ appointmentId, content }: { appointmentId: string; content: string }) => {
      const response = await apiRequest('POST', '/api/appointment-notes', {
        appointmentId,
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Note added successfully' });
      refetchNotes();
    },
    onError: (error: Error) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to add note', variant: 'destructive' });
    }
  });
}

// Hook for updating appointment notes
export function useUpdateNote(refetchNotes: () => void) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const response = await apiRequest('PATCH', `/api/appointment-notes/${noteId}`, {
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Note updated successfully' });
      refetchNotes();
    },
    onError: (error: Error) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to update note', variant: 'destructive' });
    }
  });
}

// Hook for deleting appointment notes
export function useDeleteNote(refetchNotes: () => void) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest('DELETE', `/api/appointment-notes/${noteId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Note deleted successfully' });
      refetchNotes();
    },
    onError: (error: Error) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to delete note', variant: 'destructive' });
    }
  });
}

// Utility function to validate email reminder suppression
export async function validateEmailReminder(
  email: string,
  customers: Customer[]
): Promise<string | null> {
  // Check local status first if customer exists in the list
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
  } catch (error) {
    console.error("Failed to validate email suppression", error);
    return null;
  }
}
