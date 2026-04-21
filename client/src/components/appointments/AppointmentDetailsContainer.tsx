import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Mail, Send } from "lucide-react";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import ContactViewDrawer from "@/components/ContactViewDrawer";
import { AppointmentDetailsSheet } from "./AppointmentDetailsSheet";
import type {
  Appointment,
  AppointmentReminder,
  AppointmentWithCustomer,
} from "@/utils/appointment-utils";

interface AppointmentNote {
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

interface AppointmentDetailsContainerProps {
  appointment: AppointmentWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (appointment: AppointmentWithCustomer) => void;
  onCreateNewAppointment?: (appointment: AppointmentWithCustomer) => void;
  /** Called whenever the container mutates the appointment (e.g. status change). */
  onAppointmentChange?: (appointment: AppointmentWithCustomer) => void;
}

/**
 * Self-contained wrapper around AppointmentDetailsSheet that owns all data
 * fetching, mutations, and secondary dialogs (customer profile, status-change
 * confirmations). Designed so any page can mount it without replicating logic.
 */
export function AppointmentDetailsContainer({
  appointment,
  open,
  onOpenChange,
  onEdit,
  onCreateNewAppointment,
  onAppointmentChange,
}: AppointmentDetailsContainerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const notifyChange = (next: AppointmentWithCustomer | null) => {
    if (next) onAppointmentChange?.(next);
  };

  const [viewingAppointment, setViewingAppointment] =
    useState<AppointmentWithCustomer | null>(appointment);
  const [customerProfilePanelOpen, setCustomerProfilePanelOpen] = useState(false);

  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  const [rescheduleEmailDialogOpen, setRescheduleEmailDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    appointmentId: string;
    status: Appointment["status"];
  } | null>(null);
  const [thankYouEmailDialogOpen, setThankYouEmailDialogOpen] = useState(false);
  const [pendingCompletedChange, setPendingCompletedChange] = useState<{
    appointmentId: string;
  } | null>(null);

  useEffect(() => {
    setViewingAppointment(appointment);
  }, [appointment]);

  useEffect(() => {
    if (!open) {
      setNewNoteContent("");
      setEditingNoteId(null);
      setEditingNoteContent("");
    }
  }, [open]);

  const { data: remindersData } = useQuery<{ reminders: AppointmentReminder[] }>({
    queryKey: ["/api/appointment-reminders"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/appointment-reminders");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const reminders = remindersData?.reminders || [];

  const {
    data: notesData,
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useQuery<{ notes: AppointmentNote[] }>({
    queryKey: ["/api/appointment-notes", viewingAppointment?.id],
    queryFn: async () => {
      if (!viewingAppointment?.id) return { notes: [] };
      const response = await apiRequest(
        "GET",
        `/api/appointment-notes/${viewingAppointment.id}`,
      );
      return response.json();
    },
    enabled: open && !!viewingAppointment?.id,
    staleTime: 1 * 60 * 1000,
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      content,
    }: {
      appointmentId: string;
      content: string;
    }) => {
      const response = await apiRequest("POST", "/api/appointment-notes", {
        appointmentId,
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("reminders.toasts.success"),
        description: "Note added successfully",
      });
      setNewNoteContent("");
      refetchNotes();
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || "Failed to add note",
        variant: "destructive",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({
      noteId,
      content,
    }: {
      noteId: string;
      content: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/appointment-notes/${noteId}`, {
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("reminders.toasts.success"),
        description: "Note updated successfully",
      });
      setEditingNoteId(null);
      setEditingNoteContent("");
      refetchNotes();
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || "Failed to update note",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest("DELETE", `/api/appointment-notes/${noteId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("reminders.toasts.success"),
        description: "Note deleted successfully",
      });
      refetchNotes();
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Appointment>;
    }) => {
      const response = await apiRequest("PATCH", `/api/appointments/${id}`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: t("reminders.toasts.success"),
        description: t("reminders.toasts.appointmentUpdated"),
      });
      if (data?.appointment) {
        setViewingAppointment((prev) =>
          prev ? { ...prev, ...data.appointment } : prev,
        );
      }
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "/api/appointments",
      });
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || t("reminders.toasts.appointmentUpdateError"),
        variant: "destructive",
      });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async ({
      appointmentIds,
      reminderType = "email",
    }: {
      appointmentIds: string[];
      reminderType?: string;
    }) => {
      const response = await apiRequest("POST", "/api/appointment-reminders/send", {
        appointmentIds,
        reminderType,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: t("reminders.toasts.success"),
        description: t("reminders.toasts.remindersSent", {
          count: variables.appointmentIds.length,
        }),
      });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "/api/appointments",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-reminders"] });
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || t("reminders.toasts.remindersSendError"),
        variant: "destructive",
      });
    },
  });

  const sendRescheduleEmailMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/appointments/${appointmentId}/send-reschedule-email`,
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Reschedule invitation email sent to customer",
      });
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || "Failed to send reschedule email",
        variant: "destructive",
      });
    },
  });

  const sendThankYouEmailMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/appointments/${appointmentId}/send-thank-you-email`,
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Thank-you email sent to customer",
      });
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || "Failed to send thank-you email",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (
    appointmentId: string,
    status: Appointment["status"],
  ) => {
    if (status === "cancelled" || status === "no_show") {
      setPendingStatusChange({ appointmentId, status });
      setRescheduleEmailDialogOpen(true);
      return;
    }
    if (status === "completed") {
      setPendingCompletedChange({ appointmentId });
      setThankYouEmailDialogOpen(true);
      return;
    }
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status } },
      {
        onSuccess: (data: any) => {
          setViewingAppointment((prev) => {
            if (!prev) return prev;
            const next = data?.appointment
              ? { ...prev, ...data.appointment }
              : { ...prev, status };
            notifyChange(next);
            return next;
          });
        },
      },
    );
  };

  const handleRescheduleEmailConfirm = (sendEmail: boolean) => {
    if (!pendingStatusChange) return;
    const { appointmentId, status } = pendingStatusChange;
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status } },
      {
        onSuccess: (data: any) => {
          setViewingAppointment((prev) => {
            if (!prev) return prev;
            const next = data?.appointment
              ? { ...prev, ...data.appointment }
              : { ...prev, status };
            notifyChange(next);
            return next;
          });
          if (sendEmail) sendRescheduleEmailMutation.mutate(appointmentId);
          setRescheduleEmailDialogOpen(false);
          setPendingStatusChange(null);
        },
        onError: () => {
          setRescheduleEmailDialogOpen(false);
          setPendingStatusChange(null);
        },
      },
    );
  };

  const handleThankYouEmailConfirm = (sendEmail: boolean) => {
    if (!pendingCompletedChange) return;
    const { appointmentId } = pendingCompletedChange;
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status: "completed" } },
      {
        onSuccess: (data: any) => {
          setViewingAppointment((prev) => {
            if (!prev) return prev;
            const next = data?.appointment
              ? { ...prev, ...data.appointment }
              : { ...prev, status: "completed" as const };
            notifyChange(next);
            return next;
          });
          if (sendEmail) sendThankYouEmailMutation.mutate(appointmentId);
          setThankYouEmailDialogOpen(false);
          setPendingCompletedChange(null);
        },
        onError: () => {
          setThankYouEmailDialogOpen(false);
          setPendingCompletedChange(null);
        },
      },
    );
  };

  const handleEdit = (apt: AppointmentWithCustomer) => {
    onOpenChange(false);
    if (onEdit) {
      onEdit(apt);
    } else {
      setLocation("/reminders");
    }
  };

  const handleCreateNewAppointment = (apt: AppointmentWithCustomer) => {
    onOpenChange(false);
    if (onCreateNewAppointment) {
      onCreateNewAppointment(apt);
    } else {
      setLocation("/reminders");
    }
  };

  return (
    <>
      <AppointmentDetailsSheet
        open={open}
        onOpenChange={onOpenChange}
        appointment={viewingAppointment}
        reminders={reminders}
        notes={notesData?.notes || []}
        notesLoading={notesLoading}
        onEdit={handleEdit}
        onStatusChange={handleStatusChange}
        onViewCustomerProfile={() => setCustomerProfilePanelOpen(true)}
        onCreateNewAppointment={handleCreateNewAppointment}
        onSendReminder={(id) =>
          sendReminderMutation.mutate({ appointmentIds: [id], reminderType: "email" })
        }
        isSendingReminder={sendReminderMutation.isPending}
        newNoteContent={newNoteContent}
        onNewNoteContentChange={setNewNoteContent}
        onCreateNote={() => {
          if (newNoteContent.trim() && viewingAppointment?.id) {
            createNoteMutation.mutate({
              appointmentId: viewingAppointment.id,
              content: newNoteContent.trim(),
            });
          }
        }}
        isCreatingNote={createNoteMutation.isPending}
        editingNoteId={editingNoteId}
        editingNoteContent={editingNoteContent}
        onEditNote={(noteId, content) => {
          setEditingNoteId(noteId);
          setEditingNoteContent(content);
        }}
        onUpdateNote={() => {
          if (editingNoteContent.trim() && editingNoteId) {
            updateNoteMutation.mutate({
              noteId: editingNoteId,
              content: editingNoteContent.trim(),
            });
          }
        }}
        isUpdatingNote={updateNoteMutation.isPending}
        onCancelEditNote={() => {
          setEditingNoteId(null);
          setEditingNoteContent("");
        }}
        onDeleteNote={(noteId) => deleteNoteMutation.mutate(noteId)}
        isDeletingNote={deleteNoteMutation.isPending}
      />

      <ContactViewDrawer
        contactId={viewingAppointment?.customer?.id || null}
        open={customerProfilePanelOpen}
        onOpenChange={setCustomerProfilePanelOpen}
      />

      <AlertDialog
        open={rescheduleEmailDialogOpen}
        onOpenChange={setRescheduleEmailDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-500" />
              Send Reschedule Invitation?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Would you like to send a friendly email to the customer inviting them to
                reschedule their appointment?
              </span>
              <span className="block text-sm text-muted-foreground">
                The email will include the original appointment details and encourage
                them to book a new time.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => handleRescheduleEmailConfirm(false)}
              disabled={updateAppointmentMutation.isPending}
            >
              No, Just Update Status
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleRescheduleEmailConfirm(true)}
              disabled={
                updateAppointmentMutation.isPending ||
                sendRescheduleEmailMutation.isPending
              }
              className="bg-amber-500 hover:bg-amber-600"
            >
              <Send className="h-4 w-4 mr-2" />
              Yes, Send Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={thankYouEmailDialogOpen}
        onOpenChange={setThankYouEmailDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-emerald-500" />
              Send Thank-You Email?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Would you like to send a thank-you email to the customer for completing
                their appointment?
              </span>
              <span className="block text-sm text-muted-foreground">
                The email will include the appointment summary and a warm thank-you
                message from your business.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => handleThankYouEmailConfirm(false)}
              disabled={updateAppointmentMutation.isPending}
            >
              No, Just Mark Completed
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleThankYouEmailConfirm(true)}
              disabled={
                updateAppointmentMutation.isPending ||
                sendThankYouEmailMutation.isPending
              }
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Send className="h-4 w-4 mr-2" />
              Yes, Send Thank-You
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
