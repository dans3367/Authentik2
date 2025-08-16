import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import EmailActivityTimeline from "@/components/EmailActivityTimeline";
import { 
  ArrowLeft,
  Mail, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Edit, 
  Trash2,
  Tag,
  Users,
  BarChart3,
  Clock,
  UserCheck,
  Eye,
  Send,
  TrendingUp
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
  // Additional consent tracking fields
  consentGiven: boolean;
  consentDate?: Date | null;
  consentMethod?: string | null;
  consentIpAddress?: string | null;
  addedByUserId?: string | null;
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

export default function ViewContact() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['/api/email-contacts', id],
    queryFn: async () => {
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${id}`);
      const data = await apiResponse.json();
      console.log('API response for contact:', data);
      return data;
    },
    enabled: !!id,
  });

  // Fetch real-time engagement statistics
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/email-contacts', id, 'stats'],
    queryFn: async () => {
      const apiResponse = await apiRequest('GET', `/api/email-contacts/${id}/stats`);
      const data = await apiResponse.json();
      console.log('API response for contact stats:', data);
      return data;
    },
    enabled: !!id,
  });

  // Extract contact from response - the API might return { contact: ... } or just the contact directly
  const contact: Contact | undefined = response?.contact || response;
  const engagementStats = statsResponse?.stats;
  
  console.log('Processed contact data:', contact);
  console.log('Engagement stats:', engagementStats);

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
      setLocation('/email-contacts');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Handle contact delete
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
      <Badge className={`${config.color} flex items-center gap-1`}>
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

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString("en-US", { 
      weekday: 'short',
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-4">Loading contact...</span>
        </div>
      </div>
    );
  }

  if (error || !contact || !contact.email) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Contact Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The contact you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button 
            onClick={() => setLocation('/email-contacts')} 
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
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/email-contacts')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
        
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(contact.firstName, contact.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {getFullName(contact)}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {contact.email}
              </p>
              <div className="mt-2">
                {getStatusBadge(contact.status)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Send className="w-4 h-4 mr-2" />
              Send Email
            </Button>
            <Button 
              variant="outline"
              onClick={() => setLocation(`/email-contacts/edit/${contact.id}`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">First Name</label>
                  <p className="text-gray-900 dark:text-white">{contact.firstName || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Name</label>
                  <p className="text-gray-900 dark:text-white">{contact.lastName || 'Not provided'}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email Address</label>
                  <p className="text-gray-900 dark:text-white font-mono">{contact.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Engagement Statistics
                {statsLoading && (
                  <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading real-time stats...</span>
                </div>
              ) : engagementStats ? (
                <div className="space-y-6">
                  {/* Primary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Sent</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{engagementStats.emailsSent}</p>
                    </div>
                    
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Opened</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{engagementStats.emailsOpened}</p>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Open Rate</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {engagementStats.openRate}%
                      </p>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  {(engagementStats.emailsClicked > 0 || engagementStats.emailsBounced > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {engagementStats.emailsClicked > 0 && (
                        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Clicked</span>
                          </div>
                          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{engagementStats.emailsClicked}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {engagementStats.clickRate}% click rate
                          </p>
                        </div>
                      )}
                      
                      {engagementStats.emailsBounced > 0 && (
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Bounced</span>
                          </div>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{engagementStats.emailsBounced}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {engagementStats.bounceRate}% bounce rate
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Sent</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{contact.emailsSent || 0}</p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Opened</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{contact.emailsOpened || 0}</p>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Open Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {getEngagementRate(contact.emailsSent || 0, contact.emailsOpened || 0)}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags and Lists */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contact.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <Badge 
                        key={tag.id} 
                        variant="outline" 
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
                  <p className="text-gray-500 dark:text-gray-400">No tags assigned</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Lists
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contact.lists.length > 0 ? (
                  <div className="space-y-2">
                    {contact.lists.map((list) => (
                      <div key={list.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <p className="font-medium">{list.name}</p>
                        {list.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">{list.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">Not in any lists</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Email Activity Timeline */}
          <EmailActivityTimeline contactId={contact.id} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Added Date</label>
                <p className="text-gray-900 dark:text-white">{formatDateShort(contact.addedDate)}</p>
              </div>
              
              <Separator />
              
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Activity</label>
                <p className="text-gray-900 dark:text-white">{formatDateShort(contact.lastActivity || null)}</p>
              </div>
              
              <Separator />
              
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</label>
                <p className="text-gray-900 dark:text-white">{formatDateShort(contact.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Consent Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Consent Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Consent Given</label>
                <div className="flex items-center gap-2 mt-1">
                  {contact.consentGiven ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-green-600 font-medium">Yes</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-600 font-medium">No</span>
                    </>
                  )}
                </div>
              </div>

              {contact.consentGiven && (
                <>
                  <Separator />
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Consent Date</label>
                    <p className="text-gray-900 dark:text-white">{formatDateShort(contact.consentDate || null)}</p>
                  </div>
                  
                  {contact.consentMethod && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Consent Method</label>
                      <p className="text-gray-900 dark:text-white capitalize">
                        {contact.consentMethod.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                View Activity Log
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Tag className="w-4 h-4 mr-2" />
                Manage Tags
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-red-600 hover:text-red-700"
                onClick={handleDeleteContact}
                disabled={deleteContactMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteContactMutation.isPending ? 'Deleting...' : 'Delete Contact'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}