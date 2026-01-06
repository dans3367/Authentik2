import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  LayoutDashboard
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Types based on our schema
interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "active" | "unsubscribed" | "bounced" | "pending";
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

export default function RemindersPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"appointments" | "reminders" | "settings">("appointments");
  
  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('reminders.pageTitle'), icon: Bell }
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [newAppointmentModalOpen, setNewAppointmentModalOpen] = useState(false);
  const [newAppointmentReminderModalOpen, setNewAppointmentReminderModalOpen] = useState(false);
  const [editAppointmentModalOpen, setEditAppointmentModalOpen] = useState(false);
  const [editAppointmentReminderModalOpen, setEditAppointmentReminderModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
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
    reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
    customMinutesBefore?: number;
    content?: string;
  }>({
    reminderType: 'email',
    reminderTiming: '1h',
    customMinutesBefore: undefined,
    content: '',
  });
  const [editAppointmentReminderEnabled, setEditAppointmentReminderEnabled] = useState(false);
  const [editAppointmentReminderData, setEditAppointmentReminderData] = useState<{
    reminderType: 'email' | 'sms' | 'push';
    reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
    customMinutesBefore?: number;
    content?: string;
  }>({
    reminderType: 'email',
    reminderTiming: '1h',
    customMinutesBefore: undefined,
    content: '',
  });
  const [editAppointmentErrors, setEditAppointmentErrors] = useState<{
    customMinutesBefore?: boolean;
  }>({});

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
    mutationFn: async ({ appointmentId, data }: { appointmentId: string; data: { reminderType: 'email' | 'sms' | 'push'; reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom'; customMinutesBefore?: number; scheduledFor: Date; content?: string } }) => {
      const response = await apiRequest('POST', '/api/appointment-reminders', {
        appointmentId,
        reminderType: data.reminderType,
        reminderTiming: data.reminderTiming,
        customMinutesBefore: data.customMinutesBefore,
        scheduledFor: data.scheduledFor,
        content: data.content,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('reminders.toasts.success'), description: t('reminders.toasts.reminderScheduled') });
      setScheduleReminderModalOpen(false);
      setScheduleAppointmentId("");
      refetchReminders();
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
    content: string;
  }>({
    reminderType: 'email',
    reminderTiming: '1h',
    scheduledFor: new Date(),
    content: ''
  });

  // Cancel appointment confirmation state
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string>("");
  const [cancelConfirmModalOpen, setCancelConfirmModalOpen] = useState(false);

  // Fetch appointments
  const { 
    data: appointmentsData,
    isLoading: appointmentsLoading,
    refetch: refetchAppointments 
  } = useQuery<{appointments: Appointment[]}>({
    queryKey: ['/api/appointments', searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await apiRequest('GET', `/api/appointments?${params.toString()}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch customers for appointment creation
  const { data: customersData } = useQuery<{contacts: Customer[]}>({
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
  } = useQuery<{reminders: AppointmentReminder[]}>({
    queryKey: ['/api/appointment-reminders'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/appointment-reminders');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const appointments: Appointment[] = appointmentsData?.appointments || [];
  const customers: Customer[] = customersData?.contacts || [];
  const reminders: AppointmentReminder[] = remindersData?.reminders || [];

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
      const response = await apiRequest('PATCH', `/api/appointments/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('reminders.toasts.success'),
        description: t('reminders.toasts.appointmentUpdated'),
      });
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
      refetchAppointments();
      
      // Schedule reminder if enabled
      if (newAppointmentReminderEnabled && data.appointment) {
        const appointmentDate = new Date(data.appointment.appointmentDate);
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
        
        createScheduledReminderMutation.mutate({
          appointmentId: data.appointment.id,
          data: {
            reminderType: newAppointmentReminderData.reminderType,
            reminderTiming: newAppointmentReminderData.reminderTiming,
            customMinutesBefore: newAppointmentReminderData.customMinutesBefore,
            scheduledFor,
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
        description: t('reminders.toasts.appointmentCancelled'),
      });
      refetchAppointments();
      refetchReminders();
      setSelectedAppointments(prev => prev.filter(id => id !== cancelAppointmentId));
    },
    onError: (error: any) => {
      toast({
        title: t('reminders.toasts.error'),
        description: error?.message || t('reminders.toasts.appointmentCancelError'),
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
      content: '',
    });
  };

  const openScheduleReminder = (appointmentId: string) => {
    const apt = appointments.find(a => a.id === appointmentId);
    const baseDate = apt ? new Date(apt.appointmentDate) : new Date();
    const defaultScheduled = new Date(baseDate.getTime() - 1 * 60 * 60 * 1000); // default 1h before
    setScheduleAppointmentId(appointmentId);
    setScheduleData({ reminderType: 'email', reminderTiming: '1h', scheduledFor: defaultScheduled, content: '' });
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
        content: existingReminder.content || '',
      });
    } else {
      setEditAppointmentReminderEnabled(false);
      setEditAppointmentReminderModalOpen(false);
      setEditAppointmentReminderData({
        reminderType: 'email',
        reminderTiming: '1h',
        customMinutesBefore: undefined,
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
    const appointmentStatus = editAppointmentReminderEnabled ? 'scheduled' : editingAppointment.status;
    
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAppointments(appointments.map(apt => apt.id));
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

  // Check if all appointments are selected
  const isAllSelected = appointments.length > 0 && selectedAppointments.length === appointments.length;
  
  // Check if some appointments are selected (for indeterminate state)
  const isSomeSelected = selectedAppointments.length > 0 && selectedAppointments.length < appointments.length;

  // Get upcoming appointments (next 7 days)
  const upcomingAppointments = appointments.filter(apt => {
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label="Reminders info"
              >
                <Info className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96">
              <div className="space-y-2">
                <div className="font-semibold leading-none tracking-tight">
                  {t('reminders.title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('reminders.subtitle')}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === "appointments" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("appointments")}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            {t('reminders.tabs.appointments')}
            {appointments.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {appointments.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "reminders" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("reminders")}
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            {t('reminders.tabs.reminders')}
            {reminders.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {reminders.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            {t('reminders.tabs.settings')}
          </Button>
        </div>

        {/* Appointments Tab */}
        {activeTab === "appointments" && (
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
                    <Badge variant="outline">{appointments.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('reminders.overview.upcoming')}</span>
                    <Badge variant="outline">{upcomingAppointments.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('reminders.overview.confirmed')}</span>
                    <Badge variant="outline">
                      {appointments.filter(apt => apt.status === 'confirmed').length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('reminders.overview.remindersSent')}</span>
                    <Badge variant="outline">
                      {appointments.filter(apt => apt.reminderSent).length}
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
                    <div className="space-y-3">
                      {upcomingAppointments.map((appointment) => (
                        <div key={appointment.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{appointment.title}</p>
                            <p className="text-xs text-gray-500">
                              {getCustomerName(appointment.customer)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDateTime(appointment.appointmentDate)}
                            </p>
                          </div>
                          <Badge className={getStatusColor(appointment.status)} variant="outline">
                            {appointment.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Appointments Table */}
            <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {t('reminders.tabs.appointments')}
                    </CardTitle>
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
                              setNewAppointmentData(prev => ({...prev, customerId: value}));
                              setNewAppointmentErrors(prev => ({...prev, customerId: false}));
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
                                setNewAppointmentData(prev => ({...prev, title: e.target.value}));
                                setNewAppointmentErrors(prev => ({...prev, title: false}));
                              }}
                              placeholder={t('reminders.appointments.titlePlaceholder')}
                              className={`focus-visible:ring-0 ${newAppointmentErrors.title ? 'border-red-500' : ''}`}
                            />
                          </div>

                          <div>
                            <Label>{t('reminders.appointments.dateTime')}</Label>
                            <Input 
                              type="datetime-local"
                              value={newAppointmentData.appointmentDate.toISOString().slice(0, 16)}
                              onChange={(e) => setNewAppointmentData(prev => ({...prev, appointmentDate: new Date(e.target.value)}))}
                              className="focus-visible:ring-0"
                            />
                          </div>

                          <div>
                            <Label>{t('reminders.appointments.duration')}</Label>
                            <Input 
                              type="number"
                              value={newAppointmentData.duration}
                              onChange={(e) => setNewAppointmentData(prev => ({...prev, duration: parseInt(e.target.value)}))}
                              min="15"
                              step="15"
                              className="focus-visible:ring-0"
                            />
                          </div>

                          <div>
                            <Label>{t('reminders.appointments.location')}</Label>
                            <Input 
                              value={newAppointmentData.location}
                              onChange={(e) => setNewAppointmentData(prev => ({...prev, location: e.target.value}))}
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
                                  onValueChange={(value: 'email' | 'sms' | 'push') => setNewAppointmentReminderData(prev => ({...prev, reminderType: value}))}
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
                                  onValueChange={(value: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom') => setNewAppointmentReminderData(prev => ({...prev, reminderTiming: value}))}
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
                                      setNewAppointmentErrors(prev => ({...prev, customMinutesBefore: false}));
                                    }}
                                    className={`focus-visible:ring-0 ${newAppointmentErrors.customMinutesBefore ? 'border-red-500' : ''}`}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">{t('reminders.scheduleReminder.customMinutesHelp')}</p>
                                </div>
                              )}

                              <div>
                                <Label>{t('reminders.scheduleReminder.message')}</Label>
                                <Textarea
                                  placeholder={t('reminders.scheduleReminder.messagePlaceholder')}
                                  value={newAppointmentReminderData.content}
                                  onChange={(e) => setNewAppointmentReminderData(prev => ({...prev, content: e.target.value}))}
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
                </CardHeader>
                <CardContent className="p-0">
                  {/* Search and Filter Controls */}
                  <div className="flex items-center gap-4 p-6 border-b">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={t('reminders.appointments.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
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

                  {appointmentsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                    </div>
                  ) : appointments.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">{t('reminders.appointments.noAppointments')}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">{t('reminders.appointments.createFirst')}</p>
                      <Button onClick={() => setNewAppointmentModalOpen(true)}>
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        {t('reminders.appointments.createAppointment')}
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
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
                            <TableHead>{t('reminders.table.customer')}</TableHead>
                            <TableHead>{t('reminders.table.appointment')}</TableHead>
                            <TableHead>{t('reminders.table.dateTime')}</TableHead>
                            <TableHead>{t('reminders.table.status')}</TableHead>
                            <TableHead>{t('reminders.table.reminder')}</TableHead>
                            <TableHead>{t('reminders.table.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {appointments.map((appointment) => (
                            <TableRow key={appointment.id}>
                              <TableCell>
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
                                  {appointment.reminderSent ? (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-4 w-4" />
                                      <span className="text-sm">{t('reminders.reminderHistory.sent')}</span>
                                    </div>
                                  ) : reminders.some(r => r.appointmentId === appointment.id && r.status === 'pending') ? (
                                    <div className="flex items-center gap-1 text-blue-600">
                                      <Clock className="h-4 w-4" />
                                      <span className="text-sm">Scheduled</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-gray-400">
                                      <Clock className="h-4 w-4" />
                                      <span className="text-sm">{t('reminders.reminderHistory.pending')}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditAppointment(appointment)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => sendReminderMutation.mutate({ appointmentIds: [appointment.id] })}>
                                        <Send className="h-4 w-4 mr-2" />
                                        {t('reminders.actions.sendReminder')}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openScheduleReminder(appointment.id)}>
                                        <Clock className="h-4 w-4 mr-2" />
                                        {t('reminders.actions.scheduleReminder')}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-red-600" onClick={() => handleCancelAppointment(appointment.id)}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {t('reminders.actions.cancelAppointment')}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === "reminders" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('reminders.reminderHistory.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {remindersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                </div>
              ) : reminders.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 mb-2">{t('reminders.reminderHistory.noReminders')}</p>
                  <p className="text-sm text-gray-500 mb-6">{t('reminders.reminderHistory.noRemindersDescription')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('reminders.reminderHistory.appointment')}</TableHead>
                        <TableHead>{t('reminders.reminderHistory.type')}</TableHead>
                        <TableHead>{t('reminders.reminderHistory.timing')}</TableHead>
                        <TableHead>{t('reminders.reminderHistory.scheduledFor')}</TableHead>
                        <TableHead>{t('reminders.reminderHistory.status')}</TableHead>
                        <TableHead>{t('reminders.reminderHistory.sentAt')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reminders.map((reminder) => (
                        <TableRow key={reminder.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">Appointment #{reminder.appointmentId.slice(-8)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {reminder.reminderType}
                            </Badge>
                          </TableCell>
                          <TableCell>{reminder.reminderTiming}</TableCell>
                          <TableCell>{formatDateTime(reminder.scheduledFor)}</TableCell>
                          <TableCell>
                            <Badge className={
                              reminder.status === 'sent' ? 'bg-green-100 text-green-800' :
                              reminder.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {reminder.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {reminder.sentAt ? formatDateTime(reminder.sentAt) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                  onClick={() => createScheduledReminderMutation.mutate({ appointmentId: scheduleAppointmentId, data: scheduleData })}
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
                        onChange={(e) => setEditingAppointment(prev => prev ? {...prev, title: e.target.value} : null)}
                        placeholder={t('reminders.appointments.titlePlaceholder')}
                        className="focus-visible:ring-0"
                      />
                    </div>

                    <div>
                      <Label>{t('reminders.appointments.dateTime')}</Label>
                      <Input 
                        type="datetime-local"
                        value={new Date(editingAppointment.appointmentDate).toISOString().slice(0, 16)}
                        onChange={(e) => setEditingAppointment(prev => prev ? {...prev, appointmentDate: new Date(e.target.value)} : null)}
                        className="focus-visible:ring-0"
                      />
                    </div>

                    <div>
                      <Label>{t('reminders.appointments.duration')}</Label>
                      <Input 
                        type="number"
                        value={editingAppointment.duration}
                        onChange={(e) => setEditingAppointment(prev => prev ? {...prev, duration: parseInt(e.target.value)} : null)}
                        min="15"
                        step="15"
                        className="focus-visible:ring-0"
                      />
                    </div>

                    <div>
                      <Label>{t('reminders.appointments.location')}</Label>
                      <Input 
                        value={editingAppointment.location || ''}
                        onChange={(e) => setEditingAppointment(prev => prev ? {...prev, location: e.target.value} : null)}
                        placeholder={t('reminders.appointments.locationPlaceholder')}
                        className="focus-visible:ring-0"
                      />
                    </div>

                    <div>
                      <Label>{t('reminders.appointments.status')}</Label>
                      <Select 
                        value={editingAppointment.status} 
                        onValueChange={(value) => setEditingAppointment(prev => prev ? {...prev, status: value as Appointment['status']} : null)}
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
                        onChange={(e) => setEditingAppointment(prev => prev ? {...prev, notes: e.target.value} : null)}
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
                          onValueChange={(value: 'email' | 'sms' | 'push') => setEditAppointmentReminderData(prev => ({...prev, reminderType: value}))}
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
                          onValueChange={(value: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom') => setEditAppointmentReminderData(prev => ({...prev, reminderTiming: value}))}
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
                              setEditAppointmentErrors(prev => ({...prev, customMinutesBefore: false}));
                            }}
                            className={`focus-visible:ring-0 ${editAppointmentErrors.customMinutesBefore ? 'border-red-500' : ''}`}
                          />
                          <p className="text-xs text-gray-500 mt-1">{t('reminders.scheduleReminder.customMinutesHelp')}</p>
                        </div>
                      )}

                      <div>
                        <Label>{t('reminders.scheduleReminder.message')}</Label>
                        <Textarea
                          placeholder={t('reminders.scheduleReminder.messagePlaceholder')}
                          value={editAppointmentReminderData.content}
                          onChange={(e) => setEditAppointmentReminderData(prev => ({...prev, content: e.target.value}))}
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

        {/* Cancel Appointment Confirmation Modal */}
        <Dialog open={cancelConfirmModalOpen} onOpenChange={setCancelConfirmModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {t('reminders.cancelConfirm.title')}
              </DialogTitle>
              <DialogDescription>
                {t('reminders.cancelConfirm.description')}
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
                  {t('reminders.cancelConfirm.keep')}
                </Button>
                <Button 
                  variant="destructive"
                  onClick={confirmCancelAppointment}
                  disabled={cancelAppointmentMutation.isPending}
                >
                  {cancelAppointmentMutation.isPending ? t('reminders.cancelConfirm.cancelling') : t('reminders.cancelConfirm.confirmCancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('reminders.settings.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
