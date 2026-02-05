import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  Appointment, 
  AppointmentReminder, 
  AppointmentWithCustomer, 
  Customer 
} from "@/utils/appointment-utils";

// Re-export types for convenience
export type { Appointment, AppointmentReminder, AppointmentWithCustomer, Customer };

// Appointment note type (not in utils, define locally)
export interface AppointmentNote {
  id: string;
  appointmentId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
  };
}

// Response types
export interface AppointmentsResponse {
  appointments: AppointmentWithCustomer[];
}

export interface CustomersResponse {
  contacts: Customer[];
}

export interface RemindersResponse {
  reminders: AppointmentReminder[];
}

export interface NotesResponse {
  notes: AppointmentNote[];
}

// Hook to fetch all appointments
export function useAppointments() {
  return useQuery<AppointmentsResponse>({
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/appointments');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}

// Hook to fetch customers (email contacts)
export function useCustomers() {
  return useQuery<CustomersResponse>({
    queryKey: ['/api/email-contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-contacts');
      return response.json();
    },
  });
}

// Hook to fetch appointment reminders
export function useAppointmentReminders() {
  return useQuery<RemindersResponse>({
    queryKey: ['/api/appointment-reminders'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/appointment-reminders');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Hook to fetch notes for a specific appointment
export function useAppointmentNotes(appointmentId: string | undefined) {
  return useQuery<NotesResponse>({
    queryKey: ['/api/appointment-notes', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return { notes: [] };
      const response = await apiRequest('GET', `/api/appointment-notes/${appointmentId}`);
      return response.json();
    },
    enabled: !!appointmentId,
    staleTime: 1 * 60 * 1000,
  });
}

// Hook to check email suppression status
export function useEmailSuppressionCheck(email: string | undefined) {
  return useQuery<{ isSuppressed: boolean; suppressionDetails?: { reason: string } }>({
    queryKey: ['/api/suppression/check', email],
    queryFn: async () => {
      if (!email) return { isSuppressed: false };
      const response = await apiRequest('GET', `/api/suppression/check/${encodeURIComponent(email)}`);
      return response.json();
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
  });
}
