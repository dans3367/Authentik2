import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type DashboardLayout = {
  cardOrder?: string[];
  cardSizes?: Record<string, number>;
};

type LayoutResponse = { layout: DashboardLayout | null };

const LAYOUT_QUERY_KEY = ["/api/users/dashboard-layout"] as const;

export function useDashboardLayout() {
  const queryClient = useQueryClient();

  const query = useQuery<LayoutResponse>({
    queryKey: LAYOUT_QUERY_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/dashboard-layout");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation<LayoutResponse, Error, DashboardLayout>({
    mutationFn: async (layout) => {
      const res = await apiRequest("PATCH", "/api/users/dashboard-layout", layout);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData<LayoutResponse>(LAYOUT_QUERY_KEY, data);
    },
  });

  return {
    layout: query.data?.layout ?? null,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    saveLayout: mutation.mutate,
  };
}
