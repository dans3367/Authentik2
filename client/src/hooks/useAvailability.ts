import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReduxAuth } from "@/hooks/useReduxAuth";

// ─── Types (mirror the server serialization in availabilityRoutes.ts) ────────

export interface AvailabilityRange {
  start: string; // "HH:MM" 24h, provider-local wall-clock
  end: string;
}

export interface DayHours {
  day: number; // 0=Sunday .. 6=Saturday
  enabled: boolean;
  ranges: AvailabilityRange[];
}

export interface AvailabilityData {
  id: string | null;
  userId: string;
  weeklyHours: DayHours[];
  timezone: string;
  slotLengthMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
  bookableStartDate: string | null; // provider-local YYYY-MM-DD, or null = unbounded
  bookableEndDate: string | null;
  isBookable: boolean;
  isEnabled: boolean;
  bookingSlug: string | null;
  isDefault?: boolean;
}

export interface AvailabilityOverride {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: "off" | "custom";
  ranges: AvailabilityRange[] | null;
  note: string | null;
}

interface AvailabilityResponse {
  availability: AvailabilityData;
  overrides: AvailabilityOverride[];
}

export type UpsertAvailabilityInput = Partial<{
  weeklyHours: DayHours[];
  timezone: string;
  slotLengthMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
  bookableStartDate: string | null;
  bookableEndDate: string | null;
  isBookable: boolean;
  isEnabled: boolean;
}>;

export interface OverrideInput {
  id?: string;
  date: string;
  type: "off" | "custom";
  ranges?: AvailabilityRange[] | null;
  note?: string | null;
}

function availabilityPath(targetUserId?: string) {
  return targetUserId ? `/api/availability/${targetUserId}` : "/api/availability/me";
}

/**
 * Loads and mutates a single user's availability. Pass `targetUserId` to manage
 * another provider (requires the appointments.manage_availability permission);
 * omit it to manage your own (uses /me).
 */
export function useAvailability(targetUserId?: string) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useReduxAuth();

  const queryKey = ["/api/availability", targetUserId ?? "me"];
  // Override mutations need a concrete user id in the path (there is no /me/overrides).
  const resolvedUserId = targetUserId ?? user?.id;

  const query = useQuery<AvailabilityResponse>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", availabilityPath(targetUserId));
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const saveAvailability = useMutation({
    mutationFn: async (data: UpsertAvailabilityInput) => {
      const res = await apiRequest("PUT", availabilityPath(targetUserId), data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("reminders.toasts.success"), description: t("reminders.availability.toasts.saved") });
      invalidate();
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || t("reminders.availability.toasts.saveError"),
        variant: "destructive",
      });
    },
  });

  const saveOverride = useMutation({
    mutationFn: async (override: OverrideInput) => {
      if (override.id) {
        const { id, ...body } = override;
        const res = await apiRequest("PUT", `/api/availability/overrides/${id}`, body);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/availability/${resolvedUserId}/overrides`, override);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("reminders.toasts.success"), description: t("reminders.availability.toasts.overrideAdded") });
      invalidate();
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || t("reminders.availability.toasts.overrideError"),
        variant: "destructive",
      });
    },
  });

  const deleteOverride = useMutation({
    mutationFn: async (overrideId: string) => {
      const res = await apiRequest("DELETE", `/api/availability/overrides/${overrideId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("reminders.toasts.success"), description: t("reminders.availability.toasts.overrideRemoved") });
      invalidate();
    },
    onError: (error: any) => {
      toast({
        title: t("reminders.toasts.error"),
        description: error?.message || t("reminders.availability.toasts.overrideError"),
        variant: "destructive",
      });
    },
  });

  return {
    availability: query.data?.availability,
    overrides: query.data?.overrides ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    saveAvailability,
    saveOverride,
    deleteOverride,
  };
}
