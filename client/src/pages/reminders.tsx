import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Bell,
  Users,
  Mail,
  Calendar,
  Settings,
  Filter,
  Plus,
  Trash2,
  Edit,
  Copy,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  BarChart3,
  Search,
  UserPlus,
  Send,
  MoreVertical,
  CalendarPlus,
  MessageSquare,
  AlertTriangle,
  MapPin,
  Timer,
  Info,
  LayoutDashboard,
  StickyNote,
  Loader2,
  Archive,
  ArchiveRestore,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BellOff
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ContactViewDrawer from "@/components/ContactViewDrawer";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types based on our schema
interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "active" | "unsubscribed" | "bounced" | "pending";
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  phoneNumber?: string | null;
}

interface Appointment {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  appointmentDate: Date;
  duration: number;
  location?: string;
  serviceType?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes?: string;
  reminderSent: boolean;
  reminderSentAt?: Date;
  confirmationReceived: boolean;
  confirmationReceivedAt?: Date;
  confirmationToken?: string;
  reminderSettings?: string;
  isArchived?: boolean;
  archivedAt?: Date;
  customer?: Customer;
  createdAt: Date;
  updatedAt: Date;
}

interface AppointmentReminder {
  id: string;
  appointmentId: string;
  reminderType: 'email' | 'sms' | 'push';
  reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
  customMinutesBefore?: number;
  scheduledFor: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  content?: string;
  errorMessage?: string;
}

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
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user } = useReduxAuth();
  const userTimezone = user?.timezone || 'America/Chicago';
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [appointmentsTab, setAppointmentsTab] = useState<"upcoming" | "past">("upcoming");

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('reminders.pageTitle'), icon: Bell }
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [pastSearchQuery, setPastSearchQuery] = useState("");
  const [debouncedPastSearchQuery, setDebouncedPastSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pastStatusFilter, setPastStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
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
  const [newAppointmentModalOpen, setNewAppointmentModalOpen] = useState(false);
  const [newAppointmentReminderModalOpen, setNewAppointmentReminderModalOpen] = useState(false);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [pastDateFilterOpen, setPastDateFilterOpen] = useState(false);

  // Debounce search query to avoid jittery API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce past search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPastSearchQuery(pastSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [pastSearchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter, showArchived, dateFrom, dateTo]);

  // Reset past page to 1 when past filters change
  useEffect(() => {
    setPastCurrentPage(1);
  }, [debouncedPastSearchQuery, pastStatusFilter, pastDateFrom, pastDateTo]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
  }, [showArchived]);
  const [editAppointmentModalOpen, setEditAppointmentModalOpen] = useState(false);
  const [editAppointmentReminderModalOpen, setEditAppointmentReminderModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewAppointmentPanelOpen, setViewAppointmentPanelOpen] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [viewAppointmentTab, setViewAppointmentTab] = useState<"details" | "notes">("details");
  const [showExpandedCustomerInfo, setShowExpandedCustomerInfo] = useState(false);
  const [customerProfilePanelOpen, setCustomerProfilePanelOpen] = useState(false);
  const [newAppointmentData, setNewAppointmentData] = useState({
    customerId: "",
    title: "",
    description: "",
    appointmentDate: new Date(),
    duration: 60,
    location: "",
    serviceType: "",
    status: 'scheduled' as const,
    notes: "",
  });
  const [newAppointmentErrors, setNewAppointmentErrors] = useState<{
    customerId?: boolean;
    title?: boolean;
    customMinutesBefore?: boolean;
  }>({});
  const [newAppointmentReminderEnabled, setNewAppointmentReminderEnabled] = useState(false);
  const [newAppointmentReminderData, setNewAppointmentReminderData] = useState<{
    reminderType: 'email' | 'sms' | 'push';
    reminderTiming: 'now' | '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
    customMinutesBefore?: number;
    timezone: string;
    content?: string;
  }>({
    reminderType: 'email',
    reminderTiming: '1h',
    customMinutesBefore: undefined,
    timezone: 'America/Chicago',
    content: '',
  });
  const [editAppointmentReminderEnabled, setEditAppointmentReminderEnabled] = useState(false);
  const [editAppointmentReminderData, setEditAppointmentReminderData] = useState<{
    reminderType: 'email' | 'sms' | 'push';
    reminderTiming: 'now' | '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
    customMinutesBefore?: number;
    timezone: string;
    content?: string;
  }>({
    reminderType: 'email',
    reminderTiming: '1h',
    customMinutesBefore: undefined,
    timezone: 'America/Chicago',
    content: '',
  });
  const [editAppointmentErrors, setEditAppointmentErrors] = useState<{
    customMinutesBefore?: boolean;
  }>({});

  // Appointment notes state
  const [appointmentNotes, setAppointmentNotes] = useState<AppointmentNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Pagination state for reminders table
  const [remindersPage, setRemindersPage] = useState(1);
  const [remindersPageSize] = useState(10);

  // Delete/cancel reminder mutation
  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const response = await apiRequest('PUT', `/api/appointment-reminders/${reminderId}/status`, {
        status: 'cancelled',
      });
      return response.json();
    },
    onSuccess: () => {
      refetchReminders();
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || 'Failed to delete reminder', variant: 'destructive' });
    }
  });

  // Create scheduled reminder mutation
  const createScheduledReminderMutation = useMutation({
    mutationFn: async ({ appointmentId, data }: { appointmentId: string; data: { reminderType: 'email' | 'sms' | 'push'; reminderTiming: 'now' | '5m' | '30m' | '1h' | '5h' | '10h' | 'custom'; customMinutesBefore?: number; scheduledFor: Date; timezone?: string; content?: string } }) => {
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
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.reminderScheduled') });
      setScheduleReminderModalOpen(false);
      setScheduleAppointmentId("");
      refetchReminders();
      // Invalidate appointments queries to refresh the list with updated reminder status
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
    },
    onError: (error: any) => {
      toast({ title: t('reminders.toasts.error'), description: error?.message || t('reminders.toasts.reminderScheduleError'), variant: 'destructive' });
    }
  });

  // Schedule reminder modal state
  const [scheduleReminderModalOpen, setScheduleReminderModalOpen] = useState(false);
  const [scheduleAppointmentId, setScheduleAppointmentId] = useState<string>("");
  const [scheduleData, setScheduleData] = useState<{
    reminderType: 'email' | 'sms' | 'push';
    reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
    customMinutesBefore?: number;
    scheduledFor: Date;
    timezone: string;
    content: string;
  }>({
    reminderType: 'email',
    reminderTiming: '1h',
    scheduledFor: new Date(),
    timezone: userTimezone,
    content: ''
  });

  // Update timezone defaults when user data loads
  useEffect(() => {
    if (userTimezone) {
      setNewAppointmentReminderData(prev => ({ ...prev, timezone: userTimezone }));
      setEditAppointmentReminderData(prev => ({ ...prev, timezone: userTimezone }));
      setScheduleData(prev => ({ ...prev, timezone: userTimezone }));
    }
  }, [userTimezone]);

  // Cancel appointment confirmation state
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string>("");
  const [cancelConfirmModalOpen, setCancelConfirmModalOpen] = useState(false);

  // Archive appointment confirmation state
  const [archiveAppointmentId, setArchiveAppointmentId] = useState<string>("");
  const [archiveConfirmModalOpen, setArchiveConfirmModalOpen] = useState(false);

  // Past date confirmation state
  const [pastDateConfirmModalOpen, setPastDateConfirmModalOpen] = useState(false);

  // Fetch appointments - no date filtering on server, only archived filter
  // All date filtering is done client-side to ensure both upcoming and past tabs
  // have access to all appointment data
  const {
    data: appointmentsData,
    isLoading: appointmentsLoading,
    isFetching: appointmentsFetching,
    refetch: refetchAppointments
  } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ['/api/appointments', showArchived],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showArchived) params.append('archived', 'true');

      const response = await apiRequest('GET', `/api/appointments?${params.toString()}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch upcoming appointments (always non-archived for the sidebar)
  const { data: upcomingAppointmentsData, refetch: refetchUpcomingAppointments } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ['/api/appointments/upcoming'],
    queryFn: async () => {
      // Always fetch non-archived appointments for upcoming section
      const response = await apiRequest('GET', '/api/appointments');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch customers for appointment creation
  const { data: customersData } = useQuery<{ contacts: Customer[] }>({
    queryKey: ['/api/email-contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-contacts');
      return response.json();
    },
  });

  // Fetch appointment reminders
  const {
    data: remindersData,
    isLoading: remindersLoading,
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

  const allAppointments: Appointment[] = appointmentsData?.appointments || [];
  const upcomingAppointmentsForSidebar: Appointment[] = upcomingAppointmentsData?.appointments || [];

  // Helper to get customer name for sorting
  const getCustomerNameForSort = (customer: Customer | undefined): string => {
    if (!customer) return '';
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
  };

  // Split appointments into upcoming and past based on current time
  const now = new Date();
  const upcomingAppointmentsUnfiltered = allAppointments.filter(a => new Date(a.appointmentDate) >= now);
  const pastAppointmentsAllUnfiltered = allAppointments.filter(a => new Date(a.appointmentDate) < now);

  // Filter upcoming appointments by search query, status, and date range
  const upcomingAppointmentsAll = upcomingAppointmentsUnfiltered.filter(appointment => {
    // Filter by status
    if (statusFilter !== 'all' && appointment.status !== statusFilter) {
      return false;
    }
    // Filter by date range
    const appointmentDate = new Date(appointment.appointmentDate);
    if (dateFrom && appointmentDate < dateFrom) {
      return false;
    }
    if (dateTo && appointmentDate > dateTo) {
      return false;
    }
    // Filter by search query
    if (!debouncedSearchQuery) return true;
    const searchLower = debouncedSearchQuery.toLowerCase();
    const customerName = getCustomerNameForSort(appointment.customer).toLowerCase();
    const customerEmail = (appointment.customer?.email || '').toLowerCase();
    const title = (appointment.title || '').toLowerCase();
    const location = (appointment.location || '').toLowerCase();
    return customerName.includes(searchLower) ||
      customerEmail.includes(searchLower) ||
      title.includes(searchLower) ||
      location.includes(searchLower);
  });

  // Filter past appointments by search query, status, and date range
  const pastAppointmentsAll = pastAppointmentsAllUnfiltered.filter(appointment => {
    // Filter by status
    if (pastStatusFilter !== 'all' && appointment.status !== pastStatusFilter) {
      return false;
    }
    // Filter by date range
    const appointmentDate = new Date(appointment.appointmentDate);
    if (pastDateFrom && appointmentDate < pastDateFrom) {
      return false;
    }
    if (pastDateTo && appointmentDate > pastDateTo) {
      return false;
    }
    // Filter by search query
    if (!debouncedPastSearchQuery) return true;
    const searchLower = debouncedPastSearchQuery.toLowerCase();
    const customerName = getCustomerNameForSort(appointment.customer).toLowerCase();
    const customerEmail = (appointment.customer?.email || '').toLowerCase();
    const title = (appointment.title || '').toLowerCase();
    const location = (appointment.location || '').toLowerCase();
    return customerName.includes(searchLower) ||
      customerEmail.includes(searchLower) ||
      title.includes(searchLower) ||
      location.includes(searchLower);
  });

  // Sort upcoming appointments
  const sortedUpcomingAppointments = [...upcomingAppointmentsAll].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case 'customer':
        const nameA = getCustomerNameForSort(a.customer);
        const nameB = getCustomerNameForSort(b.customer);
        comparison = nameA.localeCompare(nameB);
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'date':
        comparison = new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime();
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Sort past appointments
  const sortedPastAppointments = [...pastAppointmentsAll].sort((a, b) => {
    let comparison = 0;
    switch (pastSortColumn) {
      case 'customer':
        const nameA = getCustomerNameForSort(a.customer);
        const nameB = getCustomerNameForSort(b.customer);
        comparison = nameA.localeCompare(nameB);
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'date':
        comparison = new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime();
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
    }
    return pastSortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination calculations for upcoming appointments
  const totalAppointments = sortedUpcomingAppointments.length;
  const totalPages = Math.ceil(totalAppointments / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const appointments = sortedUpcomingAppointments.slice(startIndex, endIndex);

  // Pagination calculations for past appointments
  const totalPastAppointments = sortedPastAppointments.length;
  const totalPastPages = Math.ceil(totalPastAppointments / pastPageSize);
  const pastStartIndex = (pastCurrentPage - 1) * pastPageSize;
  const pastEndIndex = pastStartIndex + pastPageSize;
  const pastAppointments = sortedPastAppointments.slice(pastStartIndex, pastEndIndex);
  const customers: Customer[] = customersData?.contacts || [];
  const reminders: AppointmentReminder[] = remindersData?.reminders || [];

  // Pagination calculations for reminders
  const remindersTotal = reminders.length;
  const remindersTotalPages = Math.ceil(remindersTotal / remindersPageSize);
  const remindersStartIndex = (remindersPage - 1) * remindersPageSize;
  const remindersEndIndex = remindersStartIndex + remindersPageSize;
  const paginatedReminders = reminders.slice(remindersStartIndex, remindersEndIndex);

  // Handle column sort click for upcoming appointments
  const handleSort = (column: 'customer' | 'title' | 'date' | 'status') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Handle column sort click for past appointments
  const handlePastSort = (column: 'customer' | 'title' | 'date' | 'status') => {
    if (pastSortColumn === column) {
      setPastSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPastSortColumn(column);
      setPastSortDirection('asc');
    }
    setPastCurrentPage(1);
  };

  // Render sort icon for upcoming appointments column header
  const SortIcon = ({ column }: { column: 'customer' | 'title' | 'date' | 'status' }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Render sort icon for past appointments column header
  const PastSortIcon = ({ column }: { column: 'customer' | 'title' | 'date' | 'status' }) => {
    if (pastSortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return pastSortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Fetch appointment notes when viewing an appointment
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

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async ({ appointmentId, content }: { appointmentId: string; content: string }) => {
      const response = await apiRequest('POST', '/api/appointment-notes', {
        appointmentId,
        content,
      });
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

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const response = await apiRequest('PATCH', `/api/appointment-notes/${noteId}`, {
        content,
      });
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

  // Delete note mutation
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

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
      const response = await apiRequest('PATCH', `/api/appointments/${id}`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: t('reminders.toasts.success'),
        description: t('reminders.toasts.appointmentUpdated'),
      });

      if (data?.appointment) {
        queryClient.setQueryData(
          ['/api/appointments', searchQuery, statusFilter],
          (old: { appointments: Appointment[] } | undefined) => {
            if (!old?.appointments) return old;
            return {
              ...old,
              appointments: old.appointments.map((apt) =>
                apt.id === data.appointment.id ? { ...apt, ...data.appointment } : apt
              ),
            };
          }
        );
      }

      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      refetchAppointments();
      setEditAppointmentModalOpen(false);
      setEditingAppointment(null);
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || t('reminders.toasts.appointmentUpdateError'),
        variant: "destructive",
      });
    },
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await apiRequest('POST', '/api/appointments', appointmentData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('reminders.toasts.success'),
        description: t('reminders.toasts.appointmentCreated'),
      });

      // Invalidate all appointment queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });

      // Schedule delayed refreshes to ensure data is fully synced
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
      }, 5000);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
      }, 15000);

      // Schedule reminder if enabled
      if (newAppointmentReminderEnabled && data.appointment) {
        const appointmentDate = new Date(data.appointment.appointmentDate);
        let scheduledFor: Date;

        if (newAppointmentReminderData.reminderTiming === 'now') {
          scheduledFor = new Date();
        } else if (newAppointmentReminderData.reminderTiming === 'custom' && newAppointmentReminderData.customMinutesBefore) {
          scheduledFor = new Date(appointmentDate.getTime() - newAppointmentReminderData.customMinutesBefore * 60 * 1000);
        } else {
          const timingMap: Record<string, number> = {
            '5m': 5,
            '30m': 30,
            '1h': 60,
            '5h': 300,
            '10h': 600,
          };
          const minutes = timingMap[newAppointmentReminderData.reminderTiming] || 60;
          scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
        }

        createScheduledReminderMutation.mutate({
          appointmentId: data.appointment.id,
          data: {
            reminderType: newAppointmentReminderData.reminderType,
            reminderTiming: newAppointmentReminderData.reminderTiming,
            customMinutesBefore: newAppointmentReminderData.customMinutesBefore,
            scheduledFor,
            timezone: newAppointmentReminderData.timezone,
            content: newAppointmentReminderData.content,
          },
        });
      }

      setNewAppointmentModalOpen(false);
      resetNewAppointmentData();
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || t('reminders.toasts.appointmentCreateError'),
        variant: "destructive",
      });
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
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
      setSelectedAppointments([]);
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || t('reminders.toasts.remindersSendError'),
        variant: "destructive",
      });
    },
  });

  // Cancel appointment mutation
  const cancelAppointmentMutation = useMutation({
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
      setSelectedAppointments(prev => prev.filter(id => id !== cancelAppointmentId));
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || 'Failed to delete appointment',
        variant: "destructive",
      });
    },
  });

  // Archive appointment mutation
  const archiveAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest('POST', `/api/appointments/${appointmentId}/archive`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('reminders.toasts.success'),
        description: 'Appointment archived successfully',
      });
      refetchAppointments();
      setSelectedAppointments(prev => prev.filter(id => id !== archiveAppointmentId));
      setArchiveConfirmModalOpen(false);
      setArchiveAppointmentId("");
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || 'Failed to archive appointment',
        variant: "destructive",
      });
    },
  });

  // Unarchive appointment mutation
  const unarchiveAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest('POST', `/api/appointments/${appointmentId}/unarchive`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('reminders.toasts.success'),
        description: 'Appointment restored successfully',
      });
      refetchAppointments();
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || 'Failed to restore appointment',
        variant: "destructive",
      });
    },
  });

  // Confirm appointment mutation
  const confirmAppointmentMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || 'Failed to confirm appointment',
        variant: "destructive",
      });
    },
  });

  const resetNewAppointmentData = () => {
    setNewAppointmentData({
      customerId: "",
      title: "",
      description: "",
      appointmentDate: new Date(),
      duration: 60,
      location: "",
      serviceType: "",
      status: 'scheduled' as const,
      notes: "",
    });
    setNewAppointmentErrors({});
    setNewAppointmentReminderEnabled(false);
    setNewAppointmentReminderData({
      reminderType: 'email',
      reminderTiming: '1h',
      customMinutesBefore: undefined,
      timezone: userTimezone,
      content: '',
    });
  };

  const openScheduleReminder = (appointmentId: string) => {
    const apt = appointments.find(a => a.id === appointmentId);
    const baseDate = apt ? new Date(apt.appointmentDate) : new Date();
    const defaultScheduled = new Date(baseDate.getTime() - 1 * 60 * 60 * 1000); // default 1h before
    setScheduleAppointmentId(appointmentId);
    setScheduleData({ reminderType: 'email', reminderTiming: '1h', scheduledFor: defaultScheduled, timezone: userTimezone, content: '' });
    setScheduleReminderModalOpen(true);
  };

  const computeScheduledFor = (timing: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom', customMinutesBefore?: number): Date => {
    const apt = appointments.find(a => a.id === scheduleAppointmentId);
    const baseDate = apt ? new Date(apt.appointmentDate) : new Date();
    switch (timing) {
      case '5m':
        return new Date(baseDate.getTime() - 5 * 60 * 1000);
      case '30m':
        return new Date(baseDate.getTime() - 30 * 60 * 1000);
      case '1h':
        return new Date(baseDate.getTime() - 1 * 60 * 60 * 1000);
      case '5h':
        return new Date(baseDate.getTime() - 5 * 60 * 60 * 1000);
      case '10h':
        return new Date(baseDate.getTime() - 10 * 60 * 60 * 1000);
      case 'custom':
        if (customMinutesBefore) {
          return new Date(baseDate.getTime() - customMinutesBefore * 60 * 1000);
        }
        return new Date(baseDate.getTime() - 1 * 60 * 60 * 1000); // Default to 1h for custom if no minutes specified
      default:
        return new Date(baseDate.getTime() - 1 * 60 * 60 * 1000); // Default to 1h
    }
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setViewingAppointment(appointment);
    setViewAppointmentPanelOpen(true);
    setViewAppointmentTab("details");
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setEditAppointmentModalOpen(true);

    // Check for existing reminder
    const existingReminder = reminders.find(r => r.appointmentId === appointment.id && r.status === 'pending');

    if (existingReminder) {
      setEditAppointmentReminderEnabled(true);
      setEditAppointmentReminderModalOpen(false);
      setEditAppointmentReminderData({
        reminderType: existingReminder.reminderType,
        reminderTiming: existingReminder.reminderTiming,
        customMinutesBefore: existingReminder.customMinutesBefore || undefined,
        timezone: (existingReminder as any).timezone || 'America/Chicago',
        content: existingReminder.content || '',
      });
    } else {
      setEditAppointmentReminderEnabled(false);
      setEditAppointmentReminderModalOpen(false);
      setEditAppointmentReminderData({
        reminderType: 'email',
        reminderTiming: '1h',
        customMinutesBefore: undefined,
        timezone: 'America/Chicago',
        content: '',
      });
    }

    setEditAppointmentErrors({});
  };

  const handleUpdateAppointment = () => {
    if (!editingAppointment) return;

    const errors: typeof editAppointmentErrors = {};

    if (editAppointmentReminderEnabled && editAppointmentReminderData.reminderTiming === 'custom' && !editAppointmentReminderData.customMinutesBefore) {
      errors.customMinutesBefore = true;
    }

    if (editAppointmentReminderEnabled) {
      const appointmentDate = new Date(editingAppointment.appointmentDate);
      let scheduledFor: Date;

      if (editAppointmentReminderData.reminderTiming === 'custom' && editAppointmentReminderData.customMinutesBefore) {
        scheduledFor = new Date(appointmentDate.getTime() - editAppointmentReminderData.customMinutesBefore * 60 * 1000);
      } else {
        const timingMap: Record<string, number> = {
          '5m': 5,
          '30m': 30,
          '1h': 60,
          '5h': 300,
          '10h': 600,
        };
        const minutes = timingMap[editAppointmentReminderData.reminderTiming] || 60;
        scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
      }

      if (scheduledFor < new Date()) {
        toast({
          title: t('reminders.toasts.validationError'),
          description: "Reminder time cannot be in the past",
          variant: "destructive",
        });
        return;
      }
    }

    if (Object.keys(errors).length > 0) {
      setEditAppointmentErrors(errors);
      toast({
        title: t('reminders.toasts.validationError'),
        description: 'Please fill in all required fields',
        variant: "destructive",
      });
      return;
    }

    setEditAppointmentErrors({});

    // Set status to 'scheduled' if reminder is enabled
    const appointmentStatus = editingAppointment.status;

    updateAppointmentMutation.mutate({
      id: editingAppointment.id,
      data: {
        title: editingAppointment.title,
        description: editingAppointment.description,
        appointmentDate: editingAppointment.appointmentDate,
        duration: editingAppointment.duration,
        location: editingAppointment.location,
        serviceType: editingAppointment.serviceType,
        status: appointmentStatus,
        notes: editingAppointment.notes,
      },
    });

    // Check if there's an existing reminder
    const existingReminder = reminders.find(r => r.appointmentId === editingAppointment.id && r.status === 'pending');

    // Handle reminder based on toggle state
    if (editAppointmentReminderEnabled) {
      const appointmentDate = new Date(editingAppointment.appointmentDate);
      let scheduledFor: Date;

      if (editAppointmentReminderData.reminderTiming === 'custom' && editAppointmentReminderData.customMinutesBefore) {
        scheduledFor = new Date(appointmentDate.getTime() - editAppointmentReminderData.customMinutesBefore * 60 * 1000);
      } else {
        const timingMap: Record<string, number> = {
          '5m': 5,
          '30m': 30,
          '1h': 60,
          '5h': 300,
          '10h': 600,
        };
        const minutes = timingMap[editAppointmentReminderData.reminderTiming] || 60;
        scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
      }

      // Delete existing reminder first if it exists, then create new one
      if (existingReminder) {
        deleteReminderMutation.mutate(existingReminder.id);
      }

      // Create new reminder
      createScheduledReminderMutation.mutate({
        appointmentId: editingAppointment.id,
        data: {
          reminderType: editAppointmentReminderData.reminderType,
          reminderTiming: editAppointmentReminderData.reminderTiming,
          customMinutesBefore: editAppointmentReminderData.customMinutesBefore,
          scheduledFor,
          timezone: editAppointmentReminderData.timezone,
          content: editAppointmentReminderData.content,
        },
      });
    } else if (existingReminder) {
      // If reminder was disabled, delete the existing reminder
      deleteReminderMutation.mutate(existingReminder.id);
    }
  };

  const handleCreateAppointment = () => {
    const errors: typeof newAppointmentErrors = {};

    if (!newAppointmentData.customerId) {
      errors.customerId = true;
    }
    if (!newAppointmentData.title) {
      errors.title = true;
    }
    if (newAppointmentReminderEnabled && newAppointmentReminderData.reminderTiming === 'custom' && !newAppointmentReminderData.customMinutesBefore) {
      errors.customMinutesBefore = true;
    }

    if (newAppointmentReminderEnabled && newAppointmentReminderData.reminderTiming !== 'now') {
      const appointmentDate = new Date(newAppointmentData.appointmentDate);
      let scheduledFor: Date;

      if (newAppointmentReminderData.reminderTiming === 'custom' && newAppointmentReminderData.customMinutesBefore) {
        scheduledFor = new Date(appointmentDate.getTime() - newAppointmentReminderData.customMinutesBefore * 60 * 1000);
      } else {
        const timingMap: Record<string, number> = {
          '5m': 5,
          '30m': 30,
          '1h': 60,
          '5h': 300,
          '10h': 600,
        };
        const minutes = timingMap[newAppointmentReminderData.reminderTiming] || 60;
        scheduledFor = new Date(appointmentDate.getTime() - minutes * 60 * 1000);
      }

      if (scheduledFor < new Date()) {
        toast({
          title: t('reminders.toasts.validationError'),
          description: "Reminder time cannot be in the past",
          variant: "destructive",
        });
        return;
      }
    }

    if (Object.keys(errors).length > 0) {
      setNewAppointmentErrors(errors);
      toast({
        title: t('reminders.toasts.validationError'),
        description: 'Please fill in all required fields',
        variant: "destructive",
      });
      return;
    }

    setNewAppointmentErrors({});

    // Check if appointment date is in the past
    const appointmentDate = new Date(newAppointmentData.appointmentDate);
    const now = new Date();
    if (appointmentDate < now) {
      setPastDateConfirmModalOpen(true);
      return;
    }

    createAppointmentMutation.mutate(newAppointmentData);
  };

  const confirmPastDateAppointment = () => {
    setPastDateConfirmModalOpen(false);
    createAppointmentMutation.mutate(newAppointmentData);
  };

  const handleSendReminders = () => {
    if (selectedAppointments.length === 0) {
      toast({
        title: t('reminders.toasts.noSelection'),
        description: t('reminders.toasts.selectAppointments'),
        variant: "destructive",
      });
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

  const handleArchiveAppointment = (appointmentId: string) => {
    setArchiveAppointmentId(appointmentId);
    setArchiveConfirmModalOpen(true);
  };

  const confirmArchiveAppointment = () => {
    if (!archiveAppointmentId) return;

    archiveAppointmentMutation.mutate(archiveAppointmentId);
  };

  const handleUnarchiveAppointment = (appointmentId: string) => {
    unarchiveAppointmentMutation.mutate(appointmentId);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAppointments(allAppointments.map(apt => apt.id));
    } else {
      setSelectedAppointments([]);
    }
  };

  const handleSelectAppointment = (appointmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedAppointments(prev => [...prev, appointmentId]);
    } else {
      setSelectedAppointments(prev => prev.filter(id => id !== appointmentId));
    }
  };

  const getCustomerName = (customer?: Customer) => {
    if (!customer) return 'Unknown Customer';
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    } else if (customer.firstName) {
      return customer.firstName;
    } else if (customer.lastName) {
      return customer.lastName;
    }
    return customer.email;
  };

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'no_show': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date));
  };

  const toLocalDateTimeString = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const toLocalDateString = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toLocalTimeString = (date: Date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const mergeDateAndTime = (current: Date, nextDate?: string, nextTime?: string) => {
    const datePart = nextDate ?? toLocalDateString(current);
    const timePart = nextTime ?? toLocalTimeString(current);
    return new Date(`${datePart}T${timePart}`);
  };

  // Check if all appointments are selected
  const isAllSelected = allAppointments.length > 0 && selectedAppointments.length === allAppointments.length;

  // Check if some appointments are selected (for indeterminate state)
  const isSomeSelected = selectedAppointments.length > 0 && selectedAppointments.length < allAppointments.length;

  // Get upcoming appointments (next 7 days) - always use non-archived data
  const upcomingAppointments = upcomingAppointmentsForSidebar.filter(apt => {
    const appointmentDate = new Date(apt.appointmentDate);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return appointmentDate >= now && appointmentDate <= sevenDaysFromNow;
  }).slice(0, 5);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* Page Header with Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('reminders.pageTitle')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('reminders.pageSubtitle')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            aria-label="Settings"
            onClick={() => setSettingsModalOpen(true)}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Appointments Content */}
        <div className="space-y-6">
          {/* Overview and Upcoming Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overview Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('reminders.overview.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('reminders.overview.total')}</span>
                  <Badge variant="outline">{allAppointments.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('reminders.overview.upcoming')}</span>
                  <Badge variant="outline">{upcomingAppointments.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('reminders.overview.confirmed')}</span>
                  <Badge variant="outline">
                    {allAppointments.filter(apt => apt.status === 'confirmed').length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('reminders.overview.remindersSent')}</span>
                  <Badge variant="outline">
                    {allAppointments.filter(apt => apt.reminderSent).length}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t('reminders.overview.upcomingThisWeek')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-4">
                    <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      {t('reminders.appointments.noUpcoming')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {upcomingAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="text-left min-w-0 flex-1 mr-3">
                          <button
                            type="button"
                            onClick={() => handleViewAppointment(appointment)}
                            className="text-sm font-medium text-left hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded block w-full truncate"
                          >
                            {appointment.title}
                          </button>
                          <p className="text-xs text-muted-foreground truncate">
                            {getCustomerName(appointment.customer)} • {formatDateTime(appointment.appointmentDate)}
                          </p>
                        </div>
                        <Badge className={`${getStatusColor(appointment.status)} text-[10px] px-1.5 py-0 h-5 whitespace-nowrap`} variant="outline">
                          {appointment.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Appointments Table with Tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Appointments
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={appointmentsFetching}
                    onClick={async () => {
                      // Invalidate queries to trigger refetch
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['/api/appointments'] }),
                        queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] }),
                        queryClient.invalidateQueries({ queryKey: ['/api/appointment-reminders'] })
                      ]);
                      setLastRefreshedAt(new Date());
                      toast({ title: t('reminders.toasts.success'), description: 'Appointments refreshed' });
                    }}
                    title="Refresh appointments"
                  >
                    <RefreshCw className={`h-4 w-4 ${appointmentsFetching ? 'animate-spin' : ''}`} />
                  </Button>
                  {lastRefreshedAt && (
                    <span className="text-sm text-muted-foreground">
                      Last refreshed: {lastRefreshedAt.toLocaleTimeString()}
                    </span>
                  )}
                  <Dialog open={newAppointmentModalOpen} onOpenChange={setNewAppointmentModalOpen}>
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
                          <Label className={newAppointmentErrors.customerId ? "text-red-500" : ""}>
                            {t('reminders.appointments.customer')} <span className="text-red-500">*</span>
                          </Label>
                          <Select value={newAppointmentData.customerId} onValueChange={(value) => {
                            setNewAppointmentData(prev => ({ ...prev, customerId: value }));
                            setNewAppointmentErrors(prev => ({ ...prev, customerId: false }));
                          }}>
                            <SelectTrigger className={`focus-visible:ring-0 focus:ring-0 ${newAppointmentErrors.customerId ? 'border-red-500' : ''}`}>
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
                          <Label className={newAppointmentErrors.title ? "text-red-500" : ""}>
                            {t('reminders.appointments.title')} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={newAppointmentData.title}
                            onChange={(e) => {
                              setNewAppointmentData(prev => ({ ...prev, title: e.target.value }));
                              setNewAppointmentErrors(prev => ({ ...prev, title: false }));
                            }}
                            placeholder={t('reminders.appointments.titlePlaceholder')}
                            className={`focus-visible:ring-0 ${newAppointmentErrors.title ? 'border-red-500' : ''}`}
                          />
                        </div>

                        <div>
                          <Label>{t('reminders.appointments.dateTime')}</Label>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Input
                              type="date"
                              value={toLocalDateString(newAppointmentData.appointmentDate)}
                              onChange={(e) => setNewAppointmentData(prev => ({
                                ...prev,
                                appointmentDate: mergeDateAndTime(prev.appointmentDate, e.target.value, undefined)
                              }))}
                              className="focus-visible:ring-0"
                            />
                            <Input
                              type="time"
                              value={toLocalTimeString(newAppointmentData.appointmentDate)}
                              onChange={(e) => setNewAppointmentData(prev => ({
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
                            value={newAppointmentData.duration}
                            onChange={(e) => setNewAppointmentData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                            min="15"
                            step="15"
                            className="focus-visible:ring-0"
                          />
                        </div>

                        <div>
                          <Label>{t('reminders.appointments.location')}</Label>
                          <Input
                            value={newAppointmentData.location}
                            onChange={(e) => setNewAppointmentData(prev => ({ ...prev, location: e.target.value }))}
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
                            checked={newAppointmentReminderEnabled}
                            onCheckedChange={(checked) => {
                              setNewAppointmentReminderEnabled(checked);
                              if (checked) {
                                setNewAppointmentReminderModalOpen(true);
                              } else {
                                setNewAppointmentReminderModalOpen(false);
                                setNewAppointmentErrors(prev => ({ ...prev, customMinutesBefore: false }));
                              }
                            }}
                            className="focus-visible:ring-0"
                          />
                          {newAppointmentReminderEnabled && (
                            <button
                              type="button"
                              onClick={() => setNewAppointmentReminderModalOpen(true)}
                              className="text-sm underline text-muted-foreground hover:text-foreground"
                            >
                              {t('common.modify')}
                            </button>
                          )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => {
                            setNewAppointmentModalOpen(false);
                            setNewAppointmentReminderModalOpen(false);
                          }}>
                            {t('reminders.appointments.cancel')}
                          </Button>
                          <Button
                            onClick={handleCreateAppointment}
                            disabled={createAppointmentMutation.isPending}
                          >
                            {t('reminders.appointments.createAppointment')}
                          </Button>
                        </div>
                      </div>

                      <Dialog open={newAppointmentReminderModalOpen} onOpenChange={(open) => {
                        setNewAppointmentReminderModalOpen(open);
                        if (!open) {
                          setNewAppointmentReminderEnabled(false);
                        }
                      }}>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>{t('reminders.scheduleReminder.title')}</DialogTitle>
                            <DialogDescription>
                              {t('reminders.appointments.scheduleDescription')}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div>
                              <Label>{t('reminders.scheduleReminder.reminderType')}</Label>
                              <Select
                                value={newAppointmentReminderData.reminderType}
                                onValueChange={(value: 'email' | 'sms' | 'push') => setNewAppointmentReminderData(prev => ({ ...prev, reminderType: value }))}
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
                                value={newAppointmentReminderData.reminderTiming}
                                onValueChange={(value: 'now' | '5m' | '30m' | '1h' | '5h' | '10h' | 'custom') => setNewAppointmentReminderData(prev => ({ ...prev, reminderTiming: value }))}
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

                            {newAppointmentReminderData.reminderTiming === 'custom' && (
                              <div>
                                <Label className={newAppointmentErrors.customMinutesBefore ? "text-red-500" : ""}>
                                  {t('reminders.scheduleReminder.customMinutesLabel')} <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10080"
                                  placeholder={t('reminders.scheduleReminder.customMinutesPlaceholder')}
                                  value={newAppointmentReminderData.customMinutesBefore || ''}
                                  onChange={(e) => {
                                    setNewAppointmentReminderData(prev => ({
                                      ...prev,
                                      customMinutesBefore: e.target.value ? parseInt(e.target.value) : undefined
                                    }));
                                    setNewAppointmentErrors(prev => ({ ...prev, customMinutesBefore: false }));
                                  }}
                                  className={`focus-visible:ring-0 ${newAppointmentErrors.customMinutesBefore ? 'border-red-500' : ''}`}
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('reminders.scheduleReminder.customMinutesHelp')}</p>
                              </div>
                            )}

                            <div>
                              <Label>Timezone</Label>
                              <Select
                                value={newAppointmentReminderData.timezone}
                                onValueChange={(value) => setNewAppointmentReminderData(prev => ({ ...prev, timezone: value }))}
                              >
                                <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  <SelectItem value="America/New_York">🇺🇸 Eastern Time (ET)</SelectItem>
                                  <SelectItem value="America/Chicago">🇺🇸 Central Time (CT)</SelectItem>
                                  <SelectItem value="America/Denver">🇺🇸 Mountain Time (MT)</SelectItem>
                                  <SelectItem value="America/Los_Angeles">🇺🇸 Pacific Time (PT)</SelectItem>
                                  <SelectItem value="America/Anchorage">🇺🇸 Alaska Time (AKT)</SelectItem>
                                  <SelectItem value="Pacific/Honolulu">🇺🇸 Hawaii Time (HT)</SelectItem>
                                  <SelectItem value="America/Phoenix">🇺🇸 Arizona (MST)</SelectItem>
                                  <SelectItem value="America/Toronto">🇨🇦 Toronto (ET)</SelectItem>
                                  <SelectItem value="America/Vancouver">🇨🇦 Vancouver (PT)</SelectItem>
                                  <SelectItem value="America/Mexico_City">🇲🇽 Mexico City (CST)</SelectItem>
                                  <SelectItem value="Europe/London">🇬🇧 London (GMT/BST)</SelectItem>
                                  <SelectItem value="Europe/Paris">🇫🇷 Paris (CET)</SelectItem>
                                  <SelectItem value="Europe/Berlin">🇩🇪 Berlin (CET)</SelectItem>
                                  <SelectItem value="Europe/Madrid">🇪🇸 Madrid (CET)</SelectItem>
                                  <SelectItem value="Asia/Tokyo">🇯🇵 Tokyo (JST)</SelectItem>
                                  <SelectItem value="Asia/Shanghai">🇨🇳 Shanghai (CST)</SelectItem>
                                  <SelectItem value="Asia/Singapore">🇸🇬 Singapore (SGT)</SelectItem>
                                  <SelectItem value="Asia/Dubai">🇦🇪 Dubai (GST)</SelectItem>
                                  <SelectItem value="Australia/Sydney">🇦🇺 Sydney (AEST)</SelectItem>
                                  <SelectItem value="Australia/Perth">🇦🇺 Perth (AWST)</SelectItem>
                                  <SelectItem value="Pacific/Auckland">🇳🇿 Auckland (NZST)</SelectItem>
                                  <SelectItem value="UTC">🌐 UTC</SelectItem>
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
                                value={newAppointmentReminderData.content}
                                onChange={(e) => setNewAppointmentReminderData(prev => ({ ...prev, content: e.target.value }))}
                                rows={4}
                                className="focus-visible:ring-0"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => {
                              setNewAppointmentReminderModalOpen(false);
                              setNewAppointmentReminderEnabled(false);
                            }}>
                              {t('reminders.appointments.cancel')}
                            </Button>
                            <Button onClick={() => setNewAppointmentReminderModalOpen(false)}>
                              {t('common.save')}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={appointmentsTab} onValueChange={(v) => setAppointmentsTab(v as "upcoming" | "past")} className="w-full">
                <div className="flex items-center justify-between p-4 border-b">
                  <TabsList>
                    <TabsTrigger value="upcoming" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Upcoming
                    </TabsTrigger>
                    <TabsTrigger value="past" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Past
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="upcoming" className="mt-0">
                  {/* Search and Filter Controls */}
                  <div className="flex items-center gap-4 p-6 border-b">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={t('reminders.appointments.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          aria-label="Clear search"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reminders.appointments.allStatuses')}</SelectItem>
                        <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                        <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
                        <SelectItem value="cancelled">{t('reminders.appointments.cancelled')}</SelectItem>
                        <SelectItem value="completed">{t('reminders.appointments.completed')}</SelectItem>
                        <SelectItem value="no_show">{t('reminders.appointments.noShow')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Date Range Filter */}
                    <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`flex items-center gap-2 ${(dateFrom || dateTo) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          <Calendar className="h-4 w-4" />
                          {(dateFrom || dateTo) ? (
                            <span className="text-sm">
                              {dateFrom ? dateFrom.toLocaleDateString() : '...'} - {dateTo ? dateTo.toLocaleDateString() : '...'}
                            </span>
                          ) : (
                            <span className="text-sm">{t('reminders.appointments.filterByDate')}</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start" sideOffset={5} avoidCollisions={true}>
                        {/* Quick Date Range Presets */}
                        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const endOfDay = new Date(today);
                              endOfDay.setHours(23, 59, 59, 999);
                              setDateFrom(today);
                              setDateTo(endOfDay);
                            }}
                            className="text-xs"
                          >
                            Today
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const oneWeekLater = new Date(today);
                              oneWeekLater.setDate(oneWeekLater.getDate() + 7);
                              oneWeekLater.setHours(23, 59, 59, 999);
                              setDateFrom(today);
                              setDateTo(oneWeekLater);
                            }}
                            className="text-xs"
                          >
                            1 Week
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const oneMonthLater = new Date(today);
                              oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
                              oneMonthLater.setHours(23, 59, 59, 999);
                              setDateFrom(today);
                              setDateTo(oneMonthLater);
                            }}
                            className="text-xs"
                          >
                            1 Month
                          </Button>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs font-medium">{t('reminders.appointments.fromDate')}</Label>
                            <Input
                              type="date"
                              value={dateFrom ? dateFrom.toISOString().split('T')[0] : ''}
                              max={dateTo ? dateTo.toISOString().split('T')[0] : undefined}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const date = new Date(e.target.value + 'T00:00:00');
                                  setDateFrom(date);
                                } else {
                                  setDateFrom(undefined);
                                }
                              }}
                              className="w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs font-medium">{t('reminders.appointments.toDate')}</Label>
                            <Input
                              type="date"
                              value={dateTo ? dateTo.toISOString().split('T')[0] : ''}
                              min={dateFrom ? dateFrom.toISOString().split('T')[0] : undefined}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const date = new Date(e.target.value + 'T23:59:59');
                                  setDateTo(date);
                                } else {
                                  setDateTo(undefined);
                                }
                              }}
                              className="w-full"
                            />
                          </div>
                        </div>
                        {(dateFrom || dateTo) && (
                          <div className="mt-4 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDateFrom(undefined);
                                setDateTo(undefined);
                                setDateFilterOpen(false);
                              }}
                              className="w-full"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {t('reminders.appointments.clearDates')}
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>

                    <Button
                      variant={showArchived ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowArchived(prev => !prev);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {showArchived ? 'Viewing Archived' : 'View Archived'}
                    </Button>
                  </div>

                  {/* Bulk Actions */}
                  {selectedAppointments.length > 0 && (
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{selectedAppointments.length} {t('reminders.appointments.selected')}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedAppointments([])}
                        >
                          {t('reminders.appointments.clearSelection')}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSendReminders}
                          disabled={sendReminderMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {t('reminders.appointments.sendReminders')}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="min-h-[400px]">
                    {appointmentsLoading ? (
                      <div className="flex items-center justify-center py-12 min-h-[400px]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                      </div>
                    ) : appointments.length === 0 ? (
                      <div className="text-center py-12 min-h-[400px] flex flex-col items-center justify-center">
                        <Calendar className="h-16 w-16 text-gray-400 mb-4" />
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">{t('reminders.appointments.noAppointments')}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">{t('reminders.appointments.createFirst')}</p>
                        <Button onClick={() => setNewAppointmentModalOpen(true)}>
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          {t('reminders.appointments.createAppointment')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View - hidden on mobile/tablet */}
                        <div className="hidden lg:block overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">
                                  <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Select all appointments"
                                  />
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handleSort('customer')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.customer')}
                                    <SortIcon column="customer" />
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handleSort('title')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.appointment')}
                                    <SortIcon column="title" />
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handleSort('date')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.dateTime')}
                                    <SortIcon column="date" />
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handleSort('status')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.status')}
                                    <SortIcon column="status" />
                                  </div>
                                </TableHead>
                                <TableHead>{t('reminders.table.reminder')}</TableHead>
                                <TableHead>{t('reminders.table.actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(appointmentsFetching || searchQuery !== debouncedSearchQuery) ? (
                                // Skeleton loading rows
                                Array.from({ length: 5 }).map((_, index) => (
                                  <TableRow key={`skeleton-${index}`}>
                                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                    <TableCell>
                                      <div className="space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-40" />
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-2">
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-3 w-24" />
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-2">
                                        <Skeleton className="h-4 w-36" />
                                        <Skeleton className="h-3 w-20" />
                                      </div>
                                    </TableCell>
                                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                appointments.map((appointment) => (
                                  <TableRow
                                    key={appointment.id}
                                    onClick={() => handleViewAppointment(appointment)}
                                    className="cursor-pointer"
                                  >
                                    <TableCell onClick={(event) => event.stopPropagation()}>
                                      <Checkbox
                                        checked={selectedAppointments.includes(appointment.id)}
                                        onCheckedChange={(checked) => handleSelectAppointment(appointment.id, checked as boolean)}
                                      />
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
                                          <p className="text-sm text-gray-500 flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {appointment.location}
                                          </p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{formatDateTime(appointment.appointmentDate)}</p>
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                          <Timer className="h-3 w-3" />
                                          {appointment.duration} {t('reminders.appointments.minutes')}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={getStatusColor(appointment.status)}>
                                        {appointment.status.replace('_', ' ')}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          // Check reminder records for this appointment
                                          const appointmentReminders = reminders.filter(r => r.appointmentId === appointment.id);
                                          const hasSentReminder = appointmentReminders.some(r => r.status === 'sent') || appointment.reminderSent;
                                          const hasPendingReminder = appointmentReminders.some(r => r.status === 'pending');

                                          if (hasSentReminder) {
                                            return (
                                              <div className="flex items-center gap-1 text-green-600">
                                                <CheckCircle className="h-4 w-4" />
                                                <span className="text-sm">{t('reminders.reminderHistory.sent')}</span>
                                              </div>
                                            );
                                          } else if (hasPendingReminder) {
                                            return (
                                              <div className="flex items-center gap-1 text-blue-600">
                                                <Clock className="h-4 w-4" />
                                                <span className="text-sm">Scheduled</span>
                                              </div>
                                            );
                                          } else {
                                            return (
                                              <div className="flex items-center gap-1 text-gray-400">
                                                <Clock className="h-4 w-4" />
                                                <span className="text-sm">{t('reminders.reminderHistory.notSet')}</span>
                                              </div>
                                            );
                                          }
                                        })()}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleEditAppointment(appointment);
                                          }}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleViewAppointment(appointment);
                                          }}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent>
                                            {!showArchived && (
                                              <>
                                                <DropdownMenuItem onClick={() => confirmAppointmentMutation.mutate(appointment.id)}>
                                                  <CheckCircle className="h-4 w-4 mr-2" />
                                                  Confirm Appointment
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => sendReminderMutation.mutate({ appointmentIds: [appointment.id] })}>
                                                  <Send className="h-4 w-4 mr-2" />
                                                  {t('reminders.actions.sendReminder')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openScheduleReminder(appointment.id)}>
                                                  <Clock className="h-4 w-4 mr-2" />
                                                  {t('reminders.actions.scheduleReminder')}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleArchiveAppointment(appointment.id)}>
                                                  <Archive className="h-4 w-4 mr-2" />
                                                  Archive
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleCancelAppointment(appointment.id)}>
                                                  <Trash2 className="h-4 w-4 mr-2" />
                                                  Delete
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                            {showArchived && (
                                              <>
                                                <DropdownMenuItem onClick={() => handleUnarchiveAppointment(appointment.id)}>
                                                  <ArchiveRestore className="h-4 w-4 mr-2" />
                                                  Restore
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleCancelAppointment(appointment.id)}>
                                                  <Trash2 className="h-4 w-4 mr-2" />
                                                  Delete Permanently
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile/Tablet Card View - visible only on mobile/tablet */}
                        <div className="lg:hidden space-y-4">
                          {(appointmentsFetching || searchQuery !== debouncedSearchQuery) ? (
                            // Skeleton loading cards
                            Array.from({ length: 3 }).map((_, index) => (
                              <Card key={`skeleton-card-${index}`} className="overflow-hidden">
                                <CardContent className="p-4">
                                  <div className="space-y-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3">
                                        <Skeleton className="h-4 w-4 mt-1" />
                                        <div className="space-y-2">
                                          <Skeleton className="h-5 w-40" />
                                          <Skeleton className="h-4 w-32" />
                                          <Skeleton className="h-3 w-44" />
                                        </div>
                                      </div>
                                      <Skeleton className="h-6 w-20 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-4" />
                                        <Skeleton className="h-4 w-36" />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-4" />
                                        <Skeleton className="h-4 w-24" />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                      <Skeleton className="h-4 w-20" />
                                      <Skeleton className="h-8 w-8 rounded" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          ) : (
                            appointments.map((appointment) => (
                              <Card
                                key={appointment.id}
                                className="overflow-hidden cursor-pointer"
                                onClick={() => handleViewAppointment(appointment)}
                              >
                                <CardContent className="p-4">
                                  <div className="space-y-3">
                                    {/* Header with checkbox and status */}
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3">
                                        <div onClick={(event) => event.stopPropagation()}>
                                          <Checkbox
                                            checked={selectedAppointments.includes(appointment.id)}
                                            onCheckedChange={(checked) => handleSelectAppointment(appointment.id, checked as boolean)}
                                            className="mt-1"
                                          />
                                        </div>
                                        <div className="flex-1">
                                          <h3 className="font-semibold text-base">{appointment.title}</h3>
                                          <p className="text-sm text-gray-600 dark:text-gray-400">{getCustomerName(appointment.customer)}</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-500">{appointment.customer?.email}</p>
                                        </div>
                                      </div>
                                      <Badge className={getStatusColor(appointment.status)}>
                                        {appointment.status.replace('_', ' ')}
                                      </Badge>
                                    </div>

                                    {/* Appointment details */}
                                    <div className="space-y-2 text-sm">
                                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                        <Calendar className="h-4 w-4 text-gray-500" />
                                        <span>{formatDateTime(appointment.appointmentDate)}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                        <Timer className="h-4 w-4 text-gray-500" />
                                        <span>{appointment.duration} {t('reminders.appointments.minutes')}</span>
                                      </div>
                                      {appointment.location && (
                                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                          <MapPin className="h-4 w-4 text-gray-500" />
                                          <span>{appointment.location}</span>
                                        </div>
                                      )}

                                      {/* Reminder status */}
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const appointmentReminders = reminders.filter(r => r.appointmentId === appointment.id);
                                          const hasSentReminder = appointmentReminders.some(r => r.status === 'sent') || appointment.reminderSent;
                                          const hasPendingReminder = appointmentReminders.some(r => r.status === 'pending');

                                          if (hasSentReminder) {
                                            return (
                                              <div className="flex items-center gap-1 text-green-600">
                                                <CheckCircle className="h-4 w-4" />
                                                <span className="text-sm">{t('reminders.reminderHistory.sent')}</span>
                                              </div>
                                            );
                                          } else if (hasPendingReminder) {
                                            return (
                                              <div className="flex items-center gap-1 text-blue-600">
                                                <Clock className="h-4 w-4" />
                                                <span className="text-sm">Scheduled</span>
                                              </div>
                                            );
                                          } else {
                                            return (
                                              <div className="flex items-center gap-1 text-gray-400">
                                                <Clock className="h-4 w-4" />
                                                <span className="text-sm">{t('reminders.reminderHistory.notSet')}</span>
                                              </div>
                                            );
                                          }
                                        })()}
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pt-2 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleEditAppointment(appointment);
                                        }}
                                        className="flex-1"
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleViewAppointment(appointment);
                                        }}
                                        className="flex-1"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {!showArchived && (
                                            <>
                                              <DropdownMenuItem onClick={() => confirmAppointmentMutation.mutate(appointment.id)}>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirm Appointment
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => sendReminderMutation.mutate({ appointmentIds: [appointment.id] })}>
                                                <Send className="h-4 w-4 mr-2" />
                                                {t('reminders.actions.sendReminder')}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => openScheduleReminder(appointment.id)}>
                                                <Clock className="h-4 w-4 mr-2" />
                                                {t('reminders.actions.scheduleReminder')}
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => handleArchiveAppointment(appointment.id)}>
                                                <Archive className="h-4 w-4 mr-2" />
                                                Archive
                                              </DropdownMenuItem>
                                              <DropdownMenuItem className="text-red-600" onClick={() => handleCancelAppointment(appointment.id)}>
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {showArchived && (
                                            <>
                                              <DropdownMenuItem onClick={() => handleUnarchiveAppointment(appointment.id)}>
                                                <ArchiveRestore className="h-4 w-4 mr-2" />
                                                Restore
                                              </DropdownMenuItem>
                                              <DropdownMenuItem className="text-red-600" onClick={() => handleCancelAppointment(appointment.id)}>
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete Permanently
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </>
                    )}

                  </div>

                  {/* Pagination Controls */}
                  {allAppointments.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Showing {startIndex + 1}-{Math.min(endIndex, totalAppointments)} of {totalAppointments}</span>
                        <span className="hidden sm:inline">•</span>
                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline">Rows per page:</span>
                          <Select value={pageSize.toString()} onValueChange={(value) => {
                            setPageSize(Number(value));
                            setCurrentPage(1);
                          }}>
                            <SelectTrigger className="w-[70px] h-8 focus-visible:ring-0">
                              <SelectValue />
                            </SelectTrigger>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="past" className="mt-0">
                  {/* Past Appointments Search and Filter */}
                  <div className="flex items-center gap-4 p-6 border-b">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search past appointments..."
                        value={pastSearchQuery}
                        onChange={(e) => setPastSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {pastSearchQuery && (
                        <button
                          onClick={() => setPastSearchQuery("")}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          aria-label="Clear search"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Select value={pastStatusFilter} onValueChange={setPastStatusFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reminders.appointments.allStatuses')}</SelectItem>
                        <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                        <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
                        <SelectItem value="cancelled">{t('reminders.appointments.cancelled')}</SelectItem>
                        <SelectItem value="completed">{t('reminders.appointments.completed')}</SelectItem>
                        <SelectItem value="no_show">{t('reminders.appointments.noShow')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Past Appointments Date Range Filter */}
                    <Popover open={pastDateFilterOpen} onOpenChange={setPastDateFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`flex items-center gap-2 ${(pastDateFrom || pastDateTo) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          <Calendar className="h-4 w-4" />
                          {(pastDateFrom || pastDateTo) ? (
                            <span className="text-sm">
                              {pastDateFrom ? pastDateFrom.toLocaleDateString() : '...'} - {pastDateTo ? pastDateTo.toLocaleDateString() : '...'}
                            </span>
                          ) : (
                            <span className="text-sm">{t('reminders.appointments.filterByDate')}</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start" sideOffset={5} avoidCollisions={true}>
                        {/* Quick Date Range Presets for Past */}
                        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              today.setHours(23, 59, 59, 999);
                              const oneWeekAgo = new Date(today);
                              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                              oneWeekAgo.setHours(0, 0, 0, 0);
                              setPastDateFrom(oneWeekAgo);
                              setPastDateTo(today);
                            }}
                            className="text-xs"
                          >
                            Last Week
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              today.setHours(23, 59, 59, 999);
                              const oneMonthAgo = new Date(today);
                              oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                              oneMonthAgo.setHours(0, 0, 0, 0);
                              setPastDateFrom(oneMonthAgo);
                              setPastDateTo(today);
                            }}
                            className="text-xs"
                          >
                            Last Month
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              today.setHours(23, 59, 59, 999);
                              const threeMonthsAgo = new Date(today);
                              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                              threeMonthsAgo.setHours(0, 0, 0, 0);
                              setPastDateFrom(threeMonthsAgo);
                              setPastDateTo(today);
                            }}
                            className="text-xs"
                          >
                            Last 3 Months
                          </Button>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs font-medium">{t('reminders.appointments.fromDate')}</Label>
                            <Input
                              type="date"
                              value={pastDateFrom ? pastDateFrom.toISOString().split('T')[0] : ''}
                              max={pastDateTo ? pastDateTo.toISOString().split('T')[0] : undefined}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const date = new Date(e.target.value + 'T00:00:00');
                                  setPastDateFrom(date);
                                } else {
                                  setPastDateFrom(undefined);
                                }
                              }}
                              className="w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs font-medium">{t('reminders.appointments.toDate')}</Label>
                            <Input
                              type="date"
                              value={pastDateTo ? pastDateTo.toISOString().split('T')[0] : ''}
                              min={pastDateFrom ? pastDateFrom.toISOString().split('T')[0] : undefined}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const date = new Date(e.target.value + 'T23:59:59');
                                  setPastDateTo(date);
                                } else {
                                  setPastDateTo(undefined);
                                }
                              }}
                              className="w-full"
                            />
                          </div>
                        </div>
                        {(pastDateFrom || pastDateTo) && (
                          <div className="mt-4 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPastDateFrom(undefined);
                                setPastDateTo(undefined);
                                setPastDateFilterOpen(false);
                              }}
                              className="w-full"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {t('reminders.appointments.clearDates')}
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="min-h-[400px]">
                    {(appointmentsLoading || pastSearchQuery !== debouncedPastSearchQuery) ? (
                      <div className="flex items-center justify-center py-12 min-h-[400px]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                      </div>
                    ) : pastAppointments.length === 0 ? (
                      <div className="text-center py-12 min-h-[400px] flex flex-col items-center justify-center">
                        <Clock className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">
                          {(debouncedPastSearchQuery || pastStatusFilter !== 'all' || pastDateFrom || pastDateTo)
                            ? 'No past appointments found matching your filters'
                            : 'No past appointments'}
                        </p>
                        {(debouncedPastSearchQuery || pastStatusFilter !== 'all' || pastDateFrom || pastDateTo) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPastSearchQuery("");
                              setPastStatusFilter("all");
                              setPastDateFrom(undefined);
                              setPastDateTo(undefined);
                            }}
                            className="mt-4"
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handlePastSort('customer')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.customer')}
                                    <PastSortIcon column="customer" />
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handlePastSort('title')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.appointment')}
                                    <PastSortIcon column="title" />
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handlePastSort('date')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.dateTime')}
                                    <PastSortIcon column="date" />
                                  </div>
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50 select-none"
                                  onClick={() => handlePastSort('status')}
                                >
                                  <div className="flex items-center">
                                    {t('reminders.table.status')}
                                    <PastSortIcon column="status" />
                                  </div>
                                </TableHead>
                                <TableHead>{t('reminders.table.actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pastAppointments.map((appointment) => (
                                <TableRow
                                  key={appointment.id}
                                  onClick={() => handleViewAppointment(appointment)}
                                  className="cursor-pointer"
                                >
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
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {appointment.location}
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{formatDateTime(appointment.appointmentDate)}</p>
                                      <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <Timer className="h-3 w-3" />
                                        {appointment.duration} {t('reminders.appointments.minutes')}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getStatusColor(appointment.status)}>
                                      {appointment.status.replace('_', ' ')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleViewAppointment(appointment);
                                        }}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile/Tablet Card View */}
                        <div className="lg:hidden space-y-4 p-4">
                          {pastAppointments.map((appointment) => (
                            <Card
                              key={appointment.id}
                              className="overflow-hidden cursor-pointer"
                              onClick={() => handleViewAppointment(appointment)}
                            >
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-base">{appointment.title}</h3>
                                      <p className="text-sm text-gray-600 dark:text-gray-400">{getCustomerName(appointment.customer)}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-500">{appointment.customer?.email}</p>
                                    </div>
                                    <Badge className={getStatusColor(appointment.status)}>
                                      {appointment.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                      <Calendar className="h-4 w-4 text-gray-500" />
                                      <span>{formatDateTime(appointment.appointmentDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                      <Timer className="h-4 w-4 text-gray-500" />
                                      <span>{appointment.duration} {t('reminders.appointments.minutes')}</span>
                                    </div>
                                    {appointment.location && (
                                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                        <MapPin className="h-4 w-4 text-gray-500" />
                                        <span>{appointment.location}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Pagination Controls for Past Appointments */}
                  {pastAppointmentsAll.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Showing {pastStartIndex + 1}-{Math.min(pastEndIndex, totalPastAppointments)} of {totalPastAppointments}</span>
                        <span className="hidden sm:inline">•</span>
                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline">Rows per page:</span>
                          <Select value={pastPageSize.toString()} onValueChange={(value) => {
                            setPastPageSize(Number(value));
                            setPastCurrentPage(1);
                          }}>
                            <SelectTrigger className="w-[70px] h-8 focus-visible:ring-0">
                              <SelectValue />
                            </SelectTrigger>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPastCurrentPage(1)}
                          disabled={pastCurrentPage === 1}
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPastCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={pastCurrentPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm px-2">
                          Page {pastCurrentPage} of {totalPastPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPastCurrentPage(prev => Math.min(totalPastPages, prev + 1))}
                          disabled={pastCurrentPage === totalPastPages}
                        >
                          Next
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPastCurrentPage(totalPastPages)}
                          disabled={pastCurrentPage === totalPastPages}
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Schedule Reminder Modal */}
        <Dialog open={scheduleReminderModalOpen} onOpenChange={setScheduleReminderModalOpen}>
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
                <Select value={scheduleData.reminderType} onValueChange={(v) => setScheduleData(prev => ({ ...prev, reminderType: v as any }))}>
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
                  onValueChange={(v) => {
                    const timing = v as '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
                    setScheduleData(prev => ({
                      ...prev,
                      reminderTiming: timing,
                      customMinutesBefore: timing === 'custom' ? prev.customMinutesBefore : undefined,
                      scheduledFor: timing === 'custom' ? prev.scheduledFor : computeScheduledFor(timing)
                    }));
                  }}
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
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value);
                      if (!isNaN(minutes) && minutes > 0 && minutes <= 10080) {
                        setScheduleData(prev => ({
                          ...prev,
                          customMinutesBefore: minutes,
                          scheduledFor: computeScheduledFor('custom', minutes)
                        }));
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('reminders.scheduleReminder.customMinutesHelp')}
                  </p>
                </div>
              )}
              <div>
                <Label>Timezone</Label>
                <Select value={scheduleData.timezone} onValueChange={(v) => setScheduleData(prev => ({ ...prev, timezone: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="America/New_York">🇺🇸 Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">🇺🇸 Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">🇺🇸 Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">🇺🇸 Pacific Time (PT)</SelectItem>
                    <SelectItem value="America/Anchorage">🇺🇸 Alaska Time (AKT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">🇺🇸 Hawaii Time (HT)</SelectItem>
                    <SelectItem value="America/Phoenix">🇺🇸 Arizona (MST)</SelectItem>
                    <SelectItem value="America/Toronto">🇨🇦 Toronto (ET)</SelectItem>
                    <SelectItem value="America/Vancouver">🇨🇦 Vancouver (PT)</SelectItem>
                    <SelectItem value="America/Mexico_City">🇲🇽 Mexico City (CST)</SelectItem>
                    <SelectItem value="Europe/London">🇬🇧 London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Paris">🇫🇷 Paris (CET)</SelectItem>
                    <SelectItem value="Europe/Berlin">🇩🇪 Berlin (CET)</SelectItem>
                    <SelectItem value="Europe/Madrid">🇪🇸 Madrid (CET)</SelectItem>
                    <SelectItem value="Asia/Tokyo">🇯🇵 Tokyo (JST)</SelectItem>
                    <SelectItem value="Asia/Shanghai">🇨🇳 Shanghai (CST)</SelectItem>
                    <SelectItem value="Asia/Singapore">🇸🇬 Singapore (SGT)</SelectItem>
                    <SelectItem value="Asia/Dubai">🇦🇪 Dubai (GST)</SelectItem>
                    <SelectItem value="Australia/Sydney">🇦🇺 Sydney (AEST)</SelectItem>
                    <SelectItem value="Australia/Perth">🇦🇺 Perth (AWST)</SelectItem>
                    <SelectItem value="Pacific/Auckland">🇳🇿 Auckland (NZST)</SelectItem>
                    <SelectItem value="UTC">🌐 UTC</SelectItem>
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setScheduleReminderModalOpen(false)}>{t('reminders.scheduleReminder.cancel')}</Button>
                <Button
                  onClick={() => {
                    if (scheduleData.scheduledFor < new Date()) {
                      toast({
                        title: t('reminders.toasts.validationError'),
                        description: "Reminder time cannot be in the past",
                        variant: "destructive",
                      });
                      return;
                    }
                    createScheduledReminderMutation.mutate({ appointmentId: scheduleAppointmentId, data: scheduleData });
                  }}
                  disabled={createScheduledReminderMutation.isPending || !scheduleAppointmentId}
                >
                  {createScheduledReminderMutation.isPending ? t('reminders.scheduleReminder.scheduling') : t('reminders.scheduleReminder.schedule')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Appointment Modal */}
        <Dialog open={editAppointmentModalOpen} onOpenChange={setEditAppointmentModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{t('reminders.appointments.editAppointment')}</DialogTitle>
              <DialogDescription>
                {t('reminders.appointments.editDescription')}
              </DialogDescription>
            </DialogHeader>
            {editingAppointment && (
              <>
                <div className="space-y-4 overflow-y-auto flex-1">
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
                        <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                        <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
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
                      checked={editAppointmentReminderEnabled}
                      onCheckedChange={(checked) => {
                        setEditAppointmentReminderEnabled(checked);
                        if (checked) {
                          setEditAppointmentReminderModalOpen(true);
                        } else {
                          setEditAppointmentReminderModalOpen(false);
                          setEditAppointmentErrors(prev => ({ ...prev, customMinutesBefore: false }));
                        }
                      }}
                      className="focus-visible:ring-0"
                    />
                    {editAppointmentReminderEnabled && (
                      <button
                        type="button"
                        onClick={() => setEditAppointmentReminderModalOpen(true)}
                        className="text-sm underline text-muted-foreground hover:text-foreground"
                      >
                        {t('common.modify')}
                      </button>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                      setEditAppointmentModalOpen(false);
                      setEditAppointmentReminderModalOpen(false);
                    }}>
                      {t('reminders.appointments.cancel')}
                    </Button>
                    <Button
                      onClick={handleUpdateAppointment}
                      disabled={updateAppointmentMutation.isPending}
                    >
                      {updateAppointmentMutation.isPending ? t('reminders.appointments.saving') : t('reminders.appointments.saveChanges')}
                    </Button>
                  </div>
                </div>

                <Dialog open={editAppointmentReminderModalOpen} onOpenChange={(open) => {
                  setEditAppointmentReminderModalOpen(open);
                  if (!open) {
                    setEditAppointmentReminderEnabled(false);
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
                          value={editAppointmentReminderData.reminderType}
                          onValueChange={(value: 'email' | 'sms' | 'push') => setEditAppointmentReminderData(prev => ({ ...prev, reminderType: value }))}
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
                          value={editAppointmentReminderData.reminderTiming}
                          onValueChange={(value: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom') => setEditAppointmentReminderData(prev => ({ ...prev, reminderTiming: value }))}
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

                      {editAppointmentReminderData.reminderTiming === 'custom' && (
                        <div>
                          <Label className={editAppointmentErrors.customMinutesBefore ? "text-red-500" : ""}>
                            {t('reminders.scheduleReminder.customMinutesLabel')} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max="10080"
                            placeholder={t('reminders.scheduleReminder.customMinutesPlaceholder')}
                            value={editAppointmentReminderData.customMinutesBefore || ''}
                            onChange={(e) => {
                              setEditAppointmentReminderData(prev => ({
                                ...prev,
                                customMinutesBefore: e.target.value ? parseInt(e.target.value) : undefined
                              }));
                              setEditAppointmentErrors(prev => ({ ...prev, customMinutesBefore: false }));
                            }}
                            className={`focus-visible:ring-0 ${editAppointmentErrors.customMinutesBefore ? 'border-red-500' : ''}`}
                          />
                          <p className="text-xs text-gray-500 mt-1">{t('reminders.scheduleReminder.customMinutesHelp')}</p>
                        </div>
                      )}

                      <div>
                        <Label>Timezone</Label>
                        <Select
                          value={editAppointmentReminderData.timezone}
                          onValueChange={(value) => setEditAppointmentReminderData(prev => ({ ...prev, timezone: value }))}
                        >
                          <SelectTrigger className="focus-visible:ring-0 focus:ring-0">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="America/New_York">🇺🇸 Eastern Time (ET)</SelectItem>
                            <SelectItem value="America/Chicago">🇺🇸 Central Time (CT)</SelectItem>
                            <SelectItem value="America/Denver">🇺🇸 Mountain Time (MT)</SelectItem>
                            <SelectItem value="America/Los_Angeles">🇺🇸 Pacific Time (PT)</SelectItem>
                            <SelectItem value="America/Anchorage">🇺🇸 Alaska Time (AKT)</SelectItem>
                            <SelectItem value="Pacific/Honolulu">🇺🇸 Hawaii Time (HT)</SelectItem>
                            <SelectItem value="America/Phoenix">🇺🇸 Arizona (MST)</SelectItem>
                            <SelectItem value="America/Toronto">🇨🇦 Toronto (ET)</SelectItem>
                            <SelectItem value="America/Vancouver">🇨🇦 Vancouver (PT)</SelectItem>
                            <SelectItem value="America/Mexico_City">🇲🇽 Mexico City (CST)</SelectItem>
                            <SelectItem value="Europe/London">🇬🇧 London (GMT/BST)</SelectItem>
                            <SelectItem value="Europe/Paris">🇫🇷 Paris (CET)</SelectItem>
                            <SelectItem value="Europe/Berlin">🇩🇪 Berlin (CET)</SelectItem>
                            <SelectItem value="Europe/Madrid">🇪🇸 Madrid (CET)</SelectItem>
                            <SelectItem value="Asia/Tokyo">🇯🇵 Tokyo (JST)</SelectItem>
                            <SelectItem value="Asia/Shanghai">🇨🇳 Shanghai (CST)</SelectItem>
                            <SelectItem value="Asia/Singapore">🇸🇬 Singapore (SGT)</SelectItem>
                            <SelectItem value="Asia/Dubai">🇦🇪 Dubai (GST)</SelectItem>
                            <SelectItem value="Australia/Sydney">🇦🇺 Sydney (AEST)</SelectItem>
                            <SelectItem value="Australia/Perth">🇦🇺 Perth (AWST)</SelectItem>
                            <SelectItem value="Pacific/Auckland">🇳🇿 Auckland (NZST)</SelectItem>
                            <SelectItem value="UTC">🌐 UTC</SelectItem>
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
                          value={editAppointmentReminderData.content}
                          onChange={(e) => setEditAppointmentReminderData(prev => ({ ...prev, content: e.target.value }))}
                          rows={4}
                          className="focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => {
                        setEditAppointmentReminderModalOpen(false);
                        setEditAppointmentReminderEnabled(false);
                      }}>
                        {t('reminders.appointments.cancel')}
                      </Button>
                      <Button onClick={() => setEditAppointmentReminderModalOpen(false)}>
                        {t('common.save')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Appointment Confirmation Modal */}
        <Dialog open={cancelConfirmModalOpen} onOpenChange={setCancelConfirmModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Delete Appointment
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this appointment? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-medium">{appointments.find(apt => apt.id === cancelAppointmentId)?.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getCustomerName(appointments.find(apt => apt.id === cancelAppointmentId)?.customer)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {cancelAppointmentId && formatDateTime(appointments.find(apt => apt.id === cancelAppointmentId)?.appointmentDate || new Date())}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCancelConfirmModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmCancelAppointment}
                  disabled={cancelAppointmentMutation.isPending}
                >
                  {cancelAppointmentMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Archive Appointment Confirmation Modal */}
        <Dialog open={archiveConfirmModalOpen} onOpenChange={setArchiveConfirmModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Archive Appointment
              </DialogTitle>
              <DialogDescription>
                This appointment will be moved to the archive. You can restore it later if needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-medium">{appointments.find(apt => apt.id === archiveAppointmentId)?.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getCustomerName(appointments.find(apt => apt.id === archiveAppointmentId)?.customer)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {archiveAppointmentId && formatDateTime(appointments.find(apt => apt.id === archiveAppointmentId)?.appointmentDate || new Date())}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setArchiveConfirmModalOpen(false);
                  setArchiveAppointmentId("");
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmArchiveAppointment}
                  disabled={archiveAppointmentMutation.isPending}
                >
                  {archiveAppointmentMutation.isPending ? 'Archiving...' : 'Archive'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Past Date Confirmation Modal */}
        <Dialog open={pastDateConfirmModalOpen} onOpenChange={setPastDateConfirmModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Past Date Warning
              </DialogTitle>
              <DialogDescription>
                You are scheduling an appointment for a date in the past. Are you sure you want to continue?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="font-medium">{newAppointmentData.title || 'Untitled Appointment'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Scheduled for: {formatDateTime(newAppointmentData.appointmentDate)}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  This date is in the past
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPastDateConfirmModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmPastDateAppointment}
                  disabled={createAppointmentMutation.isPending}
                >
                  {createAppointmentMutation.isPending ? 'Creating...' : 'Create Anyway'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Appointment Side Panel */}
        <Sheet open={viewAppointmentPanelOpen} onOpenChange={setViewAppointmentPanelOpen}>
          <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0">
            {viewingAppointment && (
              <>
                <div className="flex-1 overflow-y-auto p-6 pb-24">
                  <div>
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {t('reminders.details.title')}
                      </SheetTitle>
                      <SheetDescription>
                        {t('reminders.details.viewDescription')}
                      </SheetDescription>
                    </SheetHeader>

                    <Tabs value={viewAppointmentTab} onValueChange={(value) => setViewAppointmentTab(value as "details" | "notes")} className="mt-6">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details">{t('reminders.details.tabs.details')}</TabsTrigger>
                        <TabsTrigger value="notes">
                          {t('reminders.details.tabs.notes')}
                          {notesData?.notes && notesData.notes.length > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {notesData.notes.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="details" className="space-y-6 mt-6 focus-visible:outline-none focus-visible:ring-0">
                        {/* Customer Information */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                              <Users className="h-3.5 w-3.5" />
                              {t('reminders.details.customerInfo')}
                            </h3>
                            {viewingAppointment.customer?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-primary transition-colors"
                                onClick={() => setCustomerProfilePanelOpen(true)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Profile
                              </Button>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-foreground">{getCustomerName(viewingAppointment.customer)}</p>
                                <p className="text-sm text-muted-foreground">{viewingAppointment.customer?.email || 'N/A'}</p>
                              </div>
                            </div>

                            {showExpandedCustomerInfo && (
                              <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{viewingAppointment.customer?.phoneNumber || 'No phone'}</span>
                                </div>
                                {viewingAppointment.customer?.address && (
                                  <p className="text-sm text-muted-foreground">
                                    {viewingAppointment.customer.address}
                                    {(viewingAppointment.customer.city || viewingAppointment.customer.state || viewingAppointment.customer.zipCode) && (
                                      <>, {[viewingAppointment.customer.city, viewingAppointment.customer.state, viewingAppointment.customer.zipCode].filter(Boolean).join(', ')}</>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}

                            <button
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowExpandedCustomerInfo(!showExpandedCustomerInfo)}
                            >
                              {showExpandedCustomerInfo ? 'Show less' : 'Show more'}
                            </button>
                          </div>
                        </div>

                        {/* Appointment Details */}
                        <div className="space-y-3 pt-4 border-t">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {t('reminders.details.appointmentDetails')}
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <p className="font-semibold text-lg text-foreground">{viewingAppointment.title}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">{t('reminders.appointments.dateTime')}</p>
                                <p className="text-sm text-foreground">{formatDateTime(viewingAppointment.appointmentDate)}</p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">{t('reminders.appointments.status')}</p>
                                <Select
                                  value={viewingAppointment.status}
                                  onValueChange={(value: Appointment['status']) => {
                                    updateAppointmentMutation.mutate(
                                      { id: viewingAppointment.id, data: { status: value } },
                                      {
                                        onSuccess: () => {
                                          setViewingAppointment(prev => prev ? { ...prev, status: value } : null);
                                        }
                                      }
                                    );
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-full text-xs bg-transparent border-muted hover:bg-muted/30 transition-colors">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                                    <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
                                    <SelectItem value="completed">{t('reminders.appointments.completed')}</SelectItem>
                                    <SelectItem value="cancelled">{t('reminders.appointments.cancelled')}</SelectItem>
                                    <SelectItem value="no_show">{t('reminders.appointments.noShow')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">{t('reminders.appointments.duration')}</p>
                                <p className="text-sm text-foreground flex items-center gap-1.5">
                                  <Timer className="h-3 w-3 text-muted-foreground" />
                                  {viewingAppointment.duration} {t('reminders.appointments.minutes')}
                                </p>
                              </div>

                              {viewingAppointment.location && (
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">{t('reminders.appointments.location')}</p>
                                  <p className="text-sm text-foreground flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    {viewingAppointment.location}
                                  </p>
                                </div>
                              )}

                              {viewingAppointment.serviceType && (
                                <div className="col-span-2 space-y-1">
                                  <p className="text-xs text-muted-foreground">{t('reminders.details.serviceType')}</p>
                                  <span className="text-sm text-foreground">{viewingAppointment.serviceType}</span>
                                </div>
                              )}
                            </div>

                            {viewingAppointment.description && (
                              <div className="pt-3 border-t border-dashed space-y-1">
                                <p className="text-xs text-muted-foreground">{t('reminders.details.descriptionLabel')}</p>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                  {viewingAppointment.description}
                                </p>
                              </div>
                            )}

                          </div>
                        </div>

                        {/* Reminder Status */}
                        <div className="space-y-3 pt-4 border-t">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Bell className="h-3.5 w-3.5" />
                            {t('reminders.details.reminderStatus')}
                          </h3>
                          <div className="space-y-3">
                            {(() => {
                              const appointmentReminders = reminders.filter(r => r.appointmentId === viewingAppointment.id);
                              const sentReminders = appointmentReminders.filter(r => r.status === 'sent');
                              const pendingReminders = appointmentReminders.filter(r => r.status === 'pending');
                              const hasSentReminder = sentReminders.length > 0 || viewingAppointment.reminderSent;

                              return (
                                <>
                                  {/* Overall Status */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm text-foreground">{t('reminders.details.reminderSent')}</p>
                                      {hasSentReminder ? (
                                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3" />
                                          {t('common.yes')}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <XCircle className="h-3 w-3" />
                                          {t('common.no')}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Show sent at time directly under Reminder Sent */}
                                    {hasSentReminder && (
                                      <div className="pl-0.5 space-y-1">
                                        {sentReminders.length > 0 ? (
                                          sentReminders.map((reminder) => (
                                            <div key={reminder.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                              <span className="capitalize">{reminder.reminderType} • {reminder.reminderTiming === 'custom' ? `${reminder.customMinutesBefore}m before` : reminder.reminderTiming}</span>
                                              {reminder.sentAt && (
                                                <span>{formatDateTime(reminder.sentAt)}</span>
                                              )}
                                            </div>
                                          ))
                                        ) : viewingAppointment.reminderSentAt ? (
                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{t('reminders.details.sentAt')}</span>
                                            <span>{formatDateTime(viewingAppointment.reminderSentAt)}</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>

                                  {/* Scheduled/Pending Reminders Details */}
                                  {pendingReminders.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                      <p className="text-xs text-blue-600 dark:text-blue-500">Scheduled ({pendingReminders.length})</p>
                                      {pendingReminders.map((reminder) => (
                                        <div key={reminder.id} className="flex items-center justify-between py-1.5">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs capitalize text-foreground">{reminder.reminderType}</span>
                                            <span className="text-xs text-muted-foreground">• {reminder.reminderTiming === 'custom' ? `${reminder.customMinutesBefore}m before` : reminder.reminderTiming}</span>
                                          </div>
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDateTime(reminder.scheduledFor)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* No reminders message */}
                                  {appointmentReminders.length === 0 && !viewingAppointment.reminderSent && (
                                    <div className="py-4 text-center">
                                      <BellOff className="h-5 w-5 mx-auto text-muted-foreground/40 mb-1" />
                                      <p className="text-xs text-muted-foreground">No reminders configured</p>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Confirmation Status */}
                        <div className="space-y-3 pt-4 border-t">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {t('reminders.details.confirmationStatus')}
                          </h3>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-foreground">{t('reminders.details.confirmed')}</p>
                              {viewingAppointment.confirmationReceived ? (
                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {t('common.yes')}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <XCircle className="h-3 w-3" />
                                  {t('common.no')}
                                </span>
                              )}
                            </div>
                            {viewingAppointment.confirmationReceivedAt && (
                              <div className="flex items-center justify-between py-1">
                                <p className="text-xs text-muted-foreground">{t('reminders.details.confirmedAt')}</p>
                                <p className="text-xs text-foreground">{formatDateTime(viewingAppointment.confirmationReceivedAt)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-3 pt-4 border-t">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Info className="h-3.5 w-3.5" />
                            {t('reminders.details.metadata')}
                          </h3>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">{t('reminders.details.created')}</span>
                              <span className="text-foreground">{formatDateTime(viewingAppointment.createdAt)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">{t('reminders.details.lastUpdated')}</span>
                              <span className="text-foreground">{formatDateTime(viewingAppointment.updatedAt)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">{t('reminders.details.appointmentId')}</span>
                              <span className="font-mono text-[10px] text-muted-foreground select-all">{viewingAppointment.id}</span>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="notes" className="space-y-6 mt-6 focus-visible:outline-none focus-visible:ring-0">
                        {/* Legacy Notes (single field) */}
                        {viewingAppointment.notes && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              {t('reminders.details.quickNotes')}
                            </h3>
                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                              <p className="text-sm whitespace-pre-wrap">{viewingAppointment.notes}</p>
                            </div>
                          </div>
                        )}

                        {/* Appointment Notes (multiple entries) */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <StickyNote className="h-4 w-4" />
                            {t('reminders.details.appointmentNotes')}
                            {notesData?.notes && notesData.notes.length > 0 && (
                              <Badge variant="secondary" className="ml-1 text-xs">
                                {notesData.notes.length}
                              </Badge>
                            )}
                          </h3>

                          {/* Add new note form */}
                          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                            <Textarea
                              placeholder={t('reminders.details.addNotePlaceholder')}
                              value={newNoteContent}
                              onChange={(e) => setNewNoteContent(e.target.value)}
                              rows={3}
                              className="resize-none focus-visible:ring-0"
                            />
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (newNoteContent.trim() && viewingAppointment?.id) {
                                    createNoteMutation.mutate({
                                      appointmentId: viewingAppointment.id,
                                      content: newNoteContent.trim(),
                                    });
                                  }
                                }}
                                disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                              >
                                {createNoteMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('reminders.details.adding')}
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('reminders.details.addNote')}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Notes list */}
                          {notesLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                          ) : notesData?.notes && notesData.notes.length > 0 ? (
                            <div className="space-y-3">
                              {notesData.notes.map((note) => (
                                <div key={note.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                                  {editingNoteId === note.id ? (
                                    <>
                                      <Textarea
                                        value={editingNoteContent}
                                        onChange={(e) => setEditingNoteContent(e.target.value)}
                                        rows={3}
                                        className="resize-none focus-visible:ring-0"
                                        autoFocus
                                      />
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingNoteId(null);
                                            setEditingNoteContent("");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            if (editingNoteContent.trim()) {
                                              updateNoteMutation.mutate({
                                                noteId: note.id,
                                                content: editingNoteContent.trim(),
                                              });
                                            }
                                          }}
                                          disabled={!editingNoteContent.trim() || updateNoteMutation.isPending}
                                        >
                                          {updateNoteMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            'Save'
                                          )}
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          <span>
                                            {note.user?.firstName && note.user?.lastName
                                              ? `${note.user.firstName} ${note.user.lastName}`
                                              : note.user?.name || 'Unknown'}
                                          </span>
                                          <span className="mx-1">•</span>
                                          <span>{new Date(note.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                          })}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={() => {
                                              setEditingNoteId(note.id);
                                              setEditingNoteContent(note.content);
                                            }}
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => deleteNoteMutation.mutate(note.id)}
                                            disabled={deleteNoteMutation.isPending}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                              {t('reminders.details.noNotes')}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t bg-background/80 backdrop-blur-md shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.1)]">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {new Date(viewingAppointment.appointmentDate) < new Date() ? (
                      <Button
                        className="flex-1 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                        onClick={() => {
                          setViewAppointmentPanelOpen(false);
                          // Copy appointment details to new appointment form
                          setNewAppointmentData({
                            customerId: viewingAppointment.customerId || "",
                            title: viewingAppointment.title,
                            description: viewingAppointment.description || "",
                            appointmentDate: new Date(),
                            duration: viewingAppointment.duration,
                            location: viewingAppointment.location || "",
                            serviceType: viewingAppointment.serviceType || "",
                            status: 'scheduled' as const,
                            notes: "",
                          });
                          setNewAppointmentModalOpen(true);
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('reminders.details.createNewAppointment')}
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                        onClick={() => {
                          setViewAppointmentPanelOpen(false);
                          handleEditAppointment(viewingAppointment);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {t('reminders.details.editAppointment')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1 sm:flex-none sm:w-1/3 hover:bg-muted/50 transition-colors active:scale-[0.98]"
                      onClick={() => setViewAppointmentPanelOpen(false)}
                    >
                      {t('reminders.details.close')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Settings Modal */}
        <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('reminders.settings.title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{t('reminders.settings.enableAutomatic')}</Label>
                    <p className="text-sm text-gray-600">
                      {t('reminders.settings.enableAutomaticDescription')}
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-base font-medium">{t('reminders.settings.defaultSettings')}</Label>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">{t('reminders.settings.sendReminder')}</Label>
                      <Select defaultValue="24h">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24h">{t('reminders.settings.24hBefore')}</SelectItem>
                          <SelectItem value="1h">{t('reminders.settings.1hBefore')}</SelectItem>
                          <SelectItem value="30m">{t('reminders.settings.30mBefore')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">{t('reminders.settings.reminderMethod')}</Label>
                      <Select defaultValue="email">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">{t('reminders.settings.email')}</SelectItem>
                          <SelectItem value="sms">{t('reminders.settings.sms')}</SelectItem>
                          <SelectItem value="both">{t('reminders.settings.both')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-base font-medium">{t('reminders.settings.emailTemplate')}</Label>
                  <Textarea
                    placeholder={t('reminders.settings.emailTemplatePlaceholder')}
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">
                    {t('reminders.settings.availableVariables')}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Customer Profile Side Panel */}
        <ContactViewDrawer
          contactId={viewingAppointment?.customer?.id || null}
          open={customerProfilePanelOpen}
          onOpenChange={setCustomerProfilePanelOpen}
        />
      </div>
    </div>
  );
}
