import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";
import { useAppSelector, useAppDispatch } from "@/store";
import { setSelectedShop } from "@/store/shopSlice";
import { apiRequest } from "@/lib/queryClient";
import { LayoutTemplate, PenTool, Sparkles, ArrowRight, Store, ArrowLeft, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AINewsletterWizardModal } from "@/components/AINewsletterWizardModal";

interface Shop {
  id: string;
  name: string;
  status: string;
}

interface EditorPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createBasePath?: string;
}

export function EditorPickerModal({ open, onOpenChange, createBasePath = '/newsletter/create' }: EditorPickerModalProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const dispatch = useAppDispatch();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  // Fetch shops to determine if we need the shop selection step
  const { data: shopsData } = useQuery({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops?limit=100");
      return response.json();
    },
    enabled: open,
  });

  const shops: Shop[] = shopsData?.shops || [];
  const needsShopSelection = selectedShopId === null && shops.length > 1;

  // Step: 'shop' | 'editor'
  const [step, setStep] = useState<'shop' | 'editor'>('editor');
  const [selectedShopForCreate, setSelectedShopForCreate] = useState<string | null>(null);

  // Reset step when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(needsShopSelection ? 'shop' : 'editor');
      setSelectedShopForCreate(null);
    }
  }, [open, needsShopSelection]);

  // Fetch blog design to get the user's preferred editor type
  const { data: blogDesignData } = useQuery<{ newsletterEditorType?: string }>({
    queryKey: ["/api/blog-design"],
    queryFn: async () => {
      const response = await fetch('/api/blog-design', { credentials: 'include' });
      if (!response.ok) return { newsletterEditorType: 'classic' };
      return response.json();
    },
  });

  const preferredEditor = blogDesignData?.newsletterEditorType || 'classic';
  const [selected, setSelected] = useState<'classic' | 'notion' | 'ai'>(preferredEditor as 'classic' | 'notion');
  const [aiWizardOpen, setAiWizardOpen] = useState(false);

  // Sync selection when preference loads
  useEffect(() => {
    setSelected(preferredEditor as 'classic' | 'notion');
  }, [preferredEditor]);

  const handleShopContinue = () => {
    if (selectedShopForCreate) {
      dispatch(setSelectedShop(selectedShopForCreate));
      setStep('editor');
    }
  };

  const handleContinue = () => {
    if (selected === 'ai') {
      onOpenChange(false);
      setAiWizardOpen(true);
      return;
    }
    onOpenChange(false);
    setLocation(`${createBasePath}?editor=${selected}`);
  };

  const aiShopId = selectedShopId ?? selectedShopForCreate ?? null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        {step === 'shop' ? (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-xl font-bold">
                {t("newsletter.shopPicker.title", "Select a Shop")}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t("newsletter.shopPicker.description", "Choose which shop this item belongs to before continuing.")}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4 space-y-2 max-h-[360px] overflow-y-auto">
              {shops.filter((s) => s.status === 'active').map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setSelectedShopForCreate(shop.id)}
                  className={`relative w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    selectedShopForCreate === shop.id
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-md ring-1 ring-blue-500/20'
                      : 'border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedShopForCreate === shop.id
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <Store className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-sm flex-1">{shop.name}</span>
                  {selectedShopForCreate === shop.id && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="px-6 pb-6 pt-2 flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button onClick={handleShopContinue} disabled={!selectedShopForCreate} className="gap-2">
                {t("common.next", "Next")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-xl font-bold">
                {t("newsletter.editorPicker.title", "Choose Your Editor")}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t("newsletter.editorPicker.description", "Select which editor you'd like to use for this newsletter. You can change the default in Management > Blog Design.")}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4 space-y-3">
              {/* Classic (Puck) */}
              <button
                type="button"
                onClick={() => setSelected('classic')}
                className={`relative w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  selected === 'classic'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-md ring-1 ring-blue-500/20'
                    : 'border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${
                  selected === 'classic'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <LayoutTemplate className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {t("newsletter.editorPicker.classic", "Classic Editor")}
                    </span>
                    {preferredEditor === 'classic' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        {t("newsletter.editorPicker.default", "Default")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t("newsletter.editorPicker.classicDesc", "Drag-and-drop block editor with visual components. Great for structured layouts with columns, buttons, and images.")}
                  </p>
                </div>
                {selected === 'classic' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Notion-like (TipTap) */}
              <button
                type="button"
                onClick={() => setSelected('notion')}
                className={`relative w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  selected === 'notion'
                    ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 shadow-md ring-1 ring-violet-500/20'
                    : 'border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${
                  selected === 'notion'
                    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <PenTool className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {t("newsletter.editorPicker.notion", "Notion-like Editor")}
                    </span>
                    {preferredEditor === 'notion' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                        {t("newsletter.editorPicker.default", "Default")}
                      </span>
                    )}
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      {t("newsletter.editorPicker.new", "New")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t("newsletter.editorPicker.notionDesc", "Clean writing experience with slash commands and inline formatting. Perfect for content-focused newsletters.")}
                  </p>
                </div>
                {selected === 'notion' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Create with AI */}
              <button
                type="button"
                onClick={() => setSelected('ai')}
                className={`relative w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  selected === 'ai'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/20'
                    : 'border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${
                  selected === 'ai'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <Wand2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {t("newsletter.editorPicker.ai", "Create with AI")}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      {t("newsletter.editorPicker.beta", "Beta")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t("newsletter.editorPicker.aiDesc", "Describe your topic and let AI draft the layout and suggest images. Continue editing in the classic editor.")}
                  </p>
                </div>
                {selected === 'ai' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>

            <div className="px-6 pb-6 pt-2 flex justify-end gap-3">
              {needsShopSelection && (
                <Button variant="ghost" onClick={() => setStep('shop')} className="mr-auto gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {t("common.back", "Back")}
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button onClick={handleContinue} className="gap-2">
                {t("newsletter.editorPicker.continue", "Continue")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    <AINewsletterWizardModal
      open={aiWizardOpen}
      onOpenChange={setAiWizardOpen}
      shopId={aiShopId}
      createBasePath={createBasePath}
    />
    </>
  );
}
