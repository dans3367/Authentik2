import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
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
  AlertTriangle,
  Search,
  Send,
  MoreVertical,
  CalendarPlus,
  MapPin,
  Timer,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NextUpAppointments } from "@/components/NextUpAppointments";
import { AvailabilityTab, AppointmentSettingsTab } from "@/components/availability";

// Import extracted components
import {
  DeleteConfirmDialog,
  AppointmentEditDialog,
  AppointmentDetailsContainer,
  ReminderScheduleDialog,
  CreateAppointmentDialog,
  AppointmentsWeekBoard,
} from "@/components/appointments";
import type { EditReminderData } from "@/components/appointments";
import type { ScheduleReminderData } from "@/components/appointments";
import type { NewAppointmentData } from "@/components/appointments";

// Import extracted utilities
import {
  getCustomerName,
  getCustomerNameForSort,
  getStatusColor,
  formatDateTime,
  isAppointmentOverlapError,
  TIMING_MAP,
  downloadAppointmentIcs,
  type AppointmentOverlapConflict,
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

export default function RemindersPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useReduxAuth();
  const userTimezone = user?.timezone || 'America/Chicago';
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const { providers } = useAssignableUsers();

  const [appointmentsTab, setAppointmentsTab] = useState<"upcoming" | "past">("upcoming");
  const [activeTab, setActiveTab] = useState<"appointments" | "availability" | "settings">("appointments");

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
  const [newAppointmentDefaults, setNewAppointmentDefaults] = useState<Partial<NewAppointmentData> | undefined>(undefined);
  const [newAppointmentSeedCustomer, setNewAppointmentSeedCustomer] = useState<AppointmentWithCustomer['customer']>(undefined);
  const [editAppointmentModalOpen, setEditAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [viewAppointmentPanelOpen, setViewAppointmentPanelOpen] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<AppointmentWithCustomer | null>(null);
  const [scheduleReminderModalOpen, setScheduleReminderModalOpen] = useState(false);
  const [scheduleReminderAppointment, setScheduleReminderAppointment] = useState<AppointmentWithCustomer | null>(null);
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

  // Pending creation state for optimistic UI
  const [pendingAppointmentIds, setPendingAppointmentIds] = useState<Set<string>>(new Set());
  const [pendingReminderAppointmentIds, setPendingReminderAppointmentIds] = useState<Set<string>>(new Set());
  const isMountedRef = useRef(true);

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

  const handleScheduleReminder = (appointmentId: string, data: ScheduleReminderData) => {
    createScheduledReminderMutation.mutate({ appointmentId, data });
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

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const renderReminderStatus = (appointment: AppointmentWithCustomer) => {
    const isPending = pendingAppointmentIds.has(appointment.id) || pendingReminderAppointmentIds.has(appointment.id);
    if (isPending) {
      return (
        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      );
    }
    const appointmentReminders = reminders.filter(r => r.appointmentId === appointment.id);
    const hasSent = appointmentReminders.some(r => r.status === 'sent') || appointment.reminderSent;
    const hasPending = appointmentReminders.some(r => r.status === 'pending');

    if (hasSent) return <div className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="h-4 w-4" /><span className="text-sm">{t('reminders.reminderHistory.sent')}</span></div>;
    if (hasPending) return <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Clock className="h-4 w-4" /><span className="text-sm">Scheduled</span></div>;
    return <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500"><Clock className="h-4 w-4" /><span className="text-sm">{t('reminders.reminderHistory.notSet')}</span></div>;
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
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b dark:border-neutral-700">
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
          <div className="mt-4 pt-4 border-t dark:border-neutral-700">
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t dark:border-neutral-700">
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
            <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.customer?.email}</p>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{appointment.title}</p>
            {appointment.location && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"><MapPin className="h-3 w-3" />{appointment.location}</p>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{formatDateTime(appointment.appointmentDate)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"><Timer className="h-3 w-3" />{appointment.duration} {t('reminders.appointments.minutes')}</p>
          </div>
        </TableCell>
        <TableCell>
          {isPending ? (
            <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving...</Badge>
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
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadAppointmentIcs(appointment); }}>
                  <Download className="h-4 w-4 mr-2" />Export to Calendar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={(e) => { e.stopPropagation(); handleCancelAppointment(appointment.id); }}>
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
      <div className="mx-auto max-w-7xl p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "appointments" | "availability" | "settings")} className="flex flex-col gap-6">
          <TabsList className="self-end">
            <TabsTrigger value="appointments">{t('reminders.tabs.appointments')}</TabsTrigger>
            <TabsTrigger value="availability">{t('reminders.availability.tabLabel')}</TabsTrigger>
            <TabsTrigger value="settings">{t('reminders.tabs.settings')}</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="flex flex-col gap-6 mt-0">
            {/* Next Up Section */}
            <NextUpAppointments
              appointments={allAppointments}
              onViewDetails={handleViewAppointment}
              onConfirm={(id) => confirmAppointmentMutation.mutateAsync(id)}
              pageTitle={t('reminders.pageTitle')}
              pageSubtitle={t('reminders.pageSubtitle')}
              pageAction={
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

          <TabsContent value="availability" className="mt-0">
            <AvailabilityTab />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <AppointmentSettingsTab />
          </TabsContent>
        </Tabs>

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
          appointment={appointments.find(apt => apt.id === cancelAppointmentId) || null}
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
