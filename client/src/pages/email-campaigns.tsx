import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Target, TrendingUp, Calendar, DollarSign } from 'lucide-react';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px] mb-2" />
              <Skeleton className="h-3 w-[120px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: 'Total Campaigns',
      value: (stats as any)?.totalCampaigns || 0,
      icon: Target,
      description: 'All campaigns created',
    },
    {
      title: 'Active Campaigns',
      value: (stats as any)?.activeCampaigns || 0,
      icon: TrendingUp,
      description: 'Currently running',
    },
    {
      title: 'Draft Campaigns',
      value: (stats as any)?.draftCampaigns || 0,
      icon: Edit,
      description: 'In preparation',
    },
    {
      title: 'Completed',
      value: (stats as any)?.completedCampaigns || 0,
      icon: Calendar,
      description: 'Successfully finished',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
      {statsData.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CampaignsTable({ campaigns, onDelete }: { campaigns: Campaign[]; onDelete: (id: string) => void }) {
  const [, setLocation] = useLocation();

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Target className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No campaigns found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
            Get started by creating your first marketing campaign.
          </p>
          <Button onClick={() => setLocation('/campaigns/create')} data-testid="button-create-campaign">
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
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
                    <div className="font-medium text-gray-900 dark:text-white">
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
      </div>
    </Card>
  );
}

export default function EmailCampaignsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="text-red-500 mb-4">
                <Target className="h-16 w-16" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to load campaigns
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center">
                {error?.message || 'An error occurred while fetching campaigns.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6 lg:space-y-8">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Email Campaigns
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage and track your marketing campaigns across all channels.
                </p>
              </div>
              <Button onClick={() => setLocation('/campaigns/create')} data-testid="button-create-campaign" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          </div>

          {/* Stats */}
          <CampaignStats />

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter and search through your campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search campaigns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-campaigns"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter by status" />
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
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-type-filter">
                      <SelectValue placeholder="Filter by type" />
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
            </CardContent>
          </Card>

          {/* Campaigns Table */}
          {isLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-4 w-[300px]" />
                      </div>
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="h-4 w-[100px]" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <CampaignsTable campaigns={filteredCampaigns} onDelete={handleDelete} />
          )}
        </div>
      </div>
    </div>
  );
}