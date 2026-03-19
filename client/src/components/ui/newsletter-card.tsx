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

      <CardContent className="relative p-6 sm:p-10 flex flex-col justify-center h-full min-h-[280px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 h-full">
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              {t("dashboard.newsletterCard.getStarted")}
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
              {t("dashboard.newsletterCard.title")}
            </h2>

            <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-xl">
              {t("dashboard.newsletterCard.description")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-3">
              <Button
                onClick={handleCreateNewsletter}
                size="lg"
                className="bg-white text-indigo-700 font-bold shadow-xl shadow-black/10 group/btn px-6 text-base"
                data-testid="button-create-newsletter"
              >
                <Newspaper className="w-5 h-5 mr-2" />
                {t("dashboard.newsletterCard.create")}
                <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1.5 transition-transform" />
              </Button>
              <Button
                onClick={() => setLocation("/newsletter")}
                variant="ghost"
                size="lg"
                className="text-white/90 font-semibold hover:text-white hover:bg-white/10 text-base"
                data-testid="button-view-all-newsletters"
              >
                <Send className="w-5 h-5 mr-2" />
                {t("dashboard.newsletterCard.viewAll")}
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center pr-4 xl:pr-8">
            <div className="relative w-40 h-40 xl:w-48 xl:h-48">
              <div className="absolute inset-0 rounded-3xl bg-white/10 backdrop-blur-sm rotate-6 group-hover:rotate-12 transition-transform duration-500 shadow-2xl" />
              <div className="absolute inset-2 rounded-2xl bg-white/15 backdrop-blur-md flex flex-col items-center justify-center gap-3 -rotate-3 group-hover:rotate-0 transition-transform duration-500 border border-white/20">
                <Newspaper className="w-12 h-12 xl:w-16 xl:h-16 text-white/90" />
                <div className="flex gap-1.5">
                  <div className="w-10 xl:w-12 h-1.5 rounded-full bg-white/50" />
                  <div className="w-5 xl:w-6 h-1.5 rounded-full bg-white/30" />
                </div>
                <div className="flex gap-1.5">
                  <div className="w-5 xl:w-6 h-1.5 rounded-full bg-white/40" />
                  <div className="w-10 xl:w-12 h-1.5 rounded-full bg-white/25" />
                </div>
                <div className="w-12 xl:w-16 h-1.5 rounded-full bg-white/20 mt-1" />
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
