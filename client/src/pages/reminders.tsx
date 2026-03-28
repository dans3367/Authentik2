import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useAppSelector } from "@/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Bell,
  Mail,
  Calendar,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  Search,
  Send,
  MoreVertical,
  CalendarPlus,
  AlertTriangle,
  MapPin,
  Timer,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NextUpAppointments } from "@/components/NextUpAppointments";

// Import extracted components
import {
  DeleteConfirmDialog,
  AppointmentStats,
  AppointmentFormDialog,
  AppointmentEditDialog,
  AppointmentDetailsSheet,
  ReminderScheduleDialog,
  AppointmentCard,
} from "@/components/appointments";
import type { NewAppointmentData, ReminderData } from "@/components/appointments";
import type { EditReminderData } from "@/components/appointments";
import type { ScheduleReminderData } from "@/components/appointments";

// Import extracted utilities
import {
  getCustomerName,
  getCustomerNameForSort,
  getStatusColor,
  formatDateTime,
  TIMING_MAP,
  type Appointment,
  type AppointmentWithCustomer,
  type Customer,
  type AppointmentReminder,
} from "@/utils/appointment-utils";

// Map appointment status values to translation keys
const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  scheduled: 'reminders.appointments.scheduled',
  confirmed: 'reminders.appointments.confirmed',
  cancelled: 'reminders.appointments.cancelled',
  completed: 'reminders.appointments.completed',
  no_show: 'reminders.appointments.noShow',
};

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

