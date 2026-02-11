import { useQuery } from "@tanstack/react-query";

export interface StatMetric {
  value: number;
  change: number | null;
}

export interface HighlightStats {
  totalContacts: StatMetric;
  emailsSentThisMonth: StatMetric;
  newslettersSent: StatMetric;
  upcomingAppointments: StatMetric;
}

export function useDashboardHighlights() {
  const { data, isLoading, error, refetch } = useQuery<HighlightStats>({
    queryKey: ["/api/stats/highlights"],
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    retry: 1,
  });

  return {
    data: data ?? null,
    isLoading,
    error,
    refetch,
  };
}
