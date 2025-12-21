import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactSearch } from "@/components/ContactSearch";
import EmailActivityTimelineModal from "@/components/EmailActivityTimelineModal";
import { AddContactDialog } from "@/components/AddContactDialog";
import ContactViewDrawer from "@/components/ContactViewDrawer";
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Upload,
  Download,
  UserPlus,
  Tag,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  UserCheck,
  LayoutDashboard
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface ContactStats {
  totalContacts: number;
  activeContacts: number;
  unsubscribedContacts: number;
  bouncedContacts: number;
  pendingContacts: number;
  totalLists: number;
  averageEngagementRate: number;
}

interface EmailListWithCount extends EmailList {
  count: number;
}

export default function EmailContacts() {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Email Contacts", icon: Users }
  ]);
  
  // Store search params in a ref to use in query function without changing dependencies
  const searchParamsRef = useRef({
    search: "",
    status: "all",
    listId: undefined as string | undefined
  });

  // Handle search changes from ContactSearch component
  const handleSearchChange = useCallback((search: string) => {
    setSearchQuery(search);
  }, []);



  // Fetch email contacts stats (independent of search/filters) with enhanced caching
  const { data: statsData } = useQuery({
    queryKey: ['/api/email-contacts-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-contacts?statsOnly=true');
      return response.json();
    },
    staleTime: 15 * 60 * 1000, // Cache stats for 15 minutes (increased)
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour (increased)
    refetchOnWindowFocus: false,
    // Background refetch for stats every 10 minutes
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: true,
  });

  // Initialize search params ref on first render
  useEffect(() => {
    searchParamsRef.current = {
      search: "",
      status: "all",
      listId: undefined
    };
  }, []);

  // Fetch email contacts with stable query key to prevent focus loss
  const { data: contactsData, isLoading: contactsLoading, error: contactsError, isFetching, refetch } = useQuery({
    queryKey: ['/api/email-contacts'], // Stable key - no search params to prevent rerenders
    queryFn: async () => {
      const params = new URLSearchParams();
      const currentParams = searchParamsRef.current;

      if (currentParams.search) params.append('search', currentParams.search);
      if (currentParams.status !== 'all') params.append('status', currentParams.status);
      if (currentParams.listId) params.append('listId', currentParams.listId);

      const response = await apiRequest('GET', `/api/email-contacts?${params.toString()}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchInterval: false,
    // Disable refetchOnMount to prevent unnecessary requests
    refetchOnMount: false,
  });

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchParamsRef.current = {
        search: searchQuery,
        status: statusFilter,
        listId: undefined
      };
      refetch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, refetch]);

  const contacts: Contact[] = (contactsData as any)?.contacts || [];
  const stats: ContactStats = (statsData as any)?.stats || {
    totalContacts: 0,
    activeContacts: 0,
    unsubscribedContacts: 0,
    bouncedContacts: 0,
    pendingContacts: 0,
    totalLists: 0,
    averageEngagementRate: 0,
  };

  const getStatusBadge = (status: Contact["status"]) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-700", icon: CheckCircle2, label: t('emailContacts.statusBadges.active') },
      unsubscribed: { color: "bg-gray-100 text-gray-700", icon: XCircle, label: t('emailContacts.statusBadges.unsubscribed') },
      bounced: { color: "bg-red-100 text-red-700", icon: AlertCircle, label: t('emailContacts.statusBadges.bounced') },
      pending: { color: "bg-yellow-100 text-yellow-700", icon: AlertCircle, label: t('emailContacts.statusBadges.pending') },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1 !px-1 !py-0 text-xs h-5 w-fit inline-flex`}>
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

  const toggleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const toggleSelectContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
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

  // Bulk delete contacts mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const response = await apiRequest('DELETE', '/api/email-contacts', { contactIds });
      return response.json();
    },
    onSuccess: (data, contactIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts-stats'] });
      setSelectedContacts([]);
      toast({
        title: t('emailContacts.toasts.success'),
        description: t('emailContacts.toasts.deleteSuccess', { count: contactIds.length }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('emailContacts.toasts.error'),
        description: error.message || t('emailContacts.toasts.deleteError'),
        variant: "destructive",
      });
    },
  });

  // Handle bulk delete
  const handleBulkDelete = () => {
    console.log('Bulk delete clicked, selected contacts:', selectedContacts);
    if (selectedContacts.length === 0) return;

    const confirmMessage = selectedContacts.length === 1
      ? t('emailContacts.toasts.deleteConfirm')
      : t('emailContacts.toasts.deleteConfirmMultiple', { count: selectedContacts.length });

    if (window.confirm(confirmMessage)) {
      console.log('Bulk deleting contacts:', selectedContacts);
      bulkDeleteMutation.mutate(selectedContacts);
    }
  };



  // Show loading state
  if (contactsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-600 dark:text-gray-400">{t('emailContacts.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (contactsError) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('emailContacts.errorLoading')}</h1>
          <p className="text-gray-600 mb-4">
            {t('emailContacts.errorLoadingDescription')}
          </p>
          <Button 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
              queryClient.invalidateQueries({ queryKey: ['/api/email-contacts-stats'] });
            }} 
            variant="outline"
          >
            {t('emailContacts.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">{t('emailContacts.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('emailContacts.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setAddContactOpen(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {t('emailContacts.addContact')}
            </Button>
          </div>
        </div>
        
        {/* Add Contact Dialog */}
        <AddContactDialog 
          open={addContactOpen} 
          onOpenChange={setAddContactOpen}
        />

        {/* Add minimal spacer after the header section */}
        <div className="h-3"></div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('emailContacts.stats.totalContacts')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalContacts.toLocaleString()}</p>
              </div>
              <Users className="text-blue-500 w-8 h-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('emailContacts.stats.activeSubscribers')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeContacts.toLocaleString()}</p>
                <p className="text-sm text-green-600">
                  {stats.totalContacts > 0 ? Math.round((stats.activeContacts / stats.totalContacts) * 100) : 0}%
                </p>
              </div>
              <UserCheck className="text-green-500 w-8 h-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('emailContacts.stats.lists')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLists}</p>
              </div>
              <Tag className="text-purple-500 w-8 h-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('emailContacts.stats.avgEngagement')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageEngagementRate}%</p>
              </div>
              <Mail className="text-orange-500 w-8 h-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <ContactSearch
        value={searchQuery}
        onSearchChange={handleSearchChange}
        placeholder={t('emailContacts.filters.searchPlaceholder')}
      />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <Filter className="w-4 h-4 mr-2" />
          <SelectValue placeholder={t('emailContacts.filters.filterByStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('emailContacts.filters.allStatus')}</SelectItem>
          <SelectItem value="active">{t('emailContacts.filters.active')}</SelectItem>
          <SelectItem value="unsubscribed">{t('emailContacts.filters.unsubscribed')}</SelectItem>
          <SelectItem value="bounced">{t('emailContacts.filters.bounced')}</SelectItem>
          <SelectItem value="pending">{t('emailContacts.filters.pending')}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
      >
        <Download className="w-4 h-4 mr-2" />
        {t('emailContacts.filters.export')}
      </Button>
      </div>

      {/* Bulk Actions */}
      {selectedContacts.length > 0 && (
        <Card className="mb-4">
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedContacts.length} {t('emailContacts.bulkActions.selected')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Tag className="w-4 h-4 mr-2" />
                  {t('emailContacts.bulkActions.addTags')}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Users className="w-4 h-4 mr-2" />
                  {t('emailContacts.bulkActions.addToList')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 flex-1 sm:flex-none"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBulkDelete();
                  }}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {bulkDeleteMutation.isPending ? t('emailContacts.bulkActions.deleting') : t('emailContacts.bulkActions.delete')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts Table */}
      <Card className="relative">
      <CardContent className="p-0">
        {/* Search Loading Indicator */}
        {isFetching && (
          <div className="absolute right-4 top-4 z-10">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-sm">
              <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
              {t('emailContacts.empty.searching')}
            </div>
          </div>
        )}
        {/* Responsive Layout with smooth transition */}
        <div className={`transition-all duration-300 ${isFetching ? 'opacity-70 scale-[0.995]' : 'opacity-100 scale-100'}`}>
          {/* Table View for Large Screens */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedContacts.length === contacts.length && contacts.length > 0}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all-table"
                    />
                  </TableHead>
                  <TableHead>{t('emailContacts.table.contact')}</TableHead>
                  <TableHead>{t('emailContacts.table.status')}</TableHead>
                  <TableHead>{t('emailContacts.table.tags')}</TableHead>
                  <TableHead>{t('emailContacts.table.engagement')}</TableHead>
                  <TableHead>{t('emailContacts.table.added')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Search className="h-8 w-8" />
                        <p>
                          {searchQuery ? 
                            t('emailContacts.empty.noContactsMatching', { query: searchQuery }) : 
                            t('emailContacts.empty.noContacts')
                          }
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className={`transition-all duration-500 ${contact.id.startsWith('temp-') ? 'bg-green-50 dark:bg-green-950/20 animate-pulse' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => toggleSelectContact(contact.id)}
                          disabled={contact.id.startsWith('temp-')}
                          data-testid={`checkbox-contact-table-${contact.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(contact.firstName, contact.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p
                              className={`font-medium hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors ${
                                contact.id.startsWith('temp-')
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                              onClick={() => !contact.id.startsWith('temp-') && setSelectedContactId(contact.id)}
                              data-testid={`text-contact-name-table-${contact.id}`}
                            >
                              {contact.firstName || contact.lastName
                                ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                                : contact.email.split('@')[0]
                              }
                              {contact.id.startsWith('temp-') && (
                                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">
                                  {t('emailContacts.newBadge')}
                                </span>
                              )}
                            </p>
                            <p
                              className={`text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                                contact.id.startsWith('temp-')
                                  ? 'text-green-600 dark:text-green-500 cursor-default'
                                  : 'text-gray-500 cursor-pointer'
                              }`}
                              onClick={() => !contact.id.startsWith('temp-') && setSelectedContactId(contact.id)}
                              data-testid={`text-contact-email-table-${contact.id}`}
                            >
                              {contact.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(contact.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {contact.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag.id} variant="outline" className="text-xs" style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}>
                              {tag.name}
                            </Badge>
                          ))}
                          {contact.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{contact.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">
                            {getEngagementRate(contact.emailsSent, contact.emailsOpened)}% {t('emailContacts.table.openRate')}
                          </p>
                          <p className="text-gray-500">
                            {contact.emailsOpened}/{contact.emailsSent} {t('emailContacts.table.emails')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDate(contact.addedDate)}</p>
                          {contact.lastActivity && (
                            <p className="text-gray-500">
                              {t('emailContacts.table.active')} {formatDate(contact.lastActivity)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-contact-menu-table-${contact.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedContactId(contact.id)}>
                              <UserCheck className="w-4 h-4 mr-2" />
                              {t('emailContacts.actions.viewContact')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/email-contacts/edit/${contact.id}`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              {t('emailContacts.actions.editContact')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              {t('emailContacts.actions.sendEmail')}
                            </DropdownMenuItem>
                            <EmailActivityTimelineModal
                              contactId={contact.id}
                              contactEmail={contact.email}
                              contactName={`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || undefined}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  {t('emailContacts.actions.viewActivityTimeline')}
                                </DropdownMenuItem>
                              }
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Card View for Tablets and Smaller */}
          <div className="lg:hidden">
            {/* Select All Header for Card View */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedContacts.length === contacts.length && contacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all-cards"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="hidden sm:inline">{t('emailContacts.selectAll.selectAllContacts')}</span>
                  <span className="sm:hidden">{t('emailContacts.selectAll.selectAll')}</span>
                </span>
              </div>
              {selectedContacts.length > 0 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {selectedContacts.length} {t('emailContacts.bulkActions.selected')}
                </span>
              )}
            </div>
            
            {contacts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 py-12">
                <Search className="h-8 w-8" />
                <p>
                  {searchQuery ? 
                    t('emailContacts.empty.noContactsMatching', { query: searchQuery }) : 
                    t('emailContacts.empty.noContacts')
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {contacts.map((contact) => (
                  <Card
                    key={contact.id}
                    className={`transition-all duration-500 hover:shadow-md ${
                      contact.id.startsWith('temp-') 
                        ? 'bg-green-50 dark:bg-green-950/20 animate-pulse border-green-200 dark:border-green-800' 
                        : 'hover:border-blue-200 dark:hover:border-blue-700'
                    }`}
                    data-testid={`card-contact-${contact.id}`}
                  >
                    <CardContent className="p-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => toggleSelectContact(contact.id)}
                            disabled={contact.id.startsWith('temp-')}
                            data-testid={`checkbox-contact-card-${contact.id}`}
                          />
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm font-medium">
                              {getInitials(contact.firstName, contact.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium truncate hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors ${
                                contact.id.startsWith('temp-')
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                              onClick={() => !contact.id.startsWith('temp-') && setSelectedContactId(contact.id)}
                              data-testid={`text-contact-name-card-${contact.id}`}
                            >
                              {contact.firstName || contact.lastName
                                ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                                : contact.email.split('@')[0]
                              }
                              {contact.id.startsWith('temp-') && (
                                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">
                                  {t('emailContacts.newBadge')}
                                </span>
                              )}
                            </p>
                            <p
                              className={`text-sm truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                                contact.id.startsWith('temp-')
                                  ? 'text-green-600 dark:text-green-500 cursor-default'
                                  : 'text-gray-500 cursor-pointer'
                              }`}
                              onClick={() => !contact.id.startsWith('temp-') && setSelectedContactId(contact.id)}
                              data-testid={`text-contact-email-card-${contact.id}`}
                            >
                              {contact.email}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-contact-menu-card-${contact.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedContactId(contact.id)}>
                              <UserCheck className="w-4 h-4 mr-2" />
                              {t('emailContacts.actions.viewContact')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/email-contacts/edit/${contact.id}`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              {t('emailContacts.actions.editContact')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              {t('emailContacts.actions.sendEmail')}
                            </DropdownMenuItem>
                            <EmailActivityTimelineModal
                              contactId={contact.id}
                              contactEmail={contact.email}
                              contactName={`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || undefined}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  {t('emailContacts.actions.viewActivityTimeline')}
                                </DropdownMenuItem>
                              }
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Status and Tags */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('emailContacts.table.status')}</span>
                          {getStatusBadge(contact.status)}
                        </div>

                        {contact.tags.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">{t('emailContacts.table.tags')}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {contact.tags.slice(0, 3).map((tag) => (
                                <Badge 
                                  key={tag.id} 
                                  variant="outline" 
                                  className="text-xs" 
                                  style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}
                                  data-testid={`badge-tag-card-${tag.id}`}
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                              {contact.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{contact.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Engagement */}
                        <div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">{t('emailContacts.table.engagement')}</span>
                          <div className="text-sm">
                            <p className="font-medium" data-testid={`text-engagement-rate-card-${contact.id}`}>
                              {getEngagementRate(contact.emailsSent, contact.emailsOpened)}% {t('emailContacts.table.openRate')}
                            </p>
                            <p className="text-gray-500" data-testid={`text-email-stats-card-${contact.id}`}>
                              {contact.emailsOpened}/{contact.emailsSent} {t('emailContacts.table.emails')}
                            </p>
                          </div>
                        </div>

                        {/* Added Date */}
                        <div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">{t('emailContacts.table.added')}</span>
                          <div className="text-sm">
                            <p data-testid={`text-added-date-card-${contact.id}`}>{formatDate(contact.addedDate)}</p>
                            {contact.lastActivity && (
                              <p className="text-gray-500" data-testid={`text-last-activity-card-${contact.id}`}>
                                {t('emailContacts.table.active')} {formatDate(contact.lastActivity)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        </CardContent>
      </Card>
      </div>

      {/* Contact View Drawer */}
      <ContactViewDrawer
        contactId={selectedContactId}
        open={!!selectedContactId}
        onOpenChange={(open) => !open && setSelectedContactId(null)}
      />
    </div>
  );
}