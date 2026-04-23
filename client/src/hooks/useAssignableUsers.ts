import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AppointmentProvider } from "@/utils/appointment-utils";

export function useAssignableUsers() {
  const { data, isLoading, error } = useQuery<{ users: AppointmentProvider[] }>({
    queryKey: ["/api/users/assignable"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/assignable");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    providers: data?.users ?? [],
    isLoading,
    error,
  };
}
