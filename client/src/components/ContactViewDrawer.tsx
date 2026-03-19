import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import EmailActivityTimeline from "@/components/EmailActivityTimeline";
import SendEmailModal from "@/components/SendEmailModal";
import ManageContactTagsModal from "@/components/ManageContactTagsModal";
import CustomerAppointmentsTab from "@/components/CustomerAppointmentsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle as AlertTriangleIcon,
  Edit,
  Trash2,
  Tag,
  BarChart3,
  UserCheck,
  Eye,
  Send,
  TrendingUp,
  Clock,
  Cake
} from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "active" | "unsubscribed" | "bounced" | "pending" | "suppressed";
  tags: ContactTag[];
  lists: EmailList[];
  addedDate: Date;
  lastActivity?: Date | null;
  emailsSent: number;
  emailsOpened: number;
  consentGiven: boolean;
  consentDate?: Date | null;
  consentMethod?: string | null;
  consentIpAddress?: string | null;
  prefMarketing?: boolean;
  prefCustomerEngagement?: boolean;
  prefNewsletters?: boolean;
  prefSurveysForms?: boolean;
  addedByUserId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ContactTag {
  id: string;
  name: string;
  color: string;
}

interface EmailList {
  id: string;
  name: string;
  description?: string | null;
}

interface ContactViewDrawerProps {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactViewDrawer({ contactId, open, onOpenChange }: ContactViewDrawerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['/api/email-contacts', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${contactId}`);

      if (!apiResponse.ok) {
        throw new Error(`Failed to fetch contact: ${apiResponse.status} ${apiResponse.statusText}`);
      }

      const data = await apiResponse.json();
      return data;
    },
    enabled: !!contactId && open,
  });

  // Fetch real-time engagement statistics
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/email-contacts', contactId, 'stats'],
    queryFn: async () => {
      if (!contactId) return null;
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${contactId}/stats`);
      const data = await apiResponse.json();
      return data;
    },
    enabled: !!contactId && open,
  });

  // Fetch custom fields for this contact
  const { data: customFieldsResponse } = useQuery({
    queryKey: ['/api/email-contacts', contactId, 'custom-fields'],
    queryFn: async () => {
      if (!contactId) return null;
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${contactId}/custom-fields`);
      const data = await apiResponse.json();
      return data;
    },
    enabled: !!contactId && open,
  });

  const customFields = customFieldsResponse?.customFields;

  // Global suppression check (bounced/spam complaints) for this email
  const emailForCheck = response?.contact?.email as string | undefined;
  const { data: bouncedCheck } = useQuery({
    queryKey: ['/api/bounced-emails/check', emailForCheck],
    enabled: !!emailForCheck && open,
    queryFn: async ({ queryKey }) => {
      const res = await apiRequest('GET', `/api/bounced-emails/check/${encodeURIComponent(String(queryKey[1]))}`);
      return res.json();
    },
  });

  // Extract contact from response
  const contact: Contact | undefined = response?.contact;
  const engagementStats = statsResponse?.stats;

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const response = await apiRequest('DELETE', `/api/email-contacts/${contactId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', contactId, 'stats'] });
      toast({
        title: t('contactDrawer.toasts.success'),
        description: t('contactDrawer.toasts.deleteSuccess'),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('contactDrawer.toasts.error'),
        description: error.message || t('contactDrawer.toasts.deleteError'),
        variant: "destructive",
      });
    },
  });

  const handleDeleteContact = () => {
    if (!contact) return;

    if (window.confirm(t('contactDrawer.toasts.deleteConfirm'))) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  const getStatusBadge = (status: any) => {
    let color = "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400";
    let Icon = AlertCircle;
    let label = status ? String(status) : t('contactDrawer.status.unknown');

    if (status === "active") {
      color = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      Icon = CheckCircle2;
      label = t('contactDrawer.status.active');
    } else if (status === "unsubscribed") {
      color = "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      Icon = XCircle;
      label = t('contactDrawer.status.unsubscribed');
    } else if (status === "bounced") {
      color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      Icon = AlertCircle;
      label = t('contactDrawer.status.bounced');
    } else if (status === "suppressed") {
      color = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      Icon = AlertCircle;
      label = t('contactDrawer.status.suppressed');
    } else if (status === "pending") {
      color = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      Icon = AlertCircle;
      label = t('contactDrawer.status.pending');
    }

    if (!Icon) {
      Icon = AlertCircle;
    }

    return (
      <Badge className={`${color} gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || '??';
  };

  const formatDateShort = (date: Date | string | null) => {
    if (!date) return t('contactDrawer.timeline.notSet');
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getEngagementRate = (sent: number, opened: number) => {
    if (sent === 0) return 0;
    return Math.round((opened / sent) * 100);
  };

  const getFullName = (contact: Contact) => {
    if (contact.firstName || contact.lastName) {
      return `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    }
    return contact.email?.split('@')[0] || t('contactDrawer.status.unknown');
  };

  const handleEmailSent = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', contactId] });
    queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', contactId, 'stats'] });
  };

  // Guard against unsubscribed/bounced/suppressed contacts to prevent server 403s
  const isEmailSuppressed = contact ? (contact.status === 'suppressed' || !!bouncedCheck?.isSuppressed || (!!bouncedCheck?.isBounced && bouncedCheck?.bounceType === 'suppressed')) : false;
  const isSendEmailDisabled = contact ? (contact.status === 'unsubscribed' || contact.status === 'bounced' || !!bouncedCheck?.isBounced || isEmailSuppressed) : false;

  const suppressedSinceFormatted = bouncedCheck?.suppressedSince
    ? new Date(bouncedCheck.suppressedSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const sendEmailDisabledReason = isSendEmailDisabled
    ? (isEmailSuppressed
      ? `${t('contactDrawer.alerts.suppressedDesc')} ${suppressedSinceFormatted ? t('contactDrawer.alerts.suppressedSince', { date: suppressedSinceFormatted }) : ''}${bouncedCheck?.suppressionReason ? ` ${t('contactDrawer.alerts.suppressedDueTo', { reason: bouncedCheck.suppressionReason })}` : ''}.`
      : contact?.status === 'bounced' || !!bouncedCheck?.isBounced
        ? t('contactDrawer.alerts.cannotSendBounced')
        : t('contactDrawer.alerts.cannotSendUnsubscribed'))
    : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-4 text-gray-600 dark:text-gray-400">{t('contactDrawer.loading')}</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold mb-4">{t('contactDrawer.errorTitle')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : !contact ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold mb-4">{t('contactDrawer.notFoundTitle')}</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('contactDrawer.notFoundDesc')}
            </p>
          </div>
        ) : (
          <>
            <SheetHeader className="mb-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 flex-shrink-0">
                  <AvatarFallback className="text-lg font-semibold">
                    {getInitials(contact.firstName, contact.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-2xl break-words">
                    {getFullName(contact)}
                  </SheetTitle>
                  <SheetDescription className="text-base break-all">
                    {contact.email}
                  </SheetDescription>
                  <div className="mt-2">
                    {getStatusBadge(contact.status)}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-6 pb-6">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <SendEmailModal
                  contactId={contact.id}
                  contactEmail={contact.email}
                  contactName={getFullName(contact)}
                  disabled={isSendEmailDisabled}
                  disabledReason={sendEmailDisabledReason}
                  onEmailSent={handleEmailSent}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      {t('contactDrawer.actions.sendEmail')}
                    </Button>
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSendEmailDisabled}
                  onClick={() => {
                    onOpenChange(false);
                    setLocation(`/email-contacts/view/${contact.id}/schedule`);
                  }}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {t('contactDrawer.actions.scheduleSend')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    setLocation(`/email-contacts/edit/${contact.id}`);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {t('contactDrawer.actions.edit')}
                </Button>
              </div>

              {/* Suppressed Email Warning */}
              {isEmailSuppressed && (
                <Alert className="border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 [&>svg]:text-red-600 dark:[&>svg]:text-red-400">
                  <AlertTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <AlertTitle className="text-sm font-semibold">{t('contactDrawer.alerts.suppressedTitle')}</AlertTitle>
                  <AlertDescription className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
                    {t('contactDrawer.alerts.suppressedDesc')} <strong>{suppressedSinceFormatted ? t('contactDrawer.alerts.suppressedSince', { date: suppressedSinceFormatted }) : ''}</strong>
                    {bouncedCheck?.suppressionReason ? <> {t('contactDrawer.alerts.suppressedDueTo', { reason: bouncedCheck.suppressionReason })}</> : null}.
                    <br className="my-1" />
                    {t('contactDrawer.alerts.suppressedWarning')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Unsubscribed/Bounced Contact Warning (only show if NOT suppressed) */}
              {!isEmailSuppressed && (() => {
                const isUnsubscribedOrBounced = contact.status === 'unsubscribed' || contact.status === 'bounced' || !!bouncedCheck?.isBounced;
                if (!isUnsubscribedOrBounced) return null;
                return (
                  <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400">
                    <AlertTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <AlertTitle className="text-sm font-medium">{t('contactDrawer.alerts.unsubscribedTitle')}</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm leading-relaxed">
                      {t('contactDrawer.alerts.unsubscribedDesc')}
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {/* Tabs for Profile and Appointments */}
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile">{t('contactDrawer.tabs.profile')}</TabsTrigger>
                  <TabsTrigger value="appointments">{t('contactDrawer.tabs.appointments')}</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6 mt-4">
                  {/* Contact Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <UserCheck className="w-5 h-5" />
                        {t('contactDrawer.contactInfo.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.firstName')}</label>
                          <p className="text-gray-900 dark:text-white">{contact.firstName || t('contactDrawer.contactInfo.notProvided')}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.lastName')}</label>
                          <p className="text-gray-900 dark:text-white">{contact.lastName || t('contactDrawer.contactInfo.notProvided')}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.emailAddress')}</label>
                        <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{contact.email}</p>
                      </div>

                      {/* Address Information */}
                      {(contact.address || contact.city || contact.state || contact.zipCode || contact.country || contact.phoneNumber || contact.dateOfBirth) && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('contactDrawer.contactInfo.addressContact')}</h4>

                            {contact.address && (
                              <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.streetAddress')}</label>
                                <p className="text-gray-900 dark:text-white">{contact.address}</p>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              {contact.city && (
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.city')}</label>
                                  <p className="text-gray-900 dark:text-white">{contact.city}</p>
                                </div>
                              )}

                              {contact.state && (
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.stateProvince')}</label>
                                  <p className="text-gray-900 dark:text-white">{contact.state}</p>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              {contact.zipCode && (
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.zipPostalCode')}</label>
                                  <p className="text-gray-900 dark:text-white">{contact.zipCode}</p>
                                </div>
                              )}

                              {contact.country && (
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.country')}</label>
                                  <p className="text-gray-900 dark:text-white">{contact.country}</p>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              {contact.phoneNumber && (
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.contactInfo.phoneNumber')}</label>
                                  <p className="text-gray-900 dark:text-white font-mono text-sm">{contact.phoneNumber}</p>
                                </div>
                              )}

                              {contact.dateOfBirth && (
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                    <Cake className="w-3.5 h-3.5" />
                                    {t('contactDrawer.contactInfo.dateOfBirth')}
                                  </label>
                                  <p className="text-gray-900 dark:text-white">
                                    {new Date(contact.dateOfBirth).toLocaleDateString("en-US", {
                                      month: "long",
                                      day: "numeric",
                                      year: "numeric"
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Custom Fields */}
                      {Array.isArray(customFields) && customFields.some((f: any) => f.value !== null && f.value !== undefined && f.value !== '') && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('contactDrawer.contactInfo.customFields')}</h4>
                            <div className="grid grid-cols-2 gap-4">
                              {customFields.filter((f: any) => f.value !== null && f.value !== undefined && f.value !== '').map((field: any) => {
                                let displayValue = field.value;
                                if (field.fieldType === 'boolean') {
                                  displayValue = field.value === 'true' ? t('contactDrawer.contactInfo.yes') : t('contactDrawer.contactInfo.no');
                                } else if (field.fieldType === 'date') {
                                  displayValue = new Date(field.value).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  });
                                } else if (field.fieldType === 'url') {
                                  displayValue = (
                                    <a
                                      href={field.value}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                      data-testid={`link-custom-field-${field.id}`}
                                    >
                                      {field.value}
                                    </a>
                                  );
                                }
                                return (
                                  <div key={field.id} data-testid={`custom-field-${field.id}`}>
                                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{field.label}</label>
                                    <p className="text-gray-900 dark:text-white">{displayValue}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Engagement Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <BarChart3 className="w-5 h-5" />
                        {t('contactDrawer.engagement.title')}
                        {statsLoading && (
                          <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {statsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.loadingStats')}</span>
                        </div>
                      ) : engagementStats ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{engagementStats.emailsSent}</p>
                              <span className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.sent')}</span>
                            </div>

                            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </div>
                              <p className="text-xl font-bold text-green-600 dark:text-green-400">{engagementStats.emailsOpened}</p>
                              <span className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.opened')}</span>
                            </div>

                            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{engagementStats.openRate}%</p>
                              <span className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.rate')}</span>
                            </div>
                          </div>

                          {(engagementStats.emailsClicked > 0 || engagementStats.emailsBounced > 0) && (
                            <div className="grid grid-cols-2 gap-3">
                              {engagementStats.emailsClicked > 0 && (
                                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                  <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{engagementStats.emailsClicked}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.clicked')} ({engagementStats.clickRate}%)</p>
                                </div>
                              )}

                              {engagementStats.emailsBounced > 0 && (
                                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{engagementStats.emailsBounced}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.bounced')} ({engagementStats.bounceRate}%)</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{contact.emailsSent || 0}</p>
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.sent')}</span>
                          </div>

                          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">{contact.emailsOpened || 0}</p>
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.opened')}</span>
                          </div>

                          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                              {getEngagementRate(contact.emailsSent || 0, contact.emailsOpened || 0)}%
                            </p>
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('contactDrawer.engagement.rate')}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tags */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Tag className="w-4 h-4" />
                        {t('contactDrawer.tags.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Array.isArray(contact.tags) && contact.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {contact.tags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs"
                              style={{
                                backgroundColor: tag.color + '20',
                                borderColor: tag.color,
                                color: tag.color
                              }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('contactDrawer.tags.noTags')}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Activity Timeline */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Calendar className="w-4 h-4" />
                        {t('contactDrawer.timeline.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.timeline.addedDate')}</label>
                        <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.addedDate)}</p>
                      </div>

                      <Separator />

                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.timeline.lastActivity')}</label>
                        <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.lastActivity || null)}</p>
                      </div>

                      <Separator />

                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.timeline.lastUpdated')}</label>
                        <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.updatedAt)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Consent Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('contactDrawer.consent.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.consent.consentGiven')}</label>
                        <div className="flex items-center gap-2 mt-1">
                          {contact.consentGiven ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-600 font-medium">{t('contactDrawer.consent.yes')}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="text-sm text-red-600 font-medium">{t('contactDrawer.consent.no')}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {contact.consentGiven && (
                        <>
                          <Separator />

                          <div>
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.consent.consentDate')}</label>
                            <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.consentDate || null)}</p>
                          </div>

                          {contact.consentMethod && (
                            <div>
                              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('contactDrawer.consent.consentMethod')}</label>
                              <p className="text-sm text-gray-900 dark:text-white capitalize">
                                {contact.consentMethod.replace(/_/g, ' ')}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Email Preferences */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Mail className="w-4 h-4" />
                        {t('contactDrawer.preferences.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: t('contactDrawer.preferences.marketing'), value: contact.prefMarketing, desc: t('contactDrawer.preferences.marketingDesc') },
                        { label: t('contactDrawer.preferences.customerEngagement'), value: contact.prefCustomerEngagement, desc: t('contactDrawer.preferences.customerEngagementDesc') },
                        { label: t('contactDrawer.preferences.newsletters'), value: contact.prefNewsletters, desc: t('contactDrawer.preferences.newslettersDesc') },
                        { label: t('contactDrawer.preferences.surveysForms'), value: contact.prefSurveysForms, desc: t('contactDrawer.preferences.surveysFormsDesc') },
                      ].map((pref) => {
                        let badgeClass = 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
                        let badgeText = t('contactDrawer.preferences.notSet');

                        if (pref.value === true) {
                          badgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                          badgeText = t('contactDrawer.preferences.optedIn');
                        } else if (pref.value === false) {
                          badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                          badgeText = t('contactDrawer.preferences.optedOut');
                        }

                        return (
                          <div key={pref.label} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{pref.label}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{pref.desc}</p>
                            </div>
                            <Badge className={badgeClass}>
                              {badgeText}
                            </Badge>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Email Activity Timeline */}
                  <div>
                    <EmailActivityTimeline contactId={contact.id} pageSize={10} />
                  </div>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('contactDrawer.quickActions.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <ManageContactTagsModal
                        contactId={contact.id}
                        currentTagIds={Array.isArray(contact.tags) ? contact.tags.map((tag) => tag.id) : []}
                        contactName={getFullName(contact)}
                        onUpdated={() => {
                          queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', contactId] });
                        }}
                        trigger={
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Tag className="w-4 h-4 mr-2" />
                            {t('contactDrawer.actions.manageTags')}
                          </Button>
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-red-600 hover:text-red-700"
                        onClick={handleDeleteContact}
                        disabled={deleteContactMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deleteContactMutation.isPending ? t('contactDrawer.actions.deleting') : t('contactDrawer.actions.deleteContact')}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="appointments" className="mt-4">
                  <CustomerAppointmentsTab customerId={contact.id} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
