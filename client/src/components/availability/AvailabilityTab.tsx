import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Clock, CalendarClock, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useAvailability, type DayHours } from "@/hooks/useAvailability";
import { WeeklyHoursEditor } from "./WeeklyHoursEditor";
import { DateOverridesEditor } from "./DateOverridesEditor";
import { BookingRulesForm, type BookingRulesValue } from "./BookingRulesForm";
import { ProviderAvailabilityPicker } from "./ProviderAvailabilityPicker";

interface Draft extends BookingRulesValue {
  weeklyHours: DayHours[];
}

export function AvailabilityTab() {
  const { t } = useTranslation();
  const { user } = useReduxAuth();
  const { hasPermission } = usePermissions();
  const canManageOthers = hasPermission("appointments.manage_availability");
  const { providers } = useAssignableUsers();

  // Whose availability is being edited. undefined → own (/me endpoint).
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined);
  const effectiveTarget = canManageOthers ? targetUserId : undefined;

  const { availability, overrides, isLoading, saveAvailability, saveOverride, deleteOverride } =
    useAvailability(effectiveTarget);

  const [draft, setDraft] = useState<Draft | null>(null);

  // Re-seed the working draft whenever the loaded availability changes
  // (initial load, save, or switching to another provider).
  useEffect(() => {
    if (!availability) return;
    setDraft({
      weeklyHours: availability.weeklyHours,
      timezone: availability.timezone,
      slotLengthMinutes: availability.slotLengthMinutes,
      bufferMinutes: availability.bufferMinutes,
      minimumNoticeHours: availability.minimumNoticeHours,
      bookingHorizonDays: availability.bookingHorizonDays,
      bookableStartDate: availability.bookableStartDate,
      bookableEndDate: availability.bookableEndDate,
      isBookable: availability.isBookable,
      isEnabled: availability.isEnabled,
    });
  }, [availability]);

  const patchDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleSave = () => {
    if (draft) saveAvailability.mutate(draft);
  };

  const pickerValue = effectiveTarget ?? user?.id ?? "";

  if (isLoading || !draft) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("reminders.availability.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("reminders.availability.subtitle")}</p>
        </div>
        {canManageOthers && providers.length > 0 && (
          <ProviderAvailabilityPicker
            providers={providers}
            value={pickerValue}
            onChange={(id) => setTargetUserId(id === user?.id ? undefined : id)}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            {t("reminders.availability.weeklyHours")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyHoursEditor value={draft.weeklyHours} onChange={(weeklyHours) => patchDraft({ weeklyHours })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            {t("reminders.availability.overrides.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DateOverridesEditor
            overrides={overrides}
            onSave={(input) => saveOverride.mutate(input)}
            onDelete={(id) => deleteOverride.mutate(id)}
            isSaving={saveOverride.isPending}
            isDeleting={deleteOverride.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            {t("reminders.availability.rules.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BookingRulesForm value={draft} onChange={patchDraft} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveAvailability.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveAvailability.isPending ? t("reminders.availability.saving") : t("reminders.availability.save")}
        </Button>
      </div>
    </div>
  );
}
