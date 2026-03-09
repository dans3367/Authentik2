import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Newspaper, ArrowRight, Sparkles, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EditorPickerModal } from "@/components/EditorPickerModal";

export function NewsletterCard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [showEditorPicker, setShowEditorPicker] = useState(false);

  const handleCreateNewsletter = () => {
    setShowEditorPicker(true);
  };

  return (
    <>
    <Card className="h-full group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 dark:from-primary/90 dark:via-blue-700 dark:to-indigo-800" />

      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/[0.07] blur-2xl group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-white/[0.04] blur-2xl translate-y-1/2 -translate-x-1/4" />

      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '20px 20px'
      }} />

      <CardContent className="relative p-6 sm:p-8 flex flex-col justify-center h-full min-h-[240px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-[11px] font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              {t("dashboard.newsletterCard.getStarted")}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight">
              {t("dashboard.newsletterCard.title")}
            </h2>

            <p className="text-white/70 text-sm leading-relaxed max-w-md">
              {t("dashboard.newsletterCard.description")}
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                onClick={handleCreateNewsletter}
                size="default"
                className="bg-white text-indigo-700 font-semibold shadow-lg group/btn"
                data-testid="button-create-newsletter"
              >
                <Newspaper className="w-4 h-4 mr-2" />
                {t("dashboard.newsletterCard.create")}
                <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => setLocation("/newsletter")}
                variant="ghost"
                size="default"
                className="text-white/80 font-medium"
                data-testid="button-view-all-newsletters"
              >
                <Send className="w-4 h-4 mr-2" />
                {t("dashboard.newsletterCard.viewAll")}
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-2xl bg-white/10 backdrop-blur-sm rotate-6 group-hover:rotate-12 transition-transform duration-500" />
              <div className="absolute inset-2 rounded-xl bg-white/15 backdrop-blur-md flex flex-col items-center justify-center gap-2 -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <Newspaper className="w-9 h-9 text-white/80" />
                <div className="flex gap-1">
                  <div className="w-7 h-1 rounded-full bg-white/40" />
                  <div className="w-4 h-1 rounded-full bg-white/25" />
                </div>
                <div className="flex gap-1">
                  <div className="w-4 h-1 rounded-full bg-white/30" />
                  <div className="w-7 h-1 rounded-full bg-white/20" />
                </div>
                <div className="w-9 h-1 rounded-full bg-white/15 mt-0.5" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <EditorPickerModal open={showEditorPicker} onOpenChange={setShowEditorPicker} />
    </>
  );
}
