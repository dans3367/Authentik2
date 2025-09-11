import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
  AlertTriangle,
  Loader2,
  Mail,
  Users,
  TrendingUp,
  Activity,
  RefreshCw,
  X,
} from 'lucide-react';

interface JobProgress {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  currentBatch?: number;
  totalBatches?: number;
  errors: Array<{
    email: string;
    error: string;
    timestamp: string;
  }>;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletionTime?: string;
}

interface WorkerStats {
  totalWorkers: number;
  activeWorkers: number;
  totalActiveJobs: number;
  totalQueuedJobs: number;
  totalJobs: number;
  isHealthy: boolean;
}

interface NewsletterWorkerProgressProps {
  jobId?: string;
  showWorkerStats?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const NewsletterWorkerProgress: React.FC<NewsletterWorkerProgressProps> = ({
  jobId,
  showWorkerStats = false,
  autoRefresh = true,
  refreshInterval = 5000,
}) => {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  // Query for specific job status
  const { data: jobStatus, isLoading: jobLoading, refetch: refetchJob } = useQuery<JobProgress>({
    queryKey: ['newsletter-job-status', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const response = await apiRequest('GET', `/api/newsletter-worker/jobs/${jobId}/status`);
      return response.job;
    },
    enabled: !!jobId,
    refetchInterval: autoRefresh && jobId ? refreshInterval : false,
    refetchIntervalInBackground: true,
  });

  // Query for all jobs
  const { data: allJobs, refetch: refetchAllJobs } = useQuery<Record<string, JobProgress>>({
    queryKey: ['newsletter-all-jobs'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletter-worker/jobs');
      return response.jobs;
    },
    enabled: !jobId || showWorkerStats,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true,
  });

  // Query for worker stats
  const { data: workerStats } = useQuery<WorkerStats>({
    queryKey: ['newsletter-worker-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletter-worker/workers/stats');
      return response.stats;
    },
    enabled: showWorkerStats,
    refetchInterval: autoRefresh ? refreshInterval * 2 : false, // Slower refresh for stats
  });

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: async (jobIdToCancel: string) => {
      return await apiRequest('POST', `/api/newsletter-worker/jobs/${jobIdToCancel}/cancel`);
    },
    onSuccess: () => {
      toast({
        title: 'Job Cancelled',
        description: 'The newsletter job has been cancelled successfully.',
      });
      refetchJob();
      refetchAllJobs();
    },
    onError: (error: any) => {
      toast({
        title: 'Cancel Failed',
        description: error?.message || 'Failed to cancel the job.',
        variant: 'destructive',
      });
    },
  });

  const getStatusIcon = (status: JobProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: JobProgress['status']) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      cancelled: 'secondary',
      processing: 'default',
      pending: 'outline',
    } as const;

    return (
      <Badge variant={variants[status]} className="ml-2">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString();
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'N/A';
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const renderJobCard = (job: JobProgress) => (
    <Card key={job.jobId} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center">
            {getStatusIcon(job.status)}
            <span className="ml-2">Job {job.jobId.split('-').pop()}</span>
            {getStatusBadge(job.status)}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchJob()}
              disabled={jobLoading}
            >
              <RefreshCw className={`h-3 w-3 ${jobLoading ? 'animate-spin' : ''}`} />
            </Button>
            {(job.status === 'pending' || job.status === 'processing') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelJobMutation.mutate(job.jobId)}
                disabled={cancelJobMutation.isPending}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="w-full" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{job.sent} sent</span>
              <span>{job.failed} failed</span>
              <span>{job.total} total</span>
            </div>
          </div>

          {/* Batch Progress */}
          {job.currentBatch && job.totalBatches && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center">
                <Activity className="h-3 w-3 mr-1" />
                Batch Progress
              </span>
              <span>
                {job.currentBatch} / {job.totalBatches}
              </span>
            </div>
          )}

          {/* Timing Information */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Started:</span>
              <div>{formatTime(job.startedAt)}</div>
            </div>
            <div>
              <span className="text-gray-500">Duration:</span>
              <div>{formatDuration(job.startedAt, job.completedAt)}</div>
            </div>
            {job.estimatedCompletionTime && job.status === 'processing' && (
              <div className="col-span-2">
                <span className="text-gray-500">Estimated completion:</span>
                <div>{formatTime(job.estimatedCompletionTime)}</div>
              </div>
            )}
          </div>

          {/* Errors */}
          {job.errors.length > 0 && (
            <div className="space-y-2">
              <div
                className="flex items-center cursor-pointer text-sm text-red-600"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {job.errors.length} error(s)
                <span className="ml-1">{isExpanded ? '▼' : '▶'}</span>
              </div>
              {isExpanded && (
                <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded text-xs">
                  {job.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="mb-1">
                      <strong>{error.email}:</strong> {error.error}
                    </div>
                  ))}
                  {job.errors.length > 5 && (
                    <div className="text-gray-500">
                      ... and {job.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderWorkerStats = () => {
    if (!workerStats) return null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            Worker System Status
            <Badge 
              variant={workerStats.isHealthy ? 'default' : 'destructive'} 
              className="ml-2"
            >
              {workerStats.isHealthy ? 'Healthy' : 'Unhealthy'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {workerStats.activeWorkers}/{workerStats.totalWorkers}
              </div>
              <div className="text-gray-500">Active Workers</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {workerStats.totalActiveJobs}
              </div>
              <div className="text-gray-500">Active Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-600">
                {workerStats.totalQueuedJobs}
              </div>
              <div className="text-gray-500">Queued Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">
                {workerStats.totalJobs}
              </div>
              <div className="text-gray-500">Total Jobs</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (jobId && jobLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading job status...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showWorkerStats && renderWorkerStats()}
      
      {jobId && jobStatus && renderJobCard(jobStatus)}
      
      {!jobId && allJobs && Object.keys(allJobs).length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center">
            <Mail className="h-4 w-4 mr-2" />
            Recent Newsletter Jobs
          </h3>
          {Object.values(allJobs)
            .sort((a, b) => new Date(b.startedAt || '').getTime() - new Date(a.startedAt || '').getTime())
            .slice(0, 5)
            .map(renderJobCard)}
        </div>
      )}
      
      {!jobId && allJobs && Object.keys(allJobs).length === 0 && (
        <Card>
          <CardContent className="text-center py-6">
            <Mail className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No newsletter jobs found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewsletterWorkerProgress;

