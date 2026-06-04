import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RangeList } from "./RangeList";
import type { DayHours } from "@/hooks/useAvailability";

interface WeeklyHoursEditorProps {
  value: DayHours[];
  onChange: (value: DayHours[]) => void;
}

const DEFAULT_RANGE = { start: "09:00", end: "17:00" };

export function WeeklyHoursEditor({ value, onChange }: WeeklyHoursEditorProps) {
  const { t } = useTranslation();

  const updateDay = (day: number, patch: Partial<DayHours>) =>
    onChange(value.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  const toggleDay = (day: number, enabled: boolean) => {
    const current = value.find((d) => d.day === day);
    const ranges = enabled && (!current || current.ranges.length === 0) ? [{ ...DEFAULT_RANGE }] : current?.ranges ?? [];
    updateDay(day, { enabled, ranges });
  };

  const copyToAll = (day: number) => {
    const source = value.find((d) => d.day === day);
    if (!source) return;
    onChange(value.map((d) => ({ ...d, enabled: source.enabled, ranges: source.ranges.map((r) => ({ ...r })) })));
  };

  // Render in stored order (0=Sunday .. 6=Saturday).
  const days = [...value].sort((a, b) => a.day - b.day);

  return (
    <div className="flex flex-col divide-y dark:divide-neutral-800">
      {days.map((d) => (
        <div key={d.day} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex items-center gap-3 pt-1 sm:w-44 sm:shrink-0">
            <Switch checked={d.enabled} onCheckedChange={(c) => toggleDay(d.day, c)} />
            <span className="font-medium">{t(`reminders.availability.days.${d.day}`)}</span>
          </div>
          <div className="flex-1">
            {d.enabled ? (
              <div className="flex flex-col gap-2">
                <RangeList ranges={d.ranges} onChange={(ranges) => updateDay(d.day, { ranges })} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-xs text-muted-foreground"
                  onClick={() => copyToAll(d.day)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {t("reminders.availability.copyToAll")}
                </Button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">{t("reminders.availability.unavailable")}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
