import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Copy, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAvailability } from "@/hooks/useAvailability";

// Appointment settings for the current user. Currently surfaces the public
// booking link (slug); a home for future per-user appointment settings.
export function AppointmentSettingsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { availability, isLoading } = useAvailability(); // own availability (/me)

  const slug = availability?.bookingSlug ?? null;
  const link = slug ? `${window.location.origin}/book/${slug}` : "";

  const copy = () => {
    navigator.clipboard?.writeText(link);
    toast({ description: t("reminders.availability.linkCopied") });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            {t("reminders.availability.bookingLink")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : slug ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t("reminders.availability.settings.linkDescription")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  readOnly
                  value={link}
                  className="font-mono text-sm"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" className="shrink-0" onClick={copy}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t("reminders.availability.copyLink")}
                </Button>
                <Button asChild variant="outline" className="shrink-0">
                  <a href={link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("reminders.availability.settings.openLink")}
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("reminders.availability.linkUnavailable")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
