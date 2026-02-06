import { useState } from "react";
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
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No appointments found</p>
                        <p className="text-sm mt-1">
                            This customer doesn't have any appointments yet.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {/* Upcoming Appointments */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarClock className="w-4 h-4 text-blue-500" />
                            Upcoming Appointments
                            {upcomingAppointments.length > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {upcomingAppointments.length}
                                </Badge>
                            )}
                        </CardTitle>
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
        </>
    );
}
