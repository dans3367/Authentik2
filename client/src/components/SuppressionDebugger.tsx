import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Search,
  Info,
  Mail,
  Users,
  Shield,
} from 'lucide-react';

interface SuppressionStats {
  totalSuppressedGlobally: number;
  totalActiveContacts: number;
  suppressedContactsForTenant: number;
  suppressionRate: number;
  suppressedByType: Array<{
    type: string;
    count: number;
  }>;
}

interface SuppressionDebuggerProps {
  newsletterId?: string;
}

export const SuppressionDebugger: React.FC<SuppressionDebuggerProps> = ({ newsletterId }) => {
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get suppression statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<{
    statistics: SuppressionStats;
    suppressedContacts: any[];
  }>({
    queryKey: ['suppression-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/suppression/stats');
      return response;
    },
  });

  // Debug specific newsletter recipients
  const { data: debugData, refetch: refetchDebug } = useQuery({
    queryKey: ['newsletter-debug', newsletterId],
    queryFn: async () => {
      if (!newsletterId) return null;
      const response = await apiRequest('GET', `/api/newsletters/${newsletterId}/debug-recipients`);
      return response;
    },
    enabled: !!newsletterId,
  });

  // Check specific email
  const checkEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('GET', `/api/suppression/check/${encodeURIComponent(email)}`);
      return response;
    },
  });

  // Remove email from suppression
  const removeSuppressionMutation = useMutation({
    mutationFn: async ({ email, reason }: { email: string; reason: string }) => {
      const response = await apiRequest('DELETE', `/api/suppression/remove/${encodeURIComponent(email)}`, {
        reason,
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Suppression Removed',
        description: 'Email has been removed from the suppression list.',
      });
      refetchStats();
      refetchDebug();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Remove',
        description: error?.message || 'Failed to remove email from suppression list.',
        variant: 'destructive',
      });
    },
  });

  const handleCheckEmail = () => {
    if (!searchEmail.trim()) return;
    checkEmailMutation.mutate(searchEmail.trim());
  };

  const handleRemoveSuppression = (email: string) => {
    const reason = prompt('Enter reason for removing this email from suppression list:');
    if (reason) {
      removeSuppressionMutation.mutate({ email, reason });
    }
  };

  const renderSuppressionStats = () => {
    if (!stats) return null;

    const { statistics } = stats;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Global Suppressions</p>
                <p className="text-2xl font-bold text-red-600">{statistics.totalSuppressedGlobally}</p>
              </div>
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Contacts</p>
                <p className="text-2xl font-bold text-green-600">{statistics.totalActiveContacts}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tenant Suppressions</p>
                <p className="text-2xl font-bold text-orange-600">{statistics.suppressedContactsForTenant}</p>
              </div>
              <Mail className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Suppression Rate</p>
                <p className="text-2xl font-bold text-purple-600">{statistics.suppressionRate}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderNewsletterDebug = () => {
    if (!debugData) return null;

    const { analysis, newsletter } = debugData;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="h-5 w-5 mr-2" />
            Newsletter Recipients Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{newsletter.title}</h4>
              <Badge variant={analysis.validRecipients > 0 ? 'default' : 'destructive'}>
                {analysis.validRecipients} valid of {analysis.totalRecipients} total
              </Badge>
            </div>

            {analysis.suppressionRate === 100 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-800">
                  <strong>All recipients are suppressed!</strong> This newsletter cannot be sent.
                  You need to either add new contacts or remove some emails from the suppression list.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">{analysis.totalRecipients}</div>
                <div className="text-sm text-gray-600">Total Recipients</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">{analysis.validRecipients}</div>
                <div className="text-sm text-gray-600">Valid</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">{analysis.suppressedRecipients}</div>
                <div className="text-sm text-gray-600">Suppressed</div>
              </div>
            </div>

            {debugData.suppressedSample && debugData.suppressedSample.length > 0 && (
              <div>
                <h5 className="font-medium mb-2">Sample Suppressed Emails:</h5>
                <div className="space-y-2">
                  {debugData.suppressedSample.slice(0, 5).map((contact: any, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-red-50 p-2 rounded">
                      <span className="text-sm">{contact.email}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive" className="text-xs">
                          {contact.suppressionDetails?.reason || 'Suppressed'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveSuppression(contact.email)}
                          disabled={removeSuppressionMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Email Suppression Debugger</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchStats();
                refetchDebug();
              }}
              disabled={statsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Email Search */}
            <div className="flex space-x-2">
              <Input
                placeholder="Enter email address to check suppression status"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCheckEmail()}
              />
              <Button
                onClick={handleCheckEmail}
                disabled={!searchEmail.trim() || checkEmailMutation.isPending}
              >
                <Search className="h-4 w-4 mr-2" />
                Check
              </Button>
            </div>

            {/* Email Check Result */}
            {checkEmailMutation.data && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{checkEmailMutation.data.email}</span>
                  <div className="flex items-center space-x-2">
                    {checkEmailMutation.data.isSuppressed ? (
                      <Badge variant="destructive">Suppressed</Badge>
                    ) : (
                      <Badge variant="default">Clean</Badge>
                    )}
                    {checkEmailMutation.data.isContact && (
                      <Badge variant="outline">Contact</Badge>
                    )}
                  </div>
                </div>
                
                {checkEmailMutation.data.isSuppressed && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      <strong>Reason:</strong> {checkEmailMutation.data.suppressionDetails?.reason}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Type:</strong> {checkEmailMutation.data.suppressionDetails?.bounceType}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Suppressed:</strong> {new Date(checkEmailMutation.data.suppressionDetails?.suppressedAt).toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveSuppression(checkEmailMutation.data.email)}
                      disabled={removeSuppressionMutation.isPending}
                    >
                      Remove from Suppression List
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {renderSuppressionStats()}

      {/* Newsletter Debug */}
      {newsletterId && renderNewsletterDebug()}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>
            
            {showAdvanced && (
              <div className="space-y-2 pt-4 border-t">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> These actions can affect email deliverability. 
                    Only use if you understand the implications.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const confirm = window.confirm(
                        'Are you sure you want to view the suppression management page? This contains advanced features.'
                      );
                      if (confirm) {
                        window.open('/api/suppression/list', '_blank');
                      }
                    }}
                  >
                    View All Suppressions
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const confirm = window.confirm(
                        'This will show detailed statistics. Continue?'
                      );
                      if (confirm) {
                        window.open('/api/suppression/stats', '_blank');
                      }
                    }}
                  >
                    Detailed Stats
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuppressionDebugger;

