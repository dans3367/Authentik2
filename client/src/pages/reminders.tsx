import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
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
  Timer
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
  reminderTiming: '24h' | '1h' | '30m' | 'custom';
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [newAppointmentModalOpen, setNewAppointmentModalOpen] = useState(false);
  const [newAppointmentData, setNewAppointmentData] = useState({
    customerId: "",
    title: "",
    description: "",
    appointmentDate: new Date(),
    duration: 60,
    location: "",
    serviceType: "",
    notes: "",
  });

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

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await apiRequest('POST', '/api/appointments', appointmentData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment created successfully",
      });
      refetchAppointments();
      setNewAppointmentModalOpen(false);
      resetNewAppointmentData();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create appointment",
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
        title: "Success",
        description: `Reminders sent for ${variables.appointmentIds.length} appointment(s)`,
      });
      refetchAppointments();
      refetchReminders();
      setSelectedAppointments([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send reminders",
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
      notes: "",
    });
  };

  const handleCreateAppointment = () => {
    if (!newAppointmentData.customerId || !newAppointmentData.title) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    createAppointmentMutation.mutate(newAppointmentData);
  };

  const handleSendReminders = () => {
    if (selectedAppointments.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select appointments to send reminders for",
        variant: "destructive",
      });
      return;
    }

    sendReminderMutation.mutate({ appointmentIds: selectedAppointments });
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
        {/* Header Card */}
        <Card className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="space-y-8 pr-6 xl:pr-12 lg:col-span-8">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-4">
                    <span className="text-4xl md:text-5xl">🔔</span>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
                    {t('reminders.title')}
                  </h1>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed max-w-3xl md:max-w-4xl">
                {t('reminders.subtitle')}
              </p>
              </div>
              <div className="justify-self-center lg:justify-self-end lg:col-span-4">
                <div className="w-[360px] xl:w-[420px] max-w-full h-auto bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 flex items-center justify-center">
                  <div className="text-center">
                    <Bell className="h-24 w-24 text-blue-600 mx-auto mb-4" />
                    <p className="text-blue-800 font-semibold">Smart Reminders</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === "appointments" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("appointments")}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Appointments
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
            Reminders
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
            Settings
          </Button>
        </div>

        {/* Appointments Tab */}
        {activeTab === "appointments" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Appointments Table */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Appointments
                    </CardTitle>
                    <Dialog open={newAppointmentModalOpen} onOpenChange={setNewAppointmentModalOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          New Appointment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Create New Appointment</DialogTitle>
                          <DialogDescription>
                            Schedule a new appointment with a customer.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Customer</Label>
                            <Select value={newAppointmentData.customerId} onValueChange={(value) => setNewAppointmentData(prev => ({...prev, customerId: value}))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a customer" />
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
                            <Label>Title</Label>
                            <Input 
                              value={newAppointmentData.title}
                              onChange={(e) => setNewAppointmentData(prev => ({...prev, title: e.target.value}))}
                              placeholder="Appointment title"
                            />
                          </div>

                          <div>
                            <Label>Date & Time</Label>
                            <Input 
                              type="datetime-local"
                              value={newAppointmentData.appointmentDate.toISOString().slice(0, 16)}
                              onChange={(e) => setNewAppointmentData(prev => ({...prev, appointmentDate: new Date(e.target.value)}))}
                            />
                          </div>

                          <div>
                            <Label>Duration (minutes)</Label>
                            <Input 
                              type="number"
                              value={newAppointmentData.duration}
                              onChange={(e) => setNewAppointmentData(prev => ({...prev, duration: parseInt(e.target.value)}))}
                              min="15"
                              step="15"
                            />
                          </div>

                          <div>
                            <Label>Location</Label>
                            <Input 
                              value={newAppointmentData.location}
                              onChange={(e) => setNewAppointmentData(prev => ({...prev, location: e.target.value}))}
                              placeholder="Meeting location"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setNewAppointmentModalOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleCreateAppointment}
                              disabled={createAppointmentMutation.isPending}
                            >
                              Create Appointment
                            </Button>
                          </div>
                        </div>
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
                        placeholder="Search appointments..."
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
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulk Actions */}
                  {selectedAppointments.length > 0 && (
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{selectedAppointments.length} selected</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedAppointments([])}
                        >
                          Clear Selection
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
                          Send Reminders
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
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">No appointments found</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">Create your first appointment to get started</p>
                      <Button onClick={() => setNewAppointmentModalOpen(true)}>
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        Create Appointment
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
                            <TableHead>Customer</TableHead>
                            <TableHead>Appointment</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reminder</TableHead>
                            <TableHead>Actions</TableHead>
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
                                    {appointment.duration} minutes
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
                                      <span className="text-sm">Sent</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-gray-400">
                                      <Clock className="h-4 w-4" />
                                      <span className="text-sm">Pending</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm">
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
                                        Send Reminder
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-red-600">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Cancel Appointment
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

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Overview Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Appointments</span>
                    <Badge variant="outline">{appointments.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Upcoming</span>
                    <Badge variant="outline">{upcomingAppointments.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Confirmed</span>
                    <Badge variant="outline">
                      {appointments.filter(apt => apt.status === 'confirmed').length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reminders Sent</span>
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
                    Upcoming This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingAppointments.length === 0 ? (
                    <div className="text-center py-4">
                      <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        No upcoming appointments
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
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === "reminders" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Reminder History
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
                  <p className="text-lg text-gray-600 mb-2">No reminders sent yet</p>
                  <p className="text-sm text-gray-500 mb-6">Create appointments and send reminders to see them here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Appointment</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Timing</TableHead>
                        <TableHead>Scheduled For</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent At</TableHead>
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

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Reminder Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable Automatic Reminders</Label>
                    <p className="text-sm text-gray-600">
                      Automatically send reminders based on appointment timing
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-base font-medium">Default Reminder Settings</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Send reminder</Label>
                      <Select defaultValue="24h">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24h">24 hours before</SelectItem>
                          <SelectItem value="1h">1 hour before</SelectItem>
                          <SelectItem value="30m">30 minutes before</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Reminder method</Label>
                      <Select defaultValue="email">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-base font-medium">Email Template</Label>
                  <Textarea 
                    placeholder="Hi {customer_name}, this is a reminder about your appointment on {appointment_date} at {appointment_time}. Please confirm by replying to this email."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">
                    Available variables: {'{customer_name}'}, {'{appointment_date}'}, {'{appointment_time}'}, {'{appointment_title}'}, {'{location}'}
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
