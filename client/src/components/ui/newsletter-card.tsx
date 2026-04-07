import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Newspaper, ArrowRight, Sparkles, Send, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EditorPickerModal } from "@/components/EditorPickerModal";

const PATTERN_STYLE = {
  backgroundImage: `
    linear-gradient(30deg, transparent 40%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.1) 60%, transparent 60%),
    linear-gradient(-30deg, transparent 40%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.08) 60%, transparent 60%)
  `,
  backgroundSize: '60px 60px',
} as const;

export function NewsletterCard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [showEditorPicker, setShowEditorPicker] = useState(false);

  const handleCreateNewsletter = () => {
    setShowEditorPicker(true);
  };

  return (
    <>
      <Card className="h-full group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-500 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 dark:from-blue-700 dark:via-indigo-700 dark:to-violet-800" />
        <div className="absolute inset-0 opacity-[0.06]" style={PATTERN_STYLE} />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/[0.05] blur-3xl group-hover:scale-125 transition-transform duration-1000" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-violet-400/[0.08] blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-blue-300/[0.06] blur-2xl group-hover:translate-x-4 transition-transform duration-700" />

        <CardContent className="relative p-6 sm:p-8 lg:p-10 flex flex-col justify-center h-full min-h-[260px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 h-full">
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.12] backdrop-blur-sm border border-white/[0.08] text-white/90 text-[10px] font-bold uppercase tracking-[0.15em]">
                <Zap className="w-3 h-3" />
                {t("dashboard.newsletterCard.getStarted")}
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-extrabold text-white leading-[1.1] tracking-tight max-w-lg">
                {t("dashboard.newsletterCard.title")}
              </h2>

              <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-md">
                {t("dashboard.newsletterCard.description")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleCreateNewsletter}
                  size="lg"
                  className="bg-white text-indigo-700 hover:bg-white/90 dark:bg-white dark:text-indigo-700 dark:hover:bg-white/90 font-bold shadow-2xl shadow-black/20 group/btn px-6 rounded-xl h-11"
                  data-testid="button-create-newsletter"
                >
                  <Newspaper className="w-4 h-4 mr-2" />
                  {t("dashboard.newsletterCard.create")}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-200" />
                </Button>
                <Button
                  onClick={() => setLocation("/newsletter")}
                  variant="ghost"
                  size="lg"
                  className="text-white/80 font-semibold hover:text-white hover:bg-white/10 rounded-xl h-11"
                  data-testid="button-view-all-newsletters"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {t("dashboard.newsletterCard.viewAll")}
                </Button>
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-center justify-center">
              <div className="relative w-36 h-36 xl:w-44 xl:h-44">
                <div className="absolute inset-0 rounded-2xl bg-white/[0.06] rotate-6 group-hover:rotate-12 transition-transform duration-500 border border-white/10" />
                <div className="absolute inset-0 rounded-2xl bg-white/[0.04] -rotate-3 group-hover:rotate-0 transition-transform duration-500 border border-white/[0.06]" />
                <div className="absolute inset-3 rounded-xl bg-white/[0.1] backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 border border-white/[0.12]">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white/90" />
                  </div>
                  <div className="space-y-1.5 w-full px-4">
                    <div className="w-full h-1.5 rounded-full bg-white/30" />
                    <div className="w-3/4 h-1.5 rounded-full bg-white/20" />
                    <div className="w-1/2 h-1.5 rounded-full bg-white/15" />
                  </div>
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