export default function RemindersPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useReduxAuth();
  const userTimezone = user?.timezone || 'America/Chicago';
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const [appointmentsTab, setAppointmentsTab] = useState<"upcoming" | "past">("upcoming");

  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('reminders.pageTitle'), icon: Bell }
  ]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [pastSearchQuery, setPastSearchQuery] = useState("");
  const [debouncedPastSearchQuery, setDebouncedPastSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pastStatusFilter, setPastStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [pastDateFrom, setPastDateFrom] = useState<Date | undefined>(undefined);
  const [pastDateTo, setPastDateTo] = useState<Date | undefined>(undefined);
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pastCurrentPage, setPastCurrentPage] = useState(1);
  const [pastPageSize, setPastPageSize] = useState(10);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [sortColumn, setSortColumn] = useState<'customer' | 'title' | 'date' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pastSortColumn, setPastSortColumn] = useState<'customer' | 'title' | 'date' | 'status'>('date');
  const [pastSortDirection, setPastSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [pastDateFilterOpen, setPastDateFilterOpen] = useState(false);

  // Modal state
  const [newAppointmentModalOpen, setNewAppointmentModalOpen] = useState(false);
  const [editAppointmentModalOpen, setEditAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [viewAppointmentPanelOpen, setViewAppointmentPanelOpen] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [customerProfilePanelOpen, setCustomerProfilePanelOpen] = useState(false);
  const [scheduleReminderModalOpen, setScheduleReminderModalOpen] = useState(false);
  const [scheduleReminderAppointment, setScheduleReminderAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string>("");
  const [cancelConfirmModalOpen, setCancelConfirmModalOpen] = useState(false);
  const [pastDateConfirmModalOpen, setPastDateConfirmModalOpen] = useState(false);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Email dialog state
  const [rescheduleEmailDialogOpen, setRescheduleEmailDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    appointmentId: string;
    status: Appointment['status'];
    updateLocal: boolean;
  } | null>(null);
  const [thankYouEmailDialogOpen, setThankYouEmailDialogOpen] = useState(false);
  const [pendingCompletedChange, setPendingCompletedChange] = useState<{
    appointmentId: string;
    updateLocal: boolean;
  } | null>(null);

  // Pending creation state for optimistic UI
  const [pendingAppointmentIds, setPendingAppointmentIds] = useState<Set<string>>(new Set());
  const [pendingReminderAppointmentIds, setPendingReminderAppointmentIds] = useState<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  // Temporary state for past-date appointment creation
  const pendingCreateRef = useRef<{ data: NewAppointmentData; reminderEnabled: boolean; reminderData: ReminderData } | null>(null);

  // Debounce search queries
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPastSearchQuery(pastSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [pastSearchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [debouncedSearchQuery, statusFilter, dateFrom, dateTo]);
  useEffect(() => { setPastCurrentPage(1); }, [debouncedPastSearchQuery, pastStatusFilter, pastDateFrom, pastDateTo]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setPendingAppointmentIds(new Set());
      setPendingReminderAppointmentIds(new Set());
    };
  }, []);

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
    isLoading: appointmentsLoading,
    isFetching: appointmentsFetching,
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

  const {
    data: notesData,
    isLoading: notesLoading,
    refetch: refetchNotes
  } = useQuery<{ notes: AppointmentNote[] }>({
    queryKey: ['/api/appointment-notes', viewingAppointment?.id],
    queryFn: async () => {
      if (!viewingAppointment?.id) return { notes: [] };
      const response = await apiRequest('GET', `/api/appointment-notes/${viewingAppointment.id}`);
      return response.json();
    },
    enabled: !!viewingAppointment?.id,
    staleTime: 1 * 60 * 1000,
  });

  // Derived data
  const allAppointments: AppointmentWithCustomer[] = appointmentsData?.appointments || [];
  const customers: Customer[] = customersData?.contacts || [];
  const reminders: AppointmentReminder[] = remindersData?.reminders || [];

  // ─── Filtering & Sorting ──────────────────────────────────────────────────

  const now = new Date();

  const upcomingAppointmentsAll = useMemo(() => {
    return allAppointments
      .filter(a => new Date(a.appointmentDate) >= now)
      .filter(appointment => {
        if (statusFilter !== 'all' && appointment.status !== statusFilter) return false;
        const appointmentDate = new Date(appointment.appointmentDate);
        if (dateFrom && appointmentDate < dateFrom) return false;
        if (dateTo && appointmentDate > dateTo) return false;
        if (!debouncedSearchQuery) return true;
        const searchLower = debouncedSearchQuery.toLowerCase();
        return (
          getCustomerNameForSort(appointment.customer).toLowerCase().includes(searchLower) ||
          (appointment.customer?.email || '').toLowerCase().includes(searchLower) ||
          (appointment.title || '').toLowerCase().includes(searchLower) ||
          (appointment.location || '').toLowerCase().includes(searchLower)
        );
      });
  }, [allAppointments, statusFilter, dateFrom, dateTo, debouncedSearchQuery]);

  const pastAppointmentsAll = useMemo(() => {
    return allAppointments
      .filter(a => new Date(a.appointmentDate) < now)
      .filter(appointment => {
        if (pastStatusFilter !== 'all' && appointment.status !== pastStatusFilter) return false;
        const appointmentDate = new Date(appointment.appointmentDate);
        if (pastDateFrom && appointmentDate < pastDateFrom) return false;
        if (pastDateTo && appointmentDate > pastDateTo) return false;
        if (!debouncedPastSearchQuery) return true;
        const searchLower = debouncedPastSearchQuery.toLowerCase();
        return (
          getCustomerNameForSort(appointment.customer).toLowerCase().includes(searchLower) ||
          (appointment.customer?.email || '').toLowerCase().includes(searchLower) ||
          (appointment.title || '').toLowerCase().includes(searchLower) ||
          (appointment.location || '').toLowerCase().includes(searchLower)
        );
      });
  }, [allAppointments, pastStatusFilter, pastDateFrom, pastDateTo, debouncedPastSearchQuery]);

  const sortAppointments = (list: AppointmentWithCustomer[], col: typeof sortColumn, dir: typeof sortDirection) => {
    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (col) {
        case 'customer': comparison = getCustomerNameForSort(a.customer).localeCompare(getCustomerNameForSort(b.customer)); break;
        case 'title': comparison = (a.title || '').localeCompare(b.title || ''); break;
        case 'date': comparison = new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime(); break;
        case 'status': comparison = (a.status || '').localeCompare(b.status || ''); break;
      }
      return dir === 'asc' ? comparison : -comparison;
    });
  };

  const sortedUpcoming = sortAppointments(upcomingAppointmentsAll, sortColumn, sortDirection);
  const sortedPast = sortAppointments(pastAppointmentsAll, pastSortColumn, pastSortDirection);

  // Pagination
  const totalAppointments = sortedUpcoming.length;
  const totalPages = Math.ceil(totalAppointments / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const appointments = sortedUpcoming.slice(startIndex, endIndex);

  const totalPastAppointments = sortedPast.length;
  const totalPastPages = Math.ceil(totalPastAppointments / pastPageSize);
  const pastStartIndex = (pastCurrentPage - 1) * pastPageSize;
  const pastEndIndex = pastStartIndex + pastPageSize;
  const pastAppointments = sortedPast.slice(pastStartIndex, pastEndIndex);

  // Selection helpers
  const isAllSelected = appointments.length > 0 && selectedAppointments.length === appointments.length && appointments.every(apt => selectedAppointments.includes(apt.id));

  // Upcoming appointments for sidebar (next 7 days)
  const upcomingAppointments = allAppointments.filter(apt => {
    const d = new Date(apt.appointmentDate);
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return d >= now && d <= sevenDays;
  }).slice(0, 5);

  // ─── Sort Handlers ────────────────────────────────────────────────────────

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handlePastSort = (column: typeof pastSortColumn) => {
    if (pastSortColumn === column) {
      setPastSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPastSortColumn(column);
      setPastSortDirection('asc');
    }
    setPastCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const PastSortIcon = ({ column }: { column: typeof pastSortColumn }) => {
    if (pastSortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return pastSortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

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
    onMutate: async (variables) => {
      if (isMountedRef.current) {
        setPendingReminderAppointmentIds(prev => new Set(prev).add(variables.appointmentId));
      }
    },
    onSuccess: async (_data, variables) => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.reminderScheduled') });
      setScheduleReminderModalOpen(false);
      try { await refetchReminders(); } catch {}
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/appointments' });
      if (isMountedRef.current) {
        setPendingReminderAppointmentIds(prev => { const next = new Set(prev); next.delete(variables.appointmentId); return next; });
      }
    },
    onError: (error: any, variables) => {
      if (isMountedRef.current) {
        setPendingReminderAppointmentIds(prev => { const next = new Set(prev); next.delete(variables.appointmentId); return next; });
      }
      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.reminderScheduleError'), variant: 'destructive' });
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({ appointmentId, content }: { appointmentId: string; content: string }) => {
      const response = await apiRequest('POST', '/api/appointment-notes', { appointmentId, content });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Note added successfully' });
      setNewNoteContent("");
      refetchNotes();
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to add note', variant: 'destructive' });
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const response = await apiRequest('PATCH', `/api/appointment-notes/${noteId}`, { content });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Note updated successfully' });
      setEditingNoteId(null);
      setEditingNoteContent("");
      refetchNotes();
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to update note', variant: 'destructive' });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest('DELETE', `/api/appointment-notes/${noteId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Note deleted successfully' });
      refetchNotes();
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to delete note', variant: 'destructive' });
    }
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
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
      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.appointmentUpdateError'), variant: "destructive" });
    },
  });

  const sendRescheduleEmailMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest("POST", `/api/appointments/${appointmentId}/send-reschedule-email`);
      return response.json();
    },
    onSuccess: () => { toast({ title: "Email Sent", description: "Reschedule invitation email sent to customer" }); },
    onError: (error: any) => { toast({ title: t("reminders.toasts.error"), description: error.message || "Failed to send reschedule email", variant: "destructive" }); },
  });

  const sendThankYouEmailMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest("POST", `/api/appointments/${appointmentId}/send-thank-you-email`);
      return response.json();
    },
    onSuccess: () => { toast({ title: "Email Sent", description: "Thank-you email sent to customer" }); },
    onError: (error: any) => { toast({ title: t("reminders.toasts.error"), description: error.message || "Failed to send thank-you email", variant: "destructive" }); },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (params: { appointmentData: any; createReminder: boolean; reminderSettings: any }) => {
      const response = await apiRequest('POST', '/api/appointments', params.appointmentData);
      return response.json();
    },
    onMutate: async (params) => {
      const { appointmentData } = params;
      const selectedCustomer = customers.find(c => c.id === appointmentData.customerId);
      if (!selectedCustomer) throw new Error('Selected customer not found.');

      await queryClient.cancelQueries({ queryKey: ['/api/appointments', { shopId: selectedShopId }] });
      const previousAppointments = queryClient.getQueryData<{ appointments: Appointment[] }>(['/api/appointments', { shopId: selectedShopId }]);

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const optimisticAppointment: AppointmentWithCustomer = {
        id: tempId,
        customerId: appointmentData.customerId,
        title: appointmentData.title,
        description: appointmentData.description,
        appointmentDate: new Date(appointmentData.appointmentDate),
        duration: appointmentData.duration,
        location: appointmentData.location,
        serviceType: appointmentData.serviceType,
        status: appointmentData.status || 'scheduled',
        notes: appointmentData.notes,
        reminderSent: false,
        confirmationReceived: false,
        customer: selectedCustomer,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (isMountedRef.current) setPendingAppointmentIds(prev => new Set(prev).add(tempId));
      queryClient.setQueryData<{ appointments: AppointmentWithCustomer[] }>(
        ['/api/appointments', { shopId: selectedShopId }],
        (old) => ({ appointments: old?.appointments ? [optimisticAppointment, ...old.appointments] : [optimisticAppointment] })
      );
      return { previousAppointments, tempId };
    },
    onSuccess: (data, variables, context) => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.appointmentCreated') });
      if (context?.tempId && isMountedRef.current) {
        setPendingAppointmentIds(prev => { const next = new Set(prev); next.delete(context.tempId); return next; });
      }

      if (data?.appointment) {
        queryClient.setQueryData<{ appointments: AppointmentWithCustomer[] }>(
          ['/api/appointments', { shopId: selectedShopId }],
          (old) => {
            if (!old?.appointments) return old;
            return { appointments: old.appointments.map(apt => apt.id === context?.tempId ? { ...data.appointment, customer: data.appointment.customer || apt.customer } : apt) };
          }
        );
      } else {
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/appointments' });
      }

      // Schedule reminder if enabled
      if (variables.createReminder && data.appointment) {
        const appointmentDate = new Date(data.appointment.appointmentDate);
        const rs = variables.reminderSettings;
        let scheduledFor: Date;
        if (rs.reminderTiming === 'now') {
          scheduledFor = new Date();
        } else if (rs.reminderTiming === 'custom' && rs.customMinutesBefore) {
          scheduledFor = new Date(appointmentDate.getTime() - rs.customMinutesBefore * 60 * 1000);
        } else {
          const minutes = TIMING_MAP[rs.reminderTiming] || 60;
          scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
        }
        createScheduledReminderMutation.mutate({
          appointmentId: data.appointment.id,
          data: { reminderType: rs.reminderType, reminderTiming: rs.reminderTiming, customMinutesBefore: rs.customMinutesBefore, scheduledFor, timezone: rs.timezone, content: rs.content },
        });
      }
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousAppointments) queryClient.setQueryData(['/api/appointments', { shopId: selectedShopId }], context.previousAppointments);
      if (context?.tempId && isMountedRef.current) {
        setPendingAppointmentIds(prev => { const next = new Set(prev); next.delete(context.tempId); return next; });
      }
      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.appointmentCreateError'), variant: "destructive" });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async ({ appointmentIds, reminderType = 'email' }: { appointmentIds: string[]; reminderType?: string }) => {
      const response = await apiRequest('POST', '/api/appointment-reminders/send', { appointmentIds, reminderType });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.remindersSent', { count: variables.appointmentIds.length }) });
      refetchAppointments();
      refetchReminders();
      setSelectedAppointments([]);
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.remindersSendError'), variant: "destructive" });
    },
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
      setSelectedAppointments(prev => prev.filter(id => id !== cancelAppointmentId));
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to delete appointment', variant: "destructive" });
    },
  });

  const confirmAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest('PATCH', `/api/appointments/${appointmentId}`, { status: 'confirmed' });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: 'Appointment confirmed successfully' });
      refetchAppointments();
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/appointments' });
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to confirm appointment', variant: "destructive" });
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

  const handleEditAppointment = (appointment: AppointmentWithCustomer) => {
    setEditingAppointment(appointment);
    setEditAppointmentModalOpen(true);
  };

  const handleCreateAppointment = async (data: NewAppointmentData, reminderEnabled: boolean, reminderData: ReminderData) => {
    // Validate customer exists
    const selectedCustomer = customers.find(c => c.id === data.customerId);
    if (!selectedCustomer) {
      toast({ title: t('reminders.toasts.validationError'), description: 'Selected customer not found.', variant: "destructive" });
      return;
    }

    // Validate reminder timing not in the past
    if (reminderEnabled && reminderData.reminderTiming !== 'now') {
      const appointmentDate = new Date(data.appointmentDate);
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
      const errorMessage = await validateEmailReminder(selectedCustomer.email);
      if (errorMessage) {
        toast({ title: t('reminders.toasts.validationError'), description: errorMessage, variant: "destructive" });
        return;
      }
    }

    // Check if appointment date is in the past
    if (new Date(data.appointmentDate) < new Date()) {
      pendingCreateRef.current = { data, reminderEnabled, reminderData };
      setPastDateConfirmModalOpen(true);
      return;
    }

    createAppointmentMutation.mutate({
      appointmentData: data,
      createReminder: reminderEnabled,
      reminderSettings: reminderData
    });
    setNewAppointmentModalOpen(false);
  };

  const confirmPastDateAppointment = () => {
    setPastDateConfirmModalOpen(false);
    if (!pendingCreateRef.current) return;
    const { data, reminderEnabled, reminderData } = pendingCreateRef.current;
    pendingCreateRef.current = null;
    createAppointmentMutation.mutate({
      appointmentData: data,
      createReminder: reminderEnabled,
      reminderSettings: reminderData
    });
    setNewAppointmentModalOpen(false);
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

    updateAppointmentMutation.mutate({
      id: appointment.id,
      data: {
        title: appointment.title,
        description: appointment.description,
        appointmentDate: appointment.appointmentDate,
        duration: appointment.duration,
        location: appointment.location,
        serviceType: appointment.serviceType,
        status: appointment.status,
        notes: appointment.notes,
      },
    });

    // Handle reminder
    const existingReminder = reminders.find(r => r.appointmentId === appointment.id && r.status === 'pending');
    if (reminderEnabled) {
      const appointmentDate = new Date(appointment.appointmentDate);
      let scheduledFor: Date;
      if (reminderData.reminderTiming === 'custom' && reminderData.customMinutesBefore) {
        scheduledFor = new Date(appointmentDate.getTime() - reminderData.customMinutesBefore * 60 * 1000);
      } else {
        const minutes = TIMING_MAP[reminderData.reminderTiming] || 60;
        scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
      }

      if (existingReminder) deleteReminderMutation.mutate(existingReminder.id);
      createScheduledReminderMutation.mutate({
        appointmentId: appointment.id,
        data: { reminderType: reminderData.reminderType, reminderTiming: reminderData.reminderTiming, customMinutesBefore: reminderData.customMinutesBefore, scheduledFor, timezone: reminderData.timezone, content: reminderData.content },
      });
    } else if (existingReminder) {
      deleteReminderMutation.mutate(existingReminder.id);
    }
  };

  const handleScheduleReminder = (appointmentId: string, data: ScheduleReminderData) => {
    createScheduledReminderMutation.mutate({ appointmentId, data });
  };

  const handleStatusChange = (appointmentId: string, status: Appointment['status']) => {
    if (status === 'cancelled' || status === 'no_show') {
      setPendingStatusChange({ appointmentId, status, updateLocal: true });
      setRescheduleEmailDialogOpen(true);
      return;
    }
    if (status === 'completed') {
      setPendingCompletedChange({ appointmentId, updateLocal: true });
      setThankYouEmailDialogOpen(true);
      return;
    }
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status } },
      { onSuccess: (data: any) => {
        if (data?.appointment) setViewingAppointment(prev => prev ? { ...prev, ...data.appointment } : null);
        else setViewingAppointment(prev => prev ? { ...prev, status } : null);
      }}
    );
  };

  const handleRescheduleEmailConfirm = (sendEmail: boolean) => {
    if (!pendingStatusChange) return;
    const { appointmentId, status, updateLocal } = pendingStatusChange;
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status } },
      {
        onSuccess: (data: any) => {
          if (updateLocal) {
            if (data?.appointment) setViewingAppointment(prev => prev ? { ...prev, ...data.appointment } : null);
            else setViewingAppointment(prev => prev ? { ...prev, status } : null);
          }
          if (sendEmail) sendRescheduleEmailMutation.mutate(appointmentId);
          setRescheduleEmailDialogOpen(false);
          setPendingStatusChange(null);
        }
      }
    );
  };

  const handleThankYouEmailConfirm = (sendEmail: boolean) => {
    if (!pendingCompletedChange) return;
    const { appointmentId, updateLocal } = pendingCompletedChange;
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status: 'completed' } },
      {
        onSuccess: (data: any) => {
          if (updateLocal) {
            if (data?.appointment) setViewingAppointment(prev => prev ? { ...prev, ...data.appointment } : null);
            else setViewingAppointment(prev => prev ? { ...prev, status: 'completed' } : null);
          }
          if (sendEmail) sendThankYouEmailMutation.mutate(appointmentId);
          setThankYouEmailDialogOpen(false);
          setPendingCompletedChange(null);
        },
        onError: () => {
          setThankYouEmailDialogOpen(false);
          setPendingCompletedChange(null);
        }
      }
    );
  };

  const handleSendReminders = () => {
    if (selectedAppointments.length === 0) {
      toast({ title: t('reminders.toasts.noSelection'), description: t('reminders.toasts.selectAppointments'), variant: "destructive" });
      return;
    }
    sendReminderMutation.mutate({ appointmentIds: selectedAppointments });
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

  const handleSelectAll = (checked: boolean) => {
    setSelectedAppointments(checked ? appointments.map(apt => apt.id) : []);
  };

  const handleSelectAppointment = (appointmentId: string, checked: boolean) => {
    setSelectedAppointments(prev => checked ? [...prev, appointmentId] : prev.filter(id => id !== appointmentId));
  };

  const openScheduleReminder = (appointmentId: string) => {
    const apt = allAppointments.find(a => a.id === appointmentId);
    if (apt) {
      setScheduleReminderAppointment(apt);
      setScheduleReminderModalOpen(true);
    }
  };

  const handleCreateNewFromPast = (appointment: AppointmentWithCustomer) => {
    setViewAppointmentPanelOpen(false);
    setNewAppointmentModalOpen(true);
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const renderReminderStatus = (appointment: AppointmentWithCustomer) => {
    const isPending = pendingAppointmentIds.has(appointment.id) || pendingReminderAppointmentIds.has(appointment.id);
    if (isPending) {
      return (
        <div className="flex items-center gap-1 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      );
    }
    const appointmentReminders = reminders.filter(r => r.appointmentId === appointment.id);
    const hasSent = appointmentReminders.some(r => r.status === 'sent') || appointment.reminderSent;
    const hasPending = appointmentReminders.some(r => r.status === 'pending');

    if (hasSent) return <div className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /><span className="text-sm">{t('reminders.reminderHistory.sent')}</span></div>;
    if (hasPending) return <div className="flex items-center gap-1 text-blue-600"><Clock className="h-4 w-4" /><span className="text-sm">Scheduled</span></div>;
    return <div className="flex items-center gap-1 text-gray-400"><Clock className="h-4 w-4" /><span className="text-sm">{t('reminders.reminderHistory.notSet')}</span></div>;
  };

  // ─── Date Range Filter Component ──────────────────────────────────────────

  const renderDateRangeFilter = (
    isOpen: boolean, setIsOpen: (v: boolean) => void,
    from: Date | undefined, setFrom: (v: Date | undefined) => void,
    to: Date | undefined, setTo: (v: Date | undefined) => void,
    presets: { label: string; onClick: () => void }[]
  ) => (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 ${(from || to) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
        >
          <Calendar className="h-4 w-4" />
          {(from || to) ? (
            <span className="text-sm">{from ? from.toLocaleDateString() : '...'} - {to ? to.toLocaleDateString() : '...'}</span>
          ) : (
            <span className="text-sm">{t('reminders.appointments.filterByDate')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" sideOffset={5} avoidCollisions={true}>
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b">
          {presets.map((preset, i) => (
            <Button key={i} variant="outline" size="sm" onClick={preset.onClick} className="text-xs">{preset.label}</Button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">{t('reminders.appointments.fromDate')}</Label>
            <Input
              type="date"
              value={from ? from.toISOString().split('T')[0] : ''}
              max={to ? to.toISOString().split('T')[0] : undefined}
              onChange={(e) => setFrom(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">{t('reminders.appointments.toDate')}</Label>
            <Input
              type="date"
              value={to ? to.toISOString().split('T')[0] : ''}
              min={from ? from.toISOString().split('T')[0] : undefined}
              onChange={(e) => setTo(e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined)}
              className="w-full"
            />
          </div>
        </div>
        {(from || to) && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={() => { setFrom(undefined); setTo(undefined); setIsOpen(false); }} className="w-full">
              <XCircle className="h-4 w-4 mr-2" />
              {t('reminders.appointments.clearDates')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

  // ─── Pagination Component ─────────────────────────────────────────────────

  const renderPagination = (
    total: number, totalPgs: number, start: number, end: number,
    page: number, setPage: (v: number | ((p: number) => number)) => void,
    pgSize: number, setPgSize: (v: number) => void,
  ) => {
    if (total <= 0) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Showing {start + 1}-{Math.min(end, total)} of {total}</span>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page:</span>
            <Select value={pgSize.toString()} onValueChange={(value) => { setPgSize(Number(value)); setPage(1); }}>
              <SelectTrigger className="w-[70px] h-8 focus-visible:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
          <Button variant="outline" size="sm" onClick={() => setPage((prev: number) => Math.max(1, prev - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm px-2">Page {page} of {totalPgs}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((prev: number) => Math.min(totalPgs, prev + 1))} disabled={page >= totalPgs || totalPgs === 0}>Next</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPgs)} disabled={page >= totalPgs || totalPgs === 0}>Last</Button>
        </div>
      </div>
    );
  };

  // ─── Upcoming Appointments Table Row ──────────────────────────────────────

  const renderUpcomingTableRow = (appointment: AppointmentWithCustomer) => {
    const isPending = pendingAppointmentIds.has(appointment.id);
    return (
      <TableRow
        key={appointment.id}
        onClick={() => !isPending && handleViewAppointment(appointment)}
        className={`cursor-pointer hover:bg-muted/30 transition-colors border-b border-gray-100 dark:border-gray-800 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <TableCell onClick={(e) => e.stopPropagation()}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Checkbox
              checked={selectedAppointments.includes(appointment.id)}
              onCheckedChange={(checked) => handleSelectAppointment(appointment.id, checked as boolean)}
            />
          )}
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{getCustomerName(appointment.customer)}</p>
            <p className="text-sm text-gray-500">{appointment.customer?.email}</p>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{appointment.title}</p>
            {appointment.location && (
              <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{appointment.location}</p>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{formatDateTime(appointment.appointmentDate)}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1"><Timer className="h-3 w-3" />{appointment.duration} {t('reminders.appointments.minutes')}</p>
          </div>
        </TableCell>
        <TableCell>
          {isPending ? (
            <Badge className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving...</Badge>
          ) : (
            <Badge className={getStatusColor(appointment.status)}>
              {t(STATUS_TRANSLATION_KEYS[appointment.status] || appointment.status)}
            </Badge>
          )}
        </TableCell>
        <TableCell><div className="flex items-center gap-2">{renderReminderStatus(appointment)}</div></TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditAppointment(appointment); }}><Edit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewAppointment(appointment); }}><Eye className="h-4 w-4" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => confirmAppointmentMutation.mutate(appointment.id)}>
                  <CheckCircle className="h-4 w-4 mr-2" />Confirm Appointment
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => sendReminderMutation.mutate({ appointmentIds: [appointment.id] })}>
                  <Send className="h-4 w-4 mr-2" />{t('reminders.actions.sendReminder')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openScheduleReminder(appointment.id)}>
                  <Clock className="h-4 w-4 mr-2" />{t('reminders.actions.scheduleReminder')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleCancelAppointment(appointment.id); }}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                {t('reminders.pageTitle')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{t('reminders.pageSubtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Next Up Section */}
          <NextUpAppointments
            appointments={allAppointments}
            onViewDetails={handleViewAppointment}
          />

          {/* Stats */}
          <div className="order-2">
            <AppointmentStats
              allAppointments={allAppointments}
              upcomingAppointments={upcomingAppointments}
              onViewAppointment={handleViewAppointment}
            />
          </div>

          {/* Appointments Table with Tabs */}
          <Card className="order-1 shadow-sm">
            <CardHeader className="border-b">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Appointments
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={appointmentsFetching}
                    onClick={async () => {
                      await Promise.all([
                        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/appointments' }),
                        queryClient.invalidateQueries({ queryKey: ['/api/appointment-reminders'] })
                      ]);
                      setLastRefreshedAt(new Date());
                      toast({ title: t('reminders.toasts.success'), description: 'Appointments refreshed' });
                    }}
                    title="Refresh appointments"
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${appointmentsFetching ? 'animate-spin' : ''}`} />
                  </Button>
                  {lastRefreshedAt && (
                    <span className="text-xs text-muted-foreground hidden md:inline-block">
                      Last refreshed: {lastRefreshedAt.toLocaleTimeString()}
                    </span>
                  )}
                  <AppointmentFormDialog
                    open={newAppointmentModalOpen}
                    onOpenChange={setNewAppointmentModalOpen}
                    customers={customers}
                    userTimezone={userTimezone}
                    onSubmit={handleCreateAppointment}
                    isSubmitting={createAppointmentMutation.isPending}
                    validateEmailReminder={validateEmailReminder}
                  />
                </div>
              </div>
            </CardHeader>

            <Tabs value={appointmentsTab} onValueChange={(v) => setAppointmentsTab(v as "upcoming" | "past")} className="w-full">
              <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <TabsList className="bg-background">
                  <TabsTrigger value="upcoming" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />Scheduled
                  </TabsTrigger>
                  <TabsTrigger value="past" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />Past
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ─── Upcoming Tab ─────────────────────────────────────────── */}
              <TabsContent value="upcoming" className="mt-0">
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 lg:p-6 border-b bg-gray-50 dark:bg-gray-900/50">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={t('reminders.appointments.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10 focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Clear search">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48 focus-visible:ring-2 focus-visible:ring-ring"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reminders.appointments.allStatuses')}</SelectItem>
                      <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                      <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
                      <SelectItem value="cancelled">{t('reminders.appointments.cancelled')}</SelectItem>
                      <SelectItem value="completed">{t('reminders.appointments.completed')}</SelectItem>
                      <SelectItem value="no_show">{t('reminders.appointments.noShow')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {renderDateRangeFilter(dateFilterOpen, setDateFilterOpen, dateFrom, setDateFrom, dateTo, setDateTo, [
                    { label: t('reminders.appointments.today'), onClick: () => { const d = new Date(); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); setDateFrom(d); setDateTo(e); }},
                    { label: t('reminders.appointments.oneWeek'), onClick: () => { const d = new Date(); d.setHours(0,0,0,0); const e = new Date(d); e.setDate(e.getDate()+7); e.setHours(23,59,59,999); setDateFrom(d); setDateTo(e); }},
                    { label: t('reminders.appointments.oneMonth'), onClick: () => { const d = new Date(); d.setHours(0,0,0,0); const e = new Date(d); e.setMonth(e.getMonth()+1); e.setHours(23,59,59,999); setDateFrom(d); setDateTo(e); }},
                  ])}
                </div>

                {/* Bulk Actions */}
                {selectedAppointments.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/30 p-4 border-b border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
                        {selectedAppointments.length} {t('reminders.appointments.selected')}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => setSelectedAppointments([])} className="hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                        <XCircle className="h-4 w-4 mr-2" />{t('reminders.appointments.clearSelection')}
                      </Button>
                    </div>
                    <Button size="sm" onClick={handleSendReminders} disabled={sendReminderMutation.isPending} className="shadow-sm hover:shadow-md transition-all">
                      {sendReminderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {t('reminders.appointments.sendReminders')}
                    </Button>
                  </div>
                )}

                <div className="min-h-[400px]">
                  {appointmentsLoading ? (
                    <div className="flex items-center justify-center py-12 min-h-[400px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                    </div>
                  ) : appointments.length === 0 ? (
                    <div className="text-center py-16 min-h-[400px] flex flex-col items-center justify-center space-y-4">
                      <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800"><Calendar className="h-16 w-16 text-gray-400" /></div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('reminders.appointments.noAppointments')}</p>
                        <p className="text-sm text-muted-foreground max-w-md">{t('reminders.appointments.createFirst')}</p>
                      </div>
                      <Button onClick={() => setNewAppointmentModalOpen(true)} className="mt-4 shadow-sm hover:shadow-md transition-all">
                        <CalendarPlus className="h-4 w-4 mr-2" />{t('reminders.appointments.createAppointment')}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className="hidden lg:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="Select all appointments" />
                              </TableHead>
                              {(['customer', 'title', 'date', 'status'] as const).map(col => (
                                <TableHead key={col} className="cursor-pointer hover:bg-muted/50 transition-colors select-none" onClick={() => handleSort(col)}>
                                  <div className="flex items-center font-semibold">
                                    {t(`reminders.table.${col === 'title' ? 'appointment' : col === 'date' ? 'dateTime' : col}`)}
                                    <SortIcon column={col} />
                                  </div>
                                </TableHead>
                              ))}
                              <TableHead className="font-semibold">{t('reminders.table.reminder')}</TableHead>
                              <TableHead>{t('reminders.table.actions')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(appointmentsLoading || (searchQuery !== debouncedSearchQuery && appointments.length === 0)) ? (
                              Array.from({ length: 5 }).map((_, index) => (
                                <TableRow key={`skeleton-${index}`}>
                                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                  <TableCell><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div></TableCell>
                                  <TableCell><div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-24" /></div></TableCell>
                                  <TableCell><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-20" /></div></TableCell>
                                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                                </TableRow>
                              ))
                            ) : (
                              appointments.map(renderUpcomingTableRow)
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile/Tablet Card View */}
                      <div className="lg:hidden space-y-4 p-4">
                        {(appointmentsLoading || (searchQuery !== debouncedSearchQuery && appointments.length === 0)) ? (
                          Array.from({ length: 3 }).map((_, index) => (
                            <Card key={`skeleton-card-${index}`} className="overflow-hidden shadow-sm animate-pulse">
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                      <Skeleton className="h-4 w-4 mt-1" />
                                      <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-44" /></div>
                                    </div>
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        ) : (
                          appointments.map((appointment) => (
                            <AppointmentCard
                              key={appointment.id}
                              appointment={appointment}
                              reminders={reminders}
                              isSelected={selectedAppointments.includes(appointment.id)}
                              isPending={pendingAppointmentIds.has(appointment.id)}
                              isPendingReminder={pendingReminderAppointmentIds.has(appointment.id)}
                              onSelect={(checked) => handleSelectAppointment(appointment.id, checked)}
                              onClick={() => handleViewAppointment(appointment)}
                              onEdit={() => handleEditAppointment(appointment)}
                              onView={() => handleViewAppointment(appointment)}
                              onConfirm={() => confirmAppointmentMutation.mutate(appointment.id)}
                              onSendReminder={() => sendReminderMutation.mutate({ appointmentIds: [appointment.id] })}
                              onScheduleReminder={() => openScheduleReminder(appointment.id)}
                              onDelete={() => handleCancelAppointment(appointment.id)}
                            />
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {renderPagination(totalAppointments, totalPages, startIndex, endIndex, currentPage, setCurrentPage, pageSize, setPageSize)}
              </TabsContent>

              {/* ─── Past Tab ─────────────────────────────────────────────── */}
              <TabsContent value="past" className="mt-0">
                <div className="flex items-center gap-4 p-6 border-b">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search past appointments..." value={pastSearchQuery} onChange={(e) => setPastSearchQuery(e.target.value)} className="pl-10 pr-10" />
                    {pastSearchQuery && (
                      <button onClick={() => setPastSearchQuery("")} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Clear search">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Select value={pastStatusFilter} onValueChange={setPastStatusFilter}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reminders.appointments.allStatuses')}</SelectItem>
                      <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                      <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
                      <SelectItem value="cancelled">{t('reminders.appointments.cancelled')}</SelectItem>
                      <SelectItem value="completed">{t('reminders.appointments.completed')}</SelectItem>
                      <SelectItem value="no_show">{t('reminders.appointments.noShow')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {renderDateRangeFilter(pastDateFilterOpen, setPastDateFilterOpen, pastDateFrom, setPastDateFrom, pastDateTo, setPastDateTo, [
                    { label: t('reminders.appointments.lastWeek'), onClick: () => { const e = new Date(); e.setHours(23,59,59,999); const s = new Date(e); s.setDate(s.getDate()-7); s.setHours(0,0,0,0); setPastDateFrom(s); setPastDateTo(e); }},
                    { label: t('reminders.appointments.lastMonth'), onClick: () => { const e = new Date(); e.setHours(23,59,59,999); const s = new Date(e); s.setMonth(s.getMonth()-1); s.setHours(0,0,0,0); setPastDateFrom(s); setPastDateTo(e); }},
                    { label: t('reminders.appointments.last3Months'), onClick: () => { const e = new Date(); e.setHours(23,59,59,999); const s = new Date(e); s.setMonth(s.getMonth()-3); s.setHours(0,0,0,0); setPastDateFrom(s); setPastDateTo(e); }},
                  ])}
                </div>

                <div className="min-h-[400px]">
                  {(appointmentsLoading || pastSearchQuery !== debouncedPastSearchQuery) ? (
                    <div className="flex items-center justify-center py-12 min-h-[400px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                    </div>
                  ) : pastAppointments.length === 0 ? (
                    <div className="text-center py-16 min-h-[400px] flex flex-col items-center justify-center space-y-4">
                      <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800"><Clock className="h-16 w-16 text-gray-400" /></div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {(debouncedPastSearchQuery || pastStatusFilter !== 'all' || pastDateFrom || pastDateTo) ? 'No past appointments found' : 'No past appointments'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(debouncedPastSearchQuery || pastStatusFilter !== 'all' || pastDateFrom || pastDateTo) ? 'Try adjusting your filters to see more results' : 'Past appointments will appear here'}
                        </p>
                      </div>
                      {(debouncedPastSearchQuery || pastStatusFilter !== 'all' || pastDateFrom || pastDateTo) && (
                        <Button variant="outline" size="sm" onClick={() => { setPastSearchQuery(""); setPastStatusFilter("all"); setPastDateFrom(undefined); setPastDateTo(undefined); }} className="mt-4 hover:bg-muted/50 transition-colors">
                          <XCircle className="h-4 w-4 mr-2" />Clear filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden lg:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {(['customer', 'title', 'date', 'status'] as const).map(col => (
                                <TableHead key={col} className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handlePastSort(col)}>
                                  <div className="flex items-center">
                                    {t(`reminders.table.${col === 'title' ? 'appointment' : col === 'date' ? 'dateTime' : col}`)}
                                    <PastSortIcon column={col} />
                                  </div>
                                </TableHead>
                              ))}
                              <TableHead>{t('reminders.table.actions')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pastAppointments.map((appointment) => (
                              <TableRow key={appointment.id} onClick={() => handleViewAppointment(appointment)} className="cursor-pointer hover:bg-muted/30 transition-colors border-b border-gray-100 dark:border-gray-800">
                                <TableCell>
                                  <div><p className="font-medium">{getCustomerName(appointment.customer)}</p><p className="text-sm text-gray-500">{appointment.customer?.email}</p></div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{appointment.title}</p>
                                    {appointment.location && <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{appointment.location}</p>}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{formatDateTime(appointment.appointmentDate)}</p>
                                    <p className="text-sm text-gray-500 flex items-center gap-1"><Timer className="h-3 w-3" />{appointment.duration} {t('reminders.appointments.minutes')}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(appointment.status)}>{t(STATUS_TRANSLATION_KEYS[appointment.status] || appointment.status)}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewAppointment(appointment); }}><Eye className="h-4 w-4" /></Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile/Tablet Card View */}
                      <div className="lg:hidden space-y-4 p-4 lg:p-6">
                        {pastAppointments.map((appointment) => (
                          <Card key={appointment.id} className="overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700" onClick={() => handleViewAppointment(appointment)}>
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-base">{appointment.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{getCustomerName(appointment.customer)}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500">{appointment.customer?.email}</p>
                                  </div>
                                  <Badge className={getStatusColor(appointment.status)}>{t(STATUS_TRANSLATION_KEYS[appointment.status] || appointment.status)}</Badge>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Calendar className="h-4 w-4 text-gray-500" /><span>{formatDateTime(appointment.appointmentDate)}</span></div>
                                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Timer className="h-4 w-4 text-gray-500" /><span>{appointment.duration} {t('reminders.appointments.minutes')}</span></div>
                                  {appointment.location && <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><MapPin className="h-4 w-4 text-gray-500" /><span>{appointment.location}</span></div>}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {renderPagination(totalPastAppointments, totalPastPages, pastStartIndex, pastEndIndex, pastCurrentPage, setPastCurrentPage, pastPageSize, setPastPageSize)}
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* ─── Dialogs & Sheets (Extracted Components) ───────────────────── */}

        {/* Schedule Reminder Dialog */}
        <ReminderScheduleDialog
          open={scheduleReminderModalOpen}
          onOpenChange={setScheduleReminderModalOpen}
          appointment={scheduleReminderAppointment}
          customers={customers}
          userTimezone={userTimezone}
          onSchedule={handleScheduleReminder}
          isScheduling={createScheduledReminderMutation.isPending}
          validateEmailReminder={validateEmailReminder}
        />

        {/* Edit Appointment Dialog */}
        <AppointmentEditDialog
          open={editAppointmentModalOpen}
          onOpenChange={setEditAppointmentModalOpen}
          appointment={editingAppointment}
          customers={customers}
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
          appointment={appointments.find(apt => apt.id === cancelAppointmentId) || null}
          onConfirm={confirmCancelAppointment}
          isDeleting={cancelAppointmentMutation.isPending}
        />

        {/* Past Date Warning */}
        <Dialog open={pastDateConfirmModalOpen} onOpenChange={setPastDateConfirmModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />Past Date Warning
              </DialogTitle>
              <DialogDescription>
                You are scheduling an appointment for a date in the past. Are you sure you want to continue?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="font-medium">{pendingCreateRef.current?.data.title || 'Untitled Appointment'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Scheduled for: {pendingCreateRef.current?.data.appointmentDate ? formatDateTime(pendingCreateRef.current.data.appointmentDate) : ''}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />This date is in the past
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPastDateConfirmModalOpen(false)}>Cancel</Button>
                <Button onClick={confirmPastDateAppointment} disabled={createAppointmentMutation.isPending}>
                  {createAppointmentMutation.isPending ? 'Creating...' : 'Create Anyway'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Appointment Sheet */}
        <AppointmentDetailsSheet
          open={viewAppointmentPanelOpen}
          onOpenChange={setViewAppointmentPanelOpen}
          appointment={viewingAppointment}
          reminders={reminders}
          notes={notesData?.notes || []}
          notesLoading={notesLoading}
          onEdit={(apt) => { setViewAppointmentPanelOpen(false); handleEditAppointment(apt); }}
          onStatusChange={handleStatusChange}
          onViewCustomerProfile={() => setCustomerProfilePanelOpen(true)}
          onCreateNewAppointment={handleCreateNewFromPast}
          onSendReminder={(id) => sendReminderMutation.mutate({ appointmentIds: [id], reminderType: 'email' })}
          isSendingReminder={sendReminderMutation.isPending}
          newNoteContent={newNoteContent}
          onNewNoteContentChange={setNewNoteContent}
          onCreateNote={() => {
            if (newNoteContent.trim() && viewingAppointment?.id) {
              createNoteMutation.mutate({ appointmentId: viewingAppointment.id, content: newNoteContent.trim() });
            }
          }}
          isCreatingNote={createNoteMutation.isPending}
          editingNoteId={editingNoteId}
          editingNoteContent={editingNoteContent}
          onEditNote={(noteId, content) => { setEditingNoteId(noteId); setEditingNoteContent(content); }}
          onUpdateNote={() => {
            if (editingNoteContent.trim() && editingNoteId) {
              updateNoteMutation.mutate({ noteId: editingNoteId, content: editingNoteContent.trim() });
            }
          }}
          isUpdatingNote={updateNoteMutation.isPending}
          onCancelEditNote={() => { setEditingNoteId(null); setEditingNoteContent(""); }}
          onDeleteNote={(noteId) => deleteNoteMutation.mutate(noteId)}
          isDeletingNote={deleteNoteMutation.isPending}
        />

        {/* Reschedule Email Confirmation */}
        <AlertDialog open={rescheduleEmailDialogOpen} onOpenChange={setRescheduleEmailDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-amber-500" />Send Reschedule Invitation?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Would you like to send a friendly email to the customer inviting them to reschedule their appointment?</p>
                <p className="text-sm text-muted-foreground">The email will include the original appointment details and encourage them to book a new time.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={() => handleRescheduleEmailConfirm(false)} disabled={updateAppointmentMutation.isPending}>
                No, Just Update Status
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRescheduleEmailConfirm(true)} disabled={updateAppointmentMutation.isPending || sendRescheduleEmailMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
                <Send className="h-4 w-4 mr-2" />Yes, Send Email
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Thank-You Email Confirmation */}
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

        {/* Customer Profile Drawer */}
        <ContactViewDrawer
          contactId={viewingAppointment?.customer?.id || null}
          open={customerProfilePanelOpen}
          onOpenChange={setCustomerProfilePanelOpen}
        />
      </div>
    </div>
  );
}
