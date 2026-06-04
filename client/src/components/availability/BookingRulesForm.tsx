import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

export interface BookingRulesValue {
  timezone: string;
  slotLengthMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
  bookableStartDate: string | null; // YYYY-MM-DD or null = unbounded
  bookableEndDate: string | null;
  isBookable: boolean;
  isEnabled: boolean;
}

// Today as provider-local YYYY-MM-DD (en-CA formats that way) — used to block past dates.
function todayString(): string {
  return new Date().toLocaleDateString("en-CA");
}

interface BookingRulesFormProps {
  value: BookingRulesValue;
  onChange: (patch: Partial<BookingRulesValue>) => void;
}

const FALLBACK_TIMEZONES = [
  "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "UTC",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney",
];

function getTimezones(): string[] {
  try {
    const supported = (Intl as any).supportedValuesOf?.("timeZone");
    if (Array.isArray(supported) && supported.length) return supported;
  } catch {
    // older browsers — fall through
  }
  return FALLBACK_TIMEZONES;
}

type NumberField = "slotLengthMinutes" | "bufferMinutes" | "minimumNoticeHours" | "bookingHorizonDays";

export function BookingRulesForm({ value, onChange }: BookingRulesFormProps) {
  const { t } = useTranslation();
  const timezones = getTimezones();
  const today = todayString();
  const hasWindow = !!(value.bookableStartDate || value.bookableEndDate);
  const invalidWindow =
    !!value.bookableStartDate && !!value.bookableEndDate && value.bookableEndDate < value.bookableStartDate;

  const numberField = (key: NumberField, labelKey: string, min: number, max: number) => (
    <div className="flex flex-col gap-1">
      <Label className="text-sm">{t(labelKey)}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value[key]}
        onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<BookingRulesValue>)}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label className="text-sm">{t("reminders.availability.rules.timezone")}</Label>
        <Select value={value.timezone} onValueChange={(v) => onChange({ timezone: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {numberField("slotLengthMinutes", "reminders.availability.rules.slotLength", 5, 480)}
        {numberField("bufferMinutes", "reminders.availability.rules.buffer", 0, 240)}
        {numberField("minimumNoticeHours", "reminders.availability.rules.minimumNotice", 0, 8760)}
        {numberField("bookingHorizonDays", "reminders.availability.rules.bookingHorizon", 1, 365)}
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t("reminders.availability.rules.bookableWindow")}</Label>
          {hasWindow && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange({ bookableStartDate: null, bookableEndDate: null })}
            >
              {t("reminders.availability.rules.clearWindow")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("reminders.availability.rules.bookableWindowHelp")}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-sm">{t("reminders.availability.rules.bookableFrom")}</Label>
            <Input
              type="date"
              min={today}
              max={value.bookableEndDate || undefined}
              value={value.bookableStartDate ?? ""}
              onChange={(e) => onChange({ bookableStartDate: e.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">{t("reminders.availability.rules.bookableUntil")}</Label>
            <Input
              type="date"
              min={value.bookableStartDate && value.bookableStartDate > today ? value.bookableStartDate : today}
              value={value.bookableEndDate ?? ""}
              onChange={(e) => onChange({ bookableEndDate: e.target.value || null })}
            />
          </div>
        </div>
        {invalidWindow && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("reminders.availability.rules.windowEndBeforeStart")}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
        <Label className="text-sm">{t("reminders.availability.rules.isBookable")}</Label>
        <Switch checked={value.isBookable} onCheckedChange={(c) => onChange({ isBookable: c })} />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
        <Label className="text-sm">{t("reminders.availability.rules.isEnabled")}</Label>
        <Switch checked={value.isEnabled} onCheckedChange={(c) => onChange({ isEnabled: c })} />
      </div>
    </div>
  );
}
