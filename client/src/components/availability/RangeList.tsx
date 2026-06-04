import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AvailabilityRange } from "@/hooks/useAvailability";

interface RangeListProps {
  ranges: AvailabilityRange[];
  onChange: (ranges: AvailabilityRange[]) => void;
}

/**
 * Returns an error key (relative to reminders.availability.errors) per range, or
 * null when valid. Mirrors the server zod validation: end must be after start,
 * and ranges may not overlap. Cross-midnight ranges are not supported.
 */
export function getRangeErrors(ranges: AvailabilityRange[]): (string | null)[] {
  const errors: (string | null)[] = ranges.map(() => null);
  ranges.forEach((r, i) => {
    if (r.start && r.end && r.start >= r.end) errors[i] = "endBeforeStart";
  });
  const sorted = ranges.map((r, i) => ({ r, i })).sort((a, b) => a.r.start.localeCompare(b.r.start));
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1];
    const cur = sorted[k];
    if (cur.r.start && prev.r.end && cur.r.start < prev.r.end && !errors[cur.i]) {
      errors[cur.i] = "overlap";
    }
  }
  return errors;
}

export function RangeList({ ranges, onChange }: RangeListProps) {
  const { t } = useTranslation();
  const errors = getRangeErrors(ranges);

  const updateRange = (index: number, patch: Partial<AvailabilityRange>) =>
    onChange(ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const removeRange = (index: number) => onChange(ranges.filter((_, i) => i !== index));
  const addRange = () => onChange([...ranges, { start: "09:00", end: "17:00" }]);

  return (
    <div className="flex flex-col gap-2">
      {ranges.map((range, index) => (
        <div key={index} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={range.start}
              onChange={(e) => updateRange(index, { start: e.target.value })}
              className="w-32"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time"
              value={range.end}
              onChange={(e) => updateRange(index, { end: e.target.value })}
              className="w-32"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeRange(index)} aria-label="Remove time range">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {errors[index] && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {t(`reminders.availability.errors.${errors[index]}`)}
            </p>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRange} className="w-fit">
        <Plus className="h-4 w-4 mr-1" />
        {t("reminders.availability.addRange")}
      </Button>
    </div>
  );
}
