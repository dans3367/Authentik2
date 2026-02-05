import { useState } from "react";
import { isPast } from "date-fns";
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Users,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  Timer,
  MapPin,
  Info,
  MessageSquare,
  StickyNote,
  Edit,
  Copy,
  Eye,
  Trash2,
  Plus,
  Loader2,
  BellOff,
} from "lucide-react";
import { getCustomerName, formatDateTime } from "@/utils/appointment-utils";
import type { AppointmentWithCustomer, Customer } from "@/hooks/useAppointments";
import type { AppointmentReminder, AppointmentNote } from "@shared/schema";

interface AppointmentDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithCustomer | null;
  reminders: AppointmentReminder[];
  notes: AppointmentNote[];
  notesLoading: boolean;
  onEdit: (appointment: AppointmentWithCustomer) => void;
  onStatusChange: (appointmentId: string, status: AppointmentWithCustomer['status']) => void;
  onViewCustomerProfile: () => void;
  onCreateNewAppointment: (appointment: AppointmentWithCustomer) => void;
  // Note mutations
  newNoteContent: string;
  onNewNoteContentChange: (content: string) => void;
  onCreateNote: () => void;
  isCreatingNote: boolean;
  editingNoteId: string | null;
  editingNoteContent: string;
  onEditNote: (noteId: string, content: string) => void;
  onUpdateNote: () => void;
  isUpdatingNote: boolean;
  onCancelEditNote: () => void;
  onDeleteNote: (noteId: string) => void;
  isDeletingNote: boolean;
}

