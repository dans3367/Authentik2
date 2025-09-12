import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export interface SendNewsletterOptions {
  newsletterId: string;
  testEmail?: string;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
  batchSize?: number;
}

export interface NewsletterJobResponse {
  message: string;
  jobId: string;
  groupUUID?: string;
  recipientCount?: number;
  status: string;
  newsletter?: {
    id: string;
    title: string;
    subject: string;
  };
}

export function useNewsletterWorker() {
  const { toast } = useToast();

  // Send newsletter using worker system
  const sendNewsletterMutation = useMutation({
    mutationFn: async (options: SendNewsletterOptions): Promise<NewsletterJobResponse> => {
      const { newsletterId, ...requestBody } = options;
      
      const response = await apiRequest(
        'POST',
        `/api/newsletter-worker/${newsletterId}/send-with-worker`,
        requestBody
      );
      
      return response;
    },
    onSuccess: (data, variables) => {
      if (variables.testEmail) {
        toast({
          title: 'Test Email Queued',
          description: `Test newsletter job created: ${data.jobId}`,
        });
      } else {
        toast({
          title: 'Newsletter Queued Successfully',
          description: `Newsletter job created with ${data.recipientCount} recipients. Job ID: ${data.jobId}`,
        });
      }
    },
    onError: (error: any, variables) => {
      const errorMessage = error?.message || 'Failed to send newsletter';
      
      if (variables.testEmail) {
        toast({
          title: 'Test Email Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Newsletter Send Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
  });

  // Cancel newsletter job
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest(
        'POST',
        `/api/newsletter-worker/jobs/${jobId}/cancel`
      );
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Job Cancelled',
        description: 'Newsletter job has been cancelled successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Cancel Failed',
        description: error?.message || 'Failed to cancel job',
        variant: 'destructive',
      });
    },
  });

  // Get worker stats
  const getWorkerStatsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/newsletter-worker/workers/stats');
      return response;
    },
  });

  // Scale workers (admin function)
  const scaleWorkersMutation = useMutation({
    mutationFn: async (workerCount: number) => {
      const response = await apiRequest(
        'POST',
        '/api/newsletter-worker/workers/scale',
        { workerCount }
      );
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: 'Workers Scaled',
        description: `Successfully scaled to ${data.workerCount} workers.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Scale Failed',
        description: error?.message || 'Failed to scale workers',
        variant: 'destructive',
      });
    },
  });

  // Emergency stop (admin function)
  const emergencyStopMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/newsletter-worker/workers/emergency-stop');
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Emergency Stop Executed',
        description: 'All newsletter jobs have been stopped.',
        variant: 'destructive',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Emergency Stop Failed',
        description: error?.message || 'Failed to execute emergency stop',
        variant: 'destructive',
      });
    },
  });

  return {
    // Main functions
    sendNewsletter: sendNewsletterMutation.mutate,
    sendNewsletterAsync: sendNewsletterMutation.mutateAsync,
    isSending: sendNewsletterMutation.isPending,
    
    cancelJob: cancelJobMutation.mutate,
    cancelJobAsync: cancelJobMutation.mutateAsync,
    isCancelling: cancelJobMutation.isPending,
    
    // Admin functions
    getWorkerStats: getWorkerStatsMutation.mutate,
    getWorkerStatsAsync: getWorkerStatsMutation.mutateAsync,
    isGettingStats: getWorkerStatsMutation.isPending,
    
    scaleWorkers: scaleWorkersMutation.mutate,
    scaleWorkersAsync: scaleWorkersMutation.mutateAsync,
    isScaling: scaleWorkersMutation.isPending,
    
    emergencyStop: emergencyStopMutation.mutate,
    emergencyStopAsync: emergencyStopMutation.mutateAsync,
    isEmergencyStopping: emergencyStopMutation.isPending,
    
    // Mutation objects for advanced usage
    sendNewsletterMutation,
    cancelJobMutation,
    getWorkerStatsMutation,
    scaleWorkersMutation,
    emergencyStopMutation,
  };
}

export default useNewsletterWorker;

