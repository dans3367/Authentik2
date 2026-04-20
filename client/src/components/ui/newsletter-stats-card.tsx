import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function NewsletterStatsCard() {
  const { t } = useTranslation();

  return (
    <Card className="h-full rounded-2xl border-border/50">
      <CardHeader className="pb-2 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <CardTitle className="text-base font-bold tracking-tight">
            {t("dashboard.newsletterStats.title", "Newsletter stats")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <BarChart3 className="w-4 h-4 text-muted-foreground/60" />
          </div>
          <p className="text-xs font-medium text-muted-foreground/80">
            {t("dashboard.newsletterStats.empty", "Newsletter stats coming soon")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
