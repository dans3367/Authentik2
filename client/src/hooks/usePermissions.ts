import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PermissionsData {
  permissions: Record<string, boolean>;
}

export function usePermissions() {
  const { data, isLoading, error } = useQuery<PermissionsData>({
    queryKey: ["/api/me/permissions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/me/permissions");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  const permissions = data?.permissions ?? {};

  const hasPermission = (permission: string): boolean => {
    if (isLoading || error) return true; // Permissive while loading to avoid flickering
    return permissions[permission] === true;
  };

  return {
    permissions,
    hasPermission,
    isLoading,
    error,
  };
}
