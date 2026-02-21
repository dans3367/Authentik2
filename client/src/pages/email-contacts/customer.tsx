import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import EmailActivityTimeline from "@/components/EmailActivityTimeline";
import SendEmailModal from "@/components/SendEmailModal";
import ManageContactTagsModal from "@/components/ManageContactTagsModal";
import CustomerAppointmentsTab from "@/components/CustomerAppointmentsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
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

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "active" | "unsubscribed" | "bounced" | "pending";
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

export default function CustomerViewPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get return URL from query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('return') || '/email-contacts';

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['/api/email-contacts', id],
    queryFn: async () => {
      if (!id) return null;
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${id}`);

      if (!apiResponse.ok) {
        throw new Error(`Failed to fetch contact: ${apiResponse.status} ${apiResponse.statusText}`);
      }

      const data = await apiResponse.json();
      return data;
    },
    enabled: !!id,
  });

  // Fetch real-time engagement statistics
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/email-contacts', id, 'stats'],
    queryFn: async () => {
      if (!id) return null;
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${id}/stats`);
      const data = await apiResponse.json();
      return data;
    },
    enabled: !!id,
  });

  // Global suppression check (bounced/spam complaints) for this email
  const emailForCheck = response?.contact?.email as string | undefined;
  const { data: bouncedCheck } = useQuery({
    queryKey: ['/api/bounced-emails/check', emailForCheck],
    enabled: !!emailForCheck,
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
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', id, 'stats'] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      setLocation(returnUrl);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const handleDeleteContact = () => {
    if (!contact) return;

    if (window.confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  const getStatusBadge = (status: Contact["status"]) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2, label: "Active" },
      unsubscribed: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", icon: XCircle, label: "Unsubscribed" },
      bounced: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle, label: "Bounced" },
      pending: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: AlertCircle, label: "Pending" },
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

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || '??';
  };

  const formatDateShort = (date: Date | string | null) => {
    if (!date) return 'Not set';
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
    return contact.email?.split('@')[0] || 'Unknown Contact';
  };

  const handleEmailSent = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', id] });
    queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', id, 'stats'] });
  };

  // Guard against unsubscribed/bounced contacts to prevent server 403s
  const isSendEmailDisabled = contact ? (contact.status === 'unsubscribed' || contact.status === 'bounced' || !!bouncedCheck?.isBounced) : false;
  const sendEmailDisabledReason = isSendEmailDisabled
    ? (contact?.status === 'bounced' || !!bouncedCheck?.isBounced
      ? "Cannot send email to a bounced contact."
      : "Cannot send email to an unsubscribed contact.")
    : undefined;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Loading contact...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-bold mb-4">Error Loading Contact</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button
            onClick={() => setLocation(returnUrl)}
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contacts
          </Button>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-bold mb-4">Contact Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The contact you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button
            onClick={() => setLocation(returnUrl)}
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contacts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => setLocation(returnUrl)}
        className="mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Contacts
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarFallback className="text-lg font-semibold">
            {getInitials(contact.firstName, contact.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">
            {getFullName(contact)}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-base break-all">
            {contact.email}
          </p>
          <div className="mt-2">
            {getStatusBadge(contact.status)}
          </div>
        </div>
      </div>

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
              Send Email
            </Button>
          }
        />
        <Button
          variant="outline"
          size="sm"
          disabled={isSendEmailDisabled}
          onClick={() => setLocation(`/email-contacts/view/${contact.id}/schedule`)}
        >
          <Clock className="w-4 h-4 mr-2" />
          Send Later
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation(`/email-contacts/edit/${contact.id}`)}
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Unsubscribed/Bounced Contact Warning */}
      {(() => {
        const isBounced = contact.status === 'bounced' || !!bouncedCheck?.isBounced;
        const isUnsubscribed = contact.status === 'unsubscribed';

        if (!isBounced && !isUnsubscribed) return null;

        const suppressionReason = isBounced ? 'bounced' : 'unsubscribed';

        return (
          <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400">
            <AlertTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <AlertTitle className="text-sm font-medium">
              {suppressionReason === 'bounced' ? "Bounced Contact" : "Unsubscribed Contact"}
            </AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm leading-relaxed">
              {suppressionReason === 'bounced'
                ? "This contact's email address has bounced. Future emails may not be delivered."
                : "This customer has unsubscribed from the mailing list. Please do not send marketing or promotional emails to this contact. You may still send direct or scheduled messages if needed."}
            </AlertDescription>
          </Alert>
        );
      })()}

      {/* Tabs for Profile and Appointments */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-4">
          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="w-5 h-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">First Name</label>
                  <p className="text-gray-900 dark:text-white">{contact.firstName || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Name</label>
                  <p className="text-gray-900 dark:text-white">{contact.lastName || 'Not provided'}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email Address</label>
                <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{contact.email}</p>
              </div>

              {/* Address Information */}
              {(contact.address || contact.city || contact.state || contact.zipCode || contact.country || contact.phoneNumber || contact.dateOfBirth) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Address & Contact</h4>

                    {contact.address && (
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Street Address</label>
                        <p className="text-gray-900 dark:text-white">{contact.address}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {contact.city && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">City</label>
                          <p className="text-gray-900 dark:text-white">{contact.city}</p>
                        </div>
                      )}

                      {contact.state && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">State/Province</label>
                          <p className="text-gray-900 dark:text-white">{contact.state}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {contact.zipCode && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Zip/Postal Code</label>
                          <p className="text-gray-900 dark:text-white">{contact.zipCode}</p>
                        </div>
                      )}

                      {contact.country && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Country</label>
                          <p className="text-gray-900 dark:text-white">{contact.country}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {contact.phoneNumber && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone Number</label>
                          <p className="text-gray-900 dark:text-white font-mono text-sm">{contact.phoneNumber}</p>
                        </div>
                      )}

                      {contact.dateOfBirth && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <Cake className="w-3.5 h-3.5" />
                            Customer's Date of Birth
                          </label>
                          <p className="text-gray-900 dark:text-white">
                            {new Date(contact.dateOfBirth + 'T00:00:00').toLocaleDateString("en-US", {
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
            </CardContent>
          </Card>

          {/* Engagement Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5" />
                Engagement Statistics
                {statsLoading && (
                  <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading stats...</span>
                </div>
              ) : engagementStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{engagementStats.emailsSent}</p>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Sent</span>
                    </div>

                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{engagementStats.emailsOpened}</p>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Opened</span>
                    </div>

                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{engagementStats.openRate}%</p>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Rate</span>
                    </div>
                  </div>

                  {(engagementStats.emailsClicked > 0 || engagementStats.emailsBounced > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {engagementStats.emailsClicked > 0 && (
                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{engagementStats.emailsClicked}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Clicked ({engagementStats.clickRate}%)</p>
                        </div>
                      )}

                      {engagementStats.emailsBounced > 0 && (
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">{engagementStats.emailsBounced}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Bounced ({engagementStats.bounceRate}%)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{contact.emailsSent || 0}</p>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Sent</span>
                  </div>

                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{contact.emailsOpened || 0}</p>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Opened</span>
                  </div>

                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {getEngagementRate(contact.emailsSent || 0, contact.emailsOpened || 0)}%
                    </p>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Rate</span>
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
                Tags
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
                <p className="text-sm text-gray-500 dark:text-gray-400">No tags assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Added Date</label>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.addedDate)}</p>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Activity</label>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.lastActivity || null)}</p>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</label>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Consent Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="w-4 h-4" />
                Consent Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Consent Given</label>
                <div className="flex items-center gap-2 mt-1">
                  {contact.consentGiven ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Yes</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600 font-medium">No</span>
                    </>
                  )}
                </div>
              </div>

              {contact.consentGiven && (
                <>
                  <Separator />

                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Consent Date</label>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDateShort(contact.consentDate || null)}</p>
                  </div>

                  {contact.consentMethod && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Consent Method</label>
                      <p className="text-sm text-gray-900 dark:text-white capitalize">
                        {contact.consentMethod.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Email Activity Timeline */}
          <div>
            <EmailActivityTimeline contactId={contact.id} pageSize={10} />
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ManageContactTagsModal
                contactId={contact.id}
                currentTagIds={Array.isArray(contact.tags) ? contact.tags.map((t) => t.id) : []}
                contactName={getFullName(contact)}
                onUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/email-contacts', id] });
                }}
                trigger={
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Tag className="w-4 h-4 mr-2" />
                    Manage Tags
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
                {deleteContactMutation.isPending ? 'Deleting...' : 'Delete Contact'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <CustomerAppointmentsTab customerId={contact.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
