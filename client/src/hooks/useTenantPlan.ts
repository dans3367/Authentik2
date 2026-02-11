import { useQuery } from "@tanstack/react-query";

export interface TenantPlanData {
  plan: {
    name: string;
    maxUsers: number | null;
    maxShops: number | null;
    monthlyEmailLimit: number | null;
    allowUsersManagement: boolean;
    allowRolesManagement: boolean;
    subscriptionStatus: string | null;
  };
  usage: {
    emails: {
      current: number;
      limit: number | null;
      remaining: number | null;
      canSend: boolean;
    };
    shops: {
      current: number;
      limit: number | null;
      canAdd: boolean;
    };
    users: {
      current: number;
      limit: number | null;
      canAdd: boolean;
    };
  };
}

export function useTenantPlan() {
  const { data, isLoading, error, refetch } = useQuery<TenantPlanData>({
    queryKey: ["/api/subscription/tenant-plan"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Don't apply restrictive defaults during loading or error states
  const hasData = !isLoading && !error && data;

  return {
    plan: data?.plan ?? null,
    usage: data?.usage ?? null,
    isLoading,
    error,
    refetch,

    // Convenience booleans - only apply restrictive defaults when data is loaded
    planName: data?.plan?.name ?? "Free Plan",
    canManageUsers: hasData ? (data.plan?.allowUsersManagement ?? false) : true,
    canManageRoles: hasData ? (data.plan?.allowRolesManagement ?? false) : true,
    canAddShops: hasData ? (data.usage?.shops?.canAdd ?? false) : true,
    canSendEmails: hasData ? (data.usage?.emails?.canSend ?? false) : true,
    canAddUsers: hasData ? (data.usage?.users?.canAdd ?? false) : true,
    emailsRemaining: data?.usage?.emails?.remaining ?? 0,
    maxShops: data?.plan?.maxShops ?? 0,
    maxUsers: data?.plan?.maxUsers ?? 1,
    monthlyEmailLimit: data?.plan?.monthlyEmailLimit ?? 100,
  };
}
