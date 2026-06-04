import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CalendarOff, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RangeList, getRangeErrors } from "./RangeList";
import type { AvailabilityOverride, OverrideInput, AvailabilityRange } from "@/hooks/useAvailability";

interface DateOverridesEditorProps {
  overrides: AvailabilityOverride[];
  onSave: (input: OverrideInput) => void;
  onDelete: (id: string) => void;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export function DateOverridesEditor({ overrides, onSave, onDelete, isSaving }: DateOverridesEditorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [type, setType] = useState<"off" | "custom">("off");
  const [ranges, setRanges] = useState<AvailabilityRange[]>([{ start: "09:00", end: "17:00" }]);
  const [note, setNote] = useState("");

  // Today as local YYYY-MM-DD (en-CA), used to block selecting past dates.
  const today = new Date().toLocaleDateString("en-CA");

  const sorted = [...overrides].sort((a, b) => a.date.localeCompare(b.date));

  const reset = () => {
    setDate("");
    setType("off");
    setRanges([{ start: "09:00", end: "17:00" }]);
    setNote("");
  };
  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const rangeErrors = type === "custom" ? getRangeErrors(ranges) : [];
  const hasRangeError = rangeErrors.some((e) => e !== null);
  const duplicateDate = !!date && sorted.some((o) => o.date === date);
  const canSubmit = !!date && (type === "off" || (ranges.length > 0 && !hasRangeError));

  const submit = () => {
    if (!canSubmit) return;
    onSave({ date, type, ranges: type === "custom" ? ranges : null, note: note || null });
    handleOpenChange(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("reminders.availability.overrides.empty")}</p>
      ) : (
        <div className="flex flex-col divide-y dark:divide-neutral-800">
          {sorted.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-3">
                {o.type === "off" ? (
                  <CalendarOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">{o.date}</p>
                  <p className="text-sm text-muted-foreground">
                    {o.type === "off"
                      ? t("reminders.availability.overrides.dayOff")
                      : (o.ranges || []).map((r) => `${r.start}–${r.end}`).join(", ")}
                    {o.note ? ` · ${o.note}` : ""}
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(o.id)} aria-label="Remove override">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        {t("reminders.availability.overrides.add")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reminders.availability.overrides.add")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-sm">{t("reminders.availability.overrides.dateLabel")}</Label>
              <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              {duplicateDate && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("reminders.availability.errors.duplicateDate")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">{t("reminders.availability.overrides.typeLabel")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as "off" | "custom")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">{t("reminders.availability.overrides.dayOff")}</SelectItem>
                  <SelectItem value="custom">{t("reminders.availability.overrides.customHours")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "custom" && (
              <div className="flex flex-col gap-1">
                <Label className="text-sm">{t("reminders.availability.weeklyHours")}</Label>
                <RangeList ranges={ranges} onChange={setRanges} />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label className="text-sm">{t("reminders.availability.overrides.noteLabel")}</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder={t("reminders.availability.overrides.notePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={submit} disabled={!canSubmit || isSaving}>
              {t("reminders.availability.overrides.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