export function AppointmentDetailsSheet({
  open,
  onOpenChange,
  appointment,
  reminders,
  notes,
  notesLoading,
  onEdit,
  onStatusChange,
  onViewCustomerProfile,
  onCreateNewAppointment,
  newNoteContent,
  onNewNoteContentChange,
  onCreateNote,
  isCreatingNote,
  editingNoteId,
  editingNoteContent,
  onEditNote,
  onUpdateNote,
  isUpdatingNote,
  onCancelEditNote,
  onDeleteNote,
  isDeletingNote,
}: AppointmentDetailsSheetProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"details" | "notes">("details");
  const [showExpandedCustomerInfo, setShowExpandedCustomerInfo] = useState(false);

  if (!appointment) return null;

  const appointmentReminders = reminders.filter(r => r.appointmentId === appointment.id);
  const sentReminders = appointmentReminders.filter(r => r.status === 'sent');
  const pendingReminders = appointmentReminders.filter(r => r.status === 'pending');
  const hasSentReminder = sentReminders.length > 0 || appointment.reminderSent;
  const isPastAppointment = isPast(new Date(appointment.appointmentDate));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0">
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

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "notes")} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">{t('reminders.details.tabs.details')}</TabsTrigger>
                <TabsTrigger value="notes">
                  {t('reminders.details.tabs.notes')}
                  {notes && notes.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {notes.length}
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
                    {appointment.customer?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-primary transition-colors"
                        onClick={onViewCustomerProfile}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Profile
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{getCustomerName(appointment.customer)}</p>
                        <p className="text-sm text-muted-foreground">{appointment.customer?.email || 'N/A'}</p>
                      </div>
                    </div>

                    {showExpandedCustomerInfo && (
                      <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{appointment.customer?.phoneNumber || 'No phone'}</span>
                        </div>
                        {appointment.customer?.address && (
                          <p className="text-sm text-muted-foreground">
                            {appointment.customer.address}
                            {(appointment.customer.city || appointment.customer.state || appointment.customer.zipCode) && (
                              <>, {[appointment.customer.city, appointment.customer.state, appointment.customer.zipCode].filter(Boolean).join(', ')}</>
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
                      <p className="font-semibold text-lg text-foreground">{appointment.title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t('reminders.appointments.dateTime')}</p>
                        <p className="text-sm text-foreground">{formatDateTime(appointment.appointmentDate)}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t('reminders.appointments.status')}</p>
                        <Select
                          value={appointment.status}
                          onValueChange={(value: AppointmentWithCustomer['status']) => {
                            onStatusChange(appointment.id, value);
                          }}
                        >
                          <SelectTrigger className="h-8 w-full text-xs bg-transparent border-muted hover:bg-muted/30 transition-colors">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {!isPastAppointment && (
                              <>
                                <SelectItem value="scheduled">{t('reminders.appointments.scheduled')}</SelectItem>
                                <SelectItem value="confirmed">{t('reminders.appointments.confirmed')}</SelectItem>
                              </>
                            )}
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
                          {appointment.duration} {t('reminders.appointments.minutes')}
                        </p>
                      </div>

                      {appointment.location && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{t('reminders.appointments.location')}</p>
                          <p className="text-sm text-foreground flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {appointment.location}
                          </p>
                        </div>
                      )}

                      {appointment.serviceType && (
                        <div className="col-span-2 space-y-1">
                          <p className="text-xs text-muted-foreground">{t('reminders.details.serviceType')}</p>
                          <span className="text-sm text-foreground">{appointment.serviceType}</span>
                        </div>
                      )}
                    </div>

                    {appointment.description && (
                      <div className="pt-3 border-t border-dashed space-y-1">
                        <p className="text-xs text-muted-foreground">{t('reminders.details.descriptionLabel')}</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {appointment.description}
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

                      {hasSentReminder && (
                        <div className="pl-0.5 space-y-1">
                          {sentReminders.length > 0 ? (
                            sentReminders.map((reminder) => (
                              <div key={reminder.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="capitalize">{reminder.reminderType} • {reminder.reminderTiming === 'custom' ? `${reminder.customMinutesBefore}m before` : reminder.reminderTiming}</span>
                                {reminder.sentAt && (
                                  <span>{formatDateTime(new Date(reminder.sentAt))}</span>
                                )}
                              </div>
                            ))
                          ) : appointment.reminderSentAt ? (
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{t('reminders.details.sentAt')}</span>
                              <span>{formatDateTime(new Date(appointment.reminderSentAt))}</span>
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
                    {appointmentReminders.length === 0 && !appointment.reminderSent && (
                      <div className="py-4 text-center">
                        <BellOff className="h-5 w-5 mx-auto text-muted-foreground/40 mb-1" />
                        <p className="text-xs text-muted-foreground">No reminders configured</p>
                      </div>
                    )}
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
                      {appointment.confirmationReceived ? (
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
                    {appointment.confirmationReceivedAt && (
                      <div className="flex items-center justify-between py-1">
                        <p className="text-xs text-muted-foreground">{t('reminders.details.confirmedAt')}</p>
                        <p className="text-xs text-foreground">{formatDateTime(appointment.confirmationReceivedAt)}</p>
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
                      <span className="text-foreground">{appointment.createdAt ? formatDateTime(new Date(appointment.createdAt)) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t('reminders.details.lastUpdated')}</span>
                      <span className="text-foreground">{appointment.updatedAt ? formatDateTime(new Date(appointment.updatedAt)) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t('reminders.details.appointmentId')}</span>
                      <span className="font-mono text-[10px] text-muted-foreground select-all">{appointment.id}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-6 mt-6 focus-visible:outline-none focus-visible:ring-0">
                {/* Legacy Notes (single field) */}
                {appointment.notes && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {t('reminders.details.quickNotes')}
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
                    </div>
                  </div>
                )}

                {/* Appointment Notes (multiple entries) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    {t('reminders.details.appointmentNotes')}
                    {notes && notes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {notes.length}
                      </Badge>
                    )}
                  </h3>

                  {/* Add new note form */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                    <Textarea
                      placeholder={t('reminders.details.addNotePlaceholder')}
                      value={newNoteContent}
                      onChange={(e) => onNewNoteContentChange(e.target.value)}
                      rows={3}
                      className="resize-none focus-visible:ring-0"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={onCreateNote}
                        disabled={!newNoteContent.trim() || isCreatingNote}
                      >
                        {isCreatingNote ? (
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
                  ) : notes && notes.length > 0 ? (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                          {editingNoteId === note.id ? (
                            <>
                              <Textarea
                                value={editingNoteContent}
                                onChange={(e) => onEditNote(note.id, e.target.value)}
                                rows={3}
                                className="resize-none focus-visible:ring-0"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={onCancelEditNote}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={onUpdateNote}
                                  disabled={!editingNoteContent.trim() || isUpdatingNote}
                                >
                                  {isUpdatingNote ? (
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
                                    {(note as any).user?.firstName && (note as any).user?.lastName
                                      ? `${(note as any).user.firstName} ${(note as any).user.lastName}`
                                      : (note as any).user?.name || 'Unknown'}
                                  </span>
                                  <span className="mx-1">•</span>
                                  <span>{new Date(note.createdAt!).toLocaleDateString('en-US', {
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
                                    onClick={() => onEditNote(note.id, note.content)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => onDeleteNote(note.id)}
                                    disabled={isDeletingNote}
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
            {isPastAppointment ? (
              <Button
                className="flex-1 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                onClick={() => onCreateNewAppointment(appointment)}
              >
                <Copy className="h-4 w-4 mr-2" />
                {t('reminders.details.createNewAppointment')}
              </Button>
            ) : (
              <Button
                className="flex-1 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                onClick={() => onEdit(appointment)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {t('reminders.details.editAppointment')}
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 sm:flex-none sm:w-1/3 hover:bg-muted/50 transition-colors active:scale-[0.98]"
              onClick={() => onOpenChange(false)}
            >
              {t('reminders.details.close')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AppointmentDetailsSheet;
