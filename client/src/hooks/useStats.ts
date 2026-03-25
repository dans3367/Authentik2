import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/store";
import { apiRequest } from "@/lib/queryClient";

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
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const { data, isLoading, error, refetch } = useQuery<HighlightStats>({
    queryKey: ["/api/stats/highlights", selectedShopId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stats/highlights");
      return response.json();
    },
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
