import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import type { AppointmentProvider } from "@/utils/appointment-utils";

interface ProviderAvailabilityPickerProps {
  providers: AppointmentProvider[];
  value: string;
  onChange: (userId: string) => void;
}

export function ProviderAvailabilityPicker({ providers, value, onChange }: ProviderAvailabilityPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <Label className="text-sm text-muted-foreground whitespace-nowrap">
        {t("reminders.availability.viewingFor")}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder={t("reminders.availability.selectProvider")} />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
