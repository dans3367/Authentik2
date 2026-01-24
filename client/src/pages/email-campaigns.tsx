import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Target, TrendingUp, Calendar, DollarSign, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { type Campaign } from '@shared/schema';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const typeColors = {
  email: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  sms: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  push: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  social: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
};

function CampaignStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/campaign-stats'],
  });

  if (isLoading) {
    return (
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-1">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-8 w-[60px]" />
              <Skeleton className="h-3 w-[120px]" />
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  const statsData = [
    {
      title: 'Total Campaigns',
      value: (stats as any)?.totalCampaigns || 0,
      description: 'All campaigns created',
    },
    {
      title: 'Active Campaigns',
      value: (stats as any)?.activeCampaigns || 0,
      description: 'Currently running',
    },
    {
      title: 'Draft Campaigns',
      value: (stats as any)?.draftCampaigns || 0,
      description: 'In preparation',
    },
    {
      title: 'Completed',
      value: (stats as any)?.completedCampaigns || 0,
      description: 'Successfully finished',
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statsData.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-5 space-y-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {stat.title}
            </p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function CampaignsTableContent({ campaigns, onDelete }: { campaigns: Campaign[]; onDelete: (id: string) => void }) {
  const [, setLocation] = useLocation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[200px]">Campaign</TableHead>
          <TableHead className="min-w-[80px]">Type</TableHead>
          <TableHead className="min-w-[80px]">Status</TableHead>
          <TableHead className="min-w-[100px]">Budget</TableHead>
          <TableHead className="min-w-[150px]">Timeline</TableHead>
          <TableHead className="min-w-[120px]">Performance</TableHead>
          <TableHead className="w-[70px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign) => (
          <TableRow key={campaign.id}>
            <TableCell>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-50">
                  {campaign.name}
                </div>
                {campaign.description && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[250px]">
                    {campaign.description}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge className={typeColors[campaign.type as keyof typeof typeColors]}>
                {campaign.type}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
                {campaign.status}
              </Badge>
            </TableCell>
            <TableCell>
              {campaign.budget ? (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>{parseFloat(campaign.budget).toLocaleString()}</span>
                  <span className="text-xs text-gray-400">{campaign.currency}</span>
                </div>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {campaign.startDate && (
                  <div>Start: {format(new Date(campaign.startDate), 'MMM dd, yyyy')}</div>
                )}
                {campaign.endDate && (
                  <div className="text-gray-500">End: {format(new Date(campaign.endDate), 'MMM dd, yyyy')}</div>
                )}
                {!campaign.startDate && !campaign.endDate && (
                  <span className="text-gray-400">Not scheduled</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <div>Impressions: {campaign.impressions?.toLocaleString() || 0}</div>
                <div className="text-gray-500">Clicks: {campaign.clicks?.toLocaleString() || 0}</div>
              </div>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid={`button-actions-${campaign.id}`}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setLocation(`/email-campaigns/edit/${campaign.id}`)}
                    data-testid={`button-edit-${campaign.id}`}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{campaign.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(campaign.id)} data-testid={`button-confirm-delete-${campaign.id}`}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function EmailCampaignsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Email Campaigns", icon: Target }
  ]);
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ['/api/campaigns'],
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest('DELETE', `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-stats'] });
      toast({
        title: 'Success',
        description: 'Campaign deleted successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Delete campaign error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete campaign.',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (campaignId: string) => {
    deleteCampaignMutation.mutate(campaignId);
  };

  // Filter campaigns
  const filteredCampaigns = (campaignsData as any)?.campaigns?.filter((campaign: Campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesType = typeFilter === 'all' || campaign.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto p-6 space-y-8">
          <section className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg shadow-sm">
            <div className="p-6">
              <Card className="border-dashed border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                <CardContent className="py-12 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Failed to load campaigns</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error?.message || 'An error occurred while fetching campaigns.'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Email Campaigns</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage and track your marketing campaigns across all channels.
            </p>
          </div>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setLocation('/campaigns/create')} 
            data-testid="button-create-campaign"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        </header>

        <CampaignStats />

        <section className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg shadow-sm">
          <div className="border-b border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-campaigns"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-muted-foreground">Loading campaigns...</p>
                </div>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Target className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">
                  No campaigns found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
                  Get started by creating your first marketing campaign.
                </p>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setLocation('/campaigns/create')} 
                  data-testid="button-create-campaign-empty"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <CampaignsTableContent campaigns={filteredCampaigns} onDelete={handleDelete} />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}