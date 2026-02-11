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

  return {
    plan: data?.plan ?? null,
    usage: data?.usage ?? null,
    isLoading,
    error,
    refetch,

    // Convenience booleans
    planName: data?.plan?.name ?? "Free Plan",
    canManageUsers: data?.plan?.allowUsersManagement ?? false,
    canManageRoles: data?.plan?.allowRolesManagement ?? false,
    canAddShops: data?.usage?.shops?.canAdd ?? false,
    canSendEmails: data?.usage?.emails?.canSend ?? false,
    canAddUsers: data?.usage?.users?.canAdd ?? false,
    emailsRemaining: data?.usage?.emails?.remaining ?? 0,
    maxShops: data?.plan?.maxShops ?? 0,
    maxUsers: data?.plan?.maxUsers ?? 1,
    monthlyEmailLimit: data?.plan?.monthlyEmailLimit ?? 100,
  };
}
