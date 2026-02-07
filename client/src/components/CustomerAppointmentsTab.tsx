import { useState, useEffect } from "react";
import { isPast } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Calendar,
    Clock,
    MapPin,
    CheckCircle2,
    XCircle,
    AlertCircle,
    CalendarCheck,
    CalendarClock,
    Timer,
    Bell,
    FileText,
    ChevronRight,
    ChevronLeft,
    Mail,
    Send,
    Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
    id: string;
    customerId: string;
    title: string;
    description?: string;
    appointmentDate: Date;
    duration: number;
    location?: string;
    serviceType?: string;
    status: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";
    notes?: string;
    reminderSent: boolean;
    confirmationReceived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface CustomerAppointmentsTabProps {
    customerId: string;
}

export default function CustomerAppointmentsTab({
    customerId,
}: CustomerAppointmentsTabProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
    const [rescheduleEmailDialogOpen, setRescheduleEmailDialogOpen] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<Appointment["status"] | null>(null);
    const [pastPage, setPastPage] = useState(1);
    const PAST_PER_PAGE = 10;

    // Fetch appointments for this customer
    const {
        data: appointmentsData,
        isLoading,
        error,
    } = useQuery<{ appointments: Appointment[] }>({
        queryKey: ["/api/appointments", "customer", customerId],
        queryFn: async () => {
            const response = await apiRequest(
                "GET",
                `/api/appointments?customerId=${customerId}`
            );
            return response.json();
        },
        enabled: !!customerId,
    });

    // Update appointment status mutation
    const updateAppointmentMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
            const response = await apiRequest("PUT", `/api/appointments/${id}`, data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast({
                title: "Success",
                description: "Appointment updated successfully",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to update appointment",
                variant: "destructive",
            });
        },
    });

    // Send reschedule email mutation
    const sendRescheduleEmailMutation = useMutation({
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
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to send reschedule email",
                variant: "destructive",
            });
        },
    });

    // Create appointment state and mutation
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newAppointment, setNewAppointment] = useState({
        title: "",
        description: "",
        appointmentDate: "",
        appointmentTime: "",
        duration: 60,
        location: "",
        serviceType: "",
        notes: "",
    });
    const [formErrors, setFormErrors] = useState<{ title?: boolean; date?: boolean }>({});

    const resetForm = () => {
        setNewAppointment({
            title: "",
            description: "",
            appointmentDate: "",
            appointmentTime: "",
            duration: 60,
            location: "",
            serviceType: "",
            notes: "",
        });
        setFormErrors({});
    };

    const createAppointmentMutation = useMutation({
        mutationFn: async (data: Record<string, any>) => {
            const response = await apiRequest("POST", "/api/appointments", data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast({
                title: "Appointment Created",
                description: "The appointment has been scheduled successfully.",
            });
            setCreateDialogOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to create appointment",
                variant: "destructive",
            });
        },
    });

    const handleCreateAppointment = () => {
        const errors: { title?: boolean; date?: boolean } = {};
        if (!newAppointment.title.trim()) errors.title = true;
        if (!newAppointment.appointmentDate) errors.date = true;

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            toast({
                title: "Validation Error",
                description: "Please fill in all required fields.",
                variant: "destructive",
            });
            return;
        }
        setFormErrors({});

        // Combine date and time into a single Date
        const dateStr = newAppointment.appointmentDate;
        const timeStr = newAppointment.appointmentTime || "09:00";
        const appointmentDate = new Date(`${dateStr}T${timeStr}`);

        if (appointmentDate < new Date()) {
            toast({
                title: "Invalid Date",
                description: "Appointment date must be in the future.",
                variant: "destructive",
            });
            return;
        }

        createAppointmentMutation.mutate({
            customerId,
            title: newAppointment.title.trim(),
            description: newAppointment.description.trim() || undefined,
            appointmentDate: appointmentDate.toISOString(),
            duration: newAppointment.duration,
            location: newAppointment.location.trim() || undefined,
            serviceType: newAppointment.serviceType.trim() || undefined,
            notes: newAppointment.notes.trim() || undefined,
        });
    };

    const appointments = appointmentsData?.appointments || [];

    // Split into upcoming and past appointments using date-fns for timezone-safe comparison
    const upcomingAppointments = appointments
        .filter((a) => !isPast(new Date(a.appointmentDate)))
        .sort(
            (a, b) =>
                new Date(a.appointmentDate).getTime() -
                new Date(b.appointmentDate).getTime()
        );

    const pastAppointments = appointments
        .filter((a) => isPast(new Date(a.appointmentDate)))
        .sort(
            (a, b) =>
                new Date(b.appointmentDate).getTime() -
                new Date(a.appointmentDate).getTime()
        );

    // Reset pastPage if it becomes out-of-range when pastAppointments shrinks/changes
    useEffect(() => {
        const maxPage = Math.ceil(pastAppointments.length / PAST_PER_PAGE) || 1;
        if (pastPage > maxPage) {
            setPastPage(maxPage);
        }
    }, [pastAppointments.length, pastPage]);

    const getStatusBadge = (status: Appointment["status"]) => {
        const statusConfig = {
            scheduled: {
                color:
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                icon: Clock,
                label: "Scheduled",
            },
            confirmed: {
                color:
                    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                icon: CheckCircle2,
                label: "Confirmed",
            },
            cancelled: {
                color:
                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                icon: XCircle,
                label: "Cancelled",
            },
            completed: {
                color:
                    "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
                icon: CheckCircle2,
                label: "Completed",
            },
            no_show: {
                color:
                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                icon: AlertCircle,
                label: "No Show",
            },
        };

        const config = statusConfig[status];
        const Icon = config.icon;

        return (
            <Badge className={`${config.color} gap-1`}>
                <Icon className="w-3 h-3" />
                {config.label}
            </Badge>
        );
    };

    const formatDate = (date: Date | string) => {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return dateObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatTime = (date: Date | string) => {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return dateObj.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const formatDateTime = (date: Date | string) => {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return dateObj.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes} minutes`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    };

    const handleAppointmentClick = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setDetailsPanelOpen(true);
    };

    const handleStatusChange = (status: Appointment["status"]) => {
        if (!selectedAppointment) return;

        // If changing to cancelled or no_show, prompt to send reschedule email
        if (status === 'cancelled' || status === 'no_show') {
            setPendingStatusChange(status);
            setRescheduleEmailDialogOpen(true);
            return;
        }

        // For other status changes, update directly
        updateAppointmentMutation.mutate(
            { id: selectedAppointment.id, data: { status } },
            {
                onSuccess: () => {
                    setSelectedAppointment(prev => prev ? { ...prev, status } : null);
                }
            }
        );
    };

    const handleRescheduleEmailConfirm = async (sendEmail: boolean) => {
        if (!selectedAppointment || !pendingStatusChange) return;

        // Update the appointment status
        updateAppointmentMutation.mutate(
            { id: selectedAppointment.id, data: { status: pendingStatusChange } },
            {
                onSuccess: () => {
                    setSelectedAppointment(prev => prev ? { ...prev, status: pendingStatusChange } : null);

                    // Send reschedule email if requested
                    if (sendEmail) {
                        sendRescheduleEmailMutation.mutate(selectedAppointment.id);
                    }

                    // Reset dialog state
                    setRescheduleEmailDialogOpen(false);
                    setPendingStatusChange(null);
                }
            }
        );
    };

    const AppointmentCard = ({ appointment }: { appointment: Appointment }) => (
        <button
            onClick={() => handleAppointmentClick(appointment)}
            className="w-full text-left p-4 border rounded-lg bg-card hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer group"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">
                        {appointment.title}
                    </h4>
                    {appointment.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {appointment.description}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {getStatusBadge(appointment.status)}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                </div>
            </div>

            <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{formatDate(appointment.appointmentDate)}</span>
                    <span className="text-gray-400">•</span>
                    <span>{formatTime(appointment.appointmentDate)}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Duration: {formatDuration(appointment.duration)}</span>
                </div>

                {appointment.location && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{appointment.location}</span>
                    </div>
                )}
            </div>
        </button>
    );

    const createAppointmentDialog = (
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetForm();
        }}>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>New Appointment</DialogTitle>
                    <DialogDescription>
                        Schedule a new appointment for this customer.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 overflow-y-auto flex-1 px-1 py-1">
                    <div>
                        <Label className={formErrors.title ? "text-red-500" : ""}>
                            Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={newAppointment.title}
                            onChange={(e) => {
                                setNewAppointment(prev => ({ ...prev, title: e.target.value }));
                                setFormErrors(prev => ({ ...prev, title: false }));
                            }}
                            placeholder="e.g. Follow-up consultation"
                            className={formErrors.title ? "border-red-500" : ""}
                        />
                    </div>

                    <div>
                        <Label className={formErrors.date ? "text-red-500" : ""}>
                            Date & Time <span className="text-red-500">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="date"
                                value={newAppointment.appointmentDate}
                                onChange={(e) => {
                                    setNewAppointment(prev => ({ ...prev, appointmentDate: e.target.value }));
                                    setFormErrors(prev => ({ ...prev, date: false }));
                                }}
                                className={formErrors.date ? "border-red-500" : ""}
                            />
                            <Input
                                type="time"
                                value={newAppointment.appointmentTime}
                                onChange={(e) => setNewAppointment(prev => ({ ...prev, appointmentTime: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Duration (minutes)</Label>
                        <Input
                            type="number"
                            value={newAppointment.duration}
                            onChange={(e) => setNewAppointment(prev => ({ ...prev, duration: parseInt(e.target.value, 10) || 60 }))}
                            min="15"
                            step="15"
                        />
                    </div>

                    <div>
                        <Label>Location</Label>
                        <Input
                            value={newAppointment.location}
                            onChange={(e) => setNewAppointment(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="e.g. Office, Zoom, etc."
                        />
                    </div>

                    <div>
                        <Label>Service Type</Label>
                        <Input
                            value={newAppointment.serviceType}
                            onChange={(e) => setNewAppointment(prev => ({ ...prev, serviceType: e.target.value }))}
                            placeholder="e.g. Consultation, Check-up"
                        />
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Textarea
                            value={newAppointment.description}
                            onChange={(e) => setNewAppointment(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Brief description of the appointment..."
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={newAppointment.notes}
                            onChange={(e) => setNewAppointment(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Internal notes..."
                            rows={2}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => {
                        setCreateDialogOpen(false);
                        resetForm();
                    }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateAppointment}
                        disabled={createAppointmentMutation.isPending}
                    >
                        {createAppointmentMutation.isPending ? "Creating..." : "Create Appointment"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                        <p>Failed to load appointments</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (appointments.length === 0) {
        return (
            <>
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="font-medium">No appointments found</p>
                            <p className="text-sm mt-1">
                                This customer doesn't have any appointments yet.
                            </p>
                            <Button
                                className="mt-4"
                                onClick={() => setCreateDialogOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Appointment
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                {createAppointmentDialog}
            </>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {/* Upcoming Appointments */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <CalendarClock className="w-4 h-4 text-blue-500" />
                                Upcoming Appointments
                                {upcomingAppointments.length > 0 && (
                                    <Badge variant="secondary" className="ml-1">
                                        {upcomingAppointments.length}
                                    </Badge>
                                )}
                            </CardTitle>
                            <Button
                                size="sm"
                                onClick={() => setCreateDialogOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                New
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {upcomingAppointments.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingAppointments.map((appointment) => (
                                    <AppointmentCard
                                        key={appointment.id}
                                        appointment={appointment}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                No upcoming appointments
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Past Appointments */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarCheck className="w-4 h-4 text-gray-500" />
                            Past Appointments
                            {pastAppointments.length > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {pastAppointments.length}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pastAppointments.length > 0 ? (
                            <>
                                <div className="space-y-3">
                                    {pastAppointments
                                        .slice((pastPage - 1) * PAST_PER_PAGE, pastPage * PAST_PER_PAGE)
                                        .map((appointment) => (
                                            <AppointmentCard
                                                key={appointment.id}
                                                appointment={appointment}
                                            />
                                        ))}
                                </div>
                                {pastAppointments.length > PAST_PER_PAGE && (
                                    <div className="flex items-center justify-between pt-4 mt-4 border-t">
                                        <span className="text-xs text-muted-foreground">
                                            Showing {(pastPage - 1) * PAST_PER_PAGE + 1}–{Math.min(pastPage * PAST_PER_PAGE, pastAppointments.length)} of {pastAppointments.length}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                                                disabled={pastPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-xs px-2">
                                                {pastPage} / {Math.ceil(pastAppointments.length / PAST_PER_PAGE)}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => setPastPage((p) => Math.min(Math.ceil(pastAppointments.length / PAST_PER_PAGE), p + 1))}
                                                disabled={pastPage >= Math.ceil(pastAppointments.length / PAST_PER_PAGE)}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                No past appointments
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Appointment Details Panel */}
            <Sheet open={detailsPanelOpen} onOpenChange={setDetailsPanelOpen}>
                <SheetContent className="w-full sm:max-w-md flex flex-col overflow-hidden p-0">
                    {selectedAppointment && (
                        <>
                            <div className="flex-1 overflow-y-auto p-6">
                                <SheetHeader>
                                    <SheetTitle className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Appointment Details
                                    </SheetTitle>
                                    <SheetDescription>
                                        View and manage appointment information
                                    </SheetDescription>
                                </SheetHeader>

                                <div className="space-y-6 mt-6">
                                    {/* Appointment Title & Status */}
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg text-foreground">
                                            {selectedAppointment.title}
                                        </h3>
                                        {getStatusBadge(selectedAppointment.status)}
                                    </div>

                                    <Separator />

                                    {/* Date & Time */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5" />
                                            Date & Time
                                        </h4>
                                        <div className="space-y-2">
                                            <p className="text-sm text-foreground">
                                                {formatDateTime(selectedAppointment.appointmentDate)}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <Timer className="h-3.5 w-3.5" />
                                                {formatDuration(selectedAppointment.duration)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Location */}
                                    {selectedAppointment.location && (
                                        <>
                                            <Separator />
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    Location
                                                </h4>
                                                <p className="text-sm text-foreground">
                                                    {selectedAppointment.location}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {/* Service Type */}
                                    {selectedAppointment.serviceType && (
                                        <>
                                            <Separator />
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    Service Type
                                                </h4>
                                                <p className="text-sm text-foreground">
                                                    {selectedAppointment.serviceType}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {/* Description */}
                                    {selectedAppointment.description && (
                                        <>
                                            <Separator />
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                                    <FileText className="h-3.5 w-3.5" />
                                                    Description
                                                </h4>
                                                <p className="text-sm text-foreground/80 leading-relaxed">
                                                    {selectedAppointment.description}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {/* Notes */}
                                    {selectedAppointment.notes && (
                                        <>
                                            <Separator />
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    Notes
                                                </h4>
                                                <p className="text-sm text-foreground/80 leading-relaxed">
                                                    {selectedAppointment.notes}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {/* Reminder & Confirmation Status */}
                                    <Separator />
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                            <Bell className="h-3.5 w-3.5" />
                                            Status
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg bg-muted/50">
                                                <p className="text-xs text-muted-foreground mb-1">Reminder</p>
                                                <div className="flex items-center gap-1.5">
                                                    {selectedAppointment.reminderSent ? (
                                                        <>
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                                            <span className="text-sm text-green-600 dark:text-green-400">Sent</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                            <span className="text-sm text-muted-foreground">Pending</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-muted/50">
                                                <p className="text-xs text-muted-foreground mb-1">Confirmation</p>
                                                <div className="flex items-center gap-1.5">
                                                    {selectedAppointment.confirmationReceived ? (
                                                        <>
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                                            <span className="text-sm text-green-600 dark:text-green-400">Received</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                            <span className="text-sm text-muted-foreground">Awaiting</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Update Status */}
                                    <Separator />
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            Update Status
                                        </h4>
                                        <Select
                                            value={selectedAppointment.status}
                                            onValueChange={handleStatusChange}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!isPast(new Date(selectedAppointment.appointmentDate)) && (
                                                    <>
                                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                                    </>
                                                )}
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                                <SelectItem value="no_show">No Show</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="border-t p-4 bg-background">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setDetailsPanelOpen(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* Reschedule Email Confirmation Dialog */}
            <AlertDialog open={rescheduleEmailDialogOpen} onOpenChange={setRescheduleEmailDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-amber-500" />
                            Send Reschedule Invitation?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                Would you like to send a friendly email to the customer
                                inviting them to reschedule their appointment?
                            </p>
                            <p className="text-sm text-muted-foreground">
                                The email will include the original appointment details and
                                encourage them to book a new time.
                            </p>
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
                            disabled={updateAppointmentMutation.isPending || sendRescheduleEmailMutation.isPending}
                            className="bg-amber-500 hover:bg-amber-600"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Yes, Send Email
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Appointment Dialog */}
            {createAppointmentDialog}
        </>
    );
}
