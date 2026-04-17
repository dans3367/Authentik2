import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  RefreshCw,
  ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Tone = "warm" | "formal" | "casual" | "persuasive";

interface ImageSlot {
  blockId: string;
  imageQuery: string;
  alt: string;
}

interface ImageCandidate {
  provider: "unsplash" | "pexels";
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  attribution: { name: string; profileUrl?: string };
}

interface SlotResult {
  blockId: string;
  candidates: ImageCandidate[];
  error: string | null;
}

interface AINewsletterWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId?: string | null;
  createBasePath?: string;
}

export function AINewsletterWizardModal({
  open,
  onOpenChange,
  shopId,
  createBasePath = "/newsletter/create",
}: AINewsletterWizardModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<Tone>("warm");
  const [isGenerating, setIsGenerating] = useState(false);

  // Structure from step 1
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [puckData, setPuckData] = useState<any>(null);
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);

  // Step 2 state
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [slotResults, setSlotResults] = useState<Record<string, SlotResult>>({});
  const [selections, setSelections] = useState<Record<string, ImageCandidate>>({});
  const [requeryText, setRequeryText] = useState<Record<string, string>>({});
  const [requeryingSlot, setRequeryingSlot] = useState<string | null>(null);

  // Step 3 state
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPrompt("");
    setTone("warm");
    setIsGenerating(false);
    setTitle("");
    setSubject("");
    setPuckData(null);
    setImageSlots([]);
    setSlotResults({});
    setSelections({});
    setRequeryText({});
    setRequeryingSlot(null);
    setIsFinalizing(false);
    setIsLoadingImages(false);
  }, [open]);

  const shopParam = shopId ? `?shopId=${shopId}` : "";

  async function handleGenerateStructure() {
    if (prompt.trim().length < 3) {
      toast({
        title: "Prompt too short",
        description: "Describe your newsletter topic in a sentence or two.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", `/api/newsletters/ai/generate-structure${shopParam}`, {
        prompt: prompt.trim(),
        tone,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate structure");
      }
      setTitle(data.title);
      setSubject(data.subject);
      setPuckData(data.puckData);
      setImageSlots(data.imageSlots);
      await loadImageSuggestions(data.imageSlots);
      setStep(2);
    } catch (error: any) {
      toast({
        title: "Could not generate newsletter",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function loadImageSuggestions(slots: ImageSlot[]) {
    setIsLoadingImages(true);
    try {
      const res = await apiRequest("POST", `/api/newsletters/ai/image-suggestions${shopParam}`, {
        slots: slots.map((s) => ({ blockId: s.blockId, imageQuery: s.imageQuery })),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load images");
      }
      const map: Record<string, SlotResult> = {};
      (data.results as SlotResult[]).forEach((r) => {
        map[r.blockId] = r;
      });
      setSlotResults(map);
    } catch (error: any) {
      toast({
        title: "Could not load images",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingImages(false);
    }
  }

  async function handleRequerySlot(slot: ImageSlot) {
    const query = (requeryText[slot.blockId] ?? slot.imageQuery).trim();
    if (query.length < 2) return;

    setRequeryingSlot(slot.blockId);
    try {
      const res = await apiRequest("POST", `/api/newsletters/ai/image-suggestions${shopParam}`, {
        slots: [{ blockId: slot.blockId, imageQuery: query }],
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Search failed");
      }
      const fresh = (data.results as SlotResult[])[0];
      setSlotResults((prev) => ({ ...prev, [slot.blockId]: fresh }));
      // Invalidate any previous selection for this slot
      setSelections((prev) => {
        const next = { ...prev };
        delete next[slot.blockId];
        return next;
      });
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error?.message || "Please try a different query.",
        variant: "destructive",
      });
    } finally {
      setRequeryingSlot(null);
    }
  }

  async function handleFinalize() {
    if (!puckData) return;
    if (Object.keys(selections).length !== imageSlots.length) {
      toast({
        title: "Pick an image for each section",
        description: "All three image slots need a selection.",
        variant: "destructive",
      });
      return;
    }

    setIsFinalizing(true);
    try {
      const res = await apiRequest("POST", `/api/newsletters/ai/finalize${shopParam}`, {
        title: title.trim(),
        subject: subject.trim(),
        puckData,
        selections: imageSlots.map((slot) => {
          const pick = selections[slot.blockId];
          return {
            blockId: slot.blockId,
            imageUrl: pick.url,
            alt: pick.alt || slot.alt,
            attribution: pick.attribution,
          };
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create draft");
      }
      toast({
        title: "Draft created",
        description: "Opening the editor.",
      });
      onOpenChange(false);
      setLocation(data.editUrl || `${createBasePath}/${data.newsletterId}?editor=classic`);
    } catch (error: any) {
      toast({
        title: "Could not create draft",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  }

  const allSlotsPicked =
    imageSlots.length > 0 && imageSlots.every((s) => selections[s.blockId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[86vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-bold">Create newsletter with AI</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === 1 && "Step 1 of 3 — describe your topic and we'll draft the layout."}
            {step === 2 && "Step 2 of 3 — pick one image for each section."}
            {step === 3 && "Step 3 of 3 — review and create the draft."}
          </DialogDescription>
          <div className="flex gap-1.5 pt-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  n <= step ? "bg-emerald-500" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-prompt">What's the newsletter about?</Label>
                <Textarea
                  id="ai-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Spring menu launch for our coffee shop — new seasonal lattes, a baker's feature, and upcoming community events."
                  rows={5}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  We'll draft a header + three sections, each paired with a stock image.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-tone">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as Tone)} disabled={isGenerating}>
                  <SelectTrigger id="ai-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">Warm &amp; professional</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="casual">Casual &amp; friendly</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {isLoadingImages && imageSlots.length === 0 ? null : null}
              {imageSlots.map((slot, idx) => {
                const result = slotResults[slot.blockId];
                const selected = selections[slot.blockId];
                const isRequerying = requeryingSlot === slot.blockId;
                const currentQuery = requeryText[slot.blockId] ?? slot.imageQuery;

                return (
                  <div key={slot.blockId} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">
                        Image {idx + 1}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {slot.alt}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={currentQuery}
                        onChange={(e) =>
                          setRequeryText((p) => ({ ...p, [slot.blockId]: e.target.value }))
                        }
                        placeholder="Search query"
                        className="h-9 text-sm"
                        disabled={isRequerying}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleRequerySlot(slot)}
                        disabled={isRequerying || currentQuery.trim().length < 2}
                      >
                        {isRequerying ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Search
                      </Button>
                    </div>
                    {isLoadingImages && !result ? (
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="aspect-video rounded-lg bg-muted animate-pulse"
                          />
                        ))}
                      </div>
                    ) : result?.error ? (
                      <div className="text-xs text-destructive flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {result.error}
                      </div>
                    ) : result && result.candidates.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No images found. Try a different search.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {result?.candidates.map((cand) => {
                          const isSelected = selected?.id === cand.id && selected?.provider === cand.provider;
                          return (
                            <button
                              key={`${cand.provider}-${cand.id}`}
                              type="button"
                              onClick={() =>
                                setSelections((prev) => ({ ...prev, [slot.blockId]: cand }))
                              }
                              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                                isSelected
                                  ? "border-emerald-500 shadow-md ring-1 ring-emerald-500/30"
                                  : "border-transparent hover:border-muted-foreground/30"
                              }`}
                            >
                              <img
                                src={cand.thumbUrl}
                                alt={cand.alt}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                                <div className="text-[10px] text-white/90 truncate">
                                  {cand.attribution.name}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-title">Newsletter title</Label>
                <Input
                  id="ai-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isFinalizing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-subject">Email subject</Label>
                <Input
                  id="ai-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isFinalizing}
                />
              </div>
              <div className="space-y-2">
                <Label>Chosen images</Label>
                <div className="grid grid-cols-3 gap-2">
                  {imageSlots.map((slot, idx) => {
                    const pick = selections[slot.blockId];
                    if (!pick) return null;
                    return (
                      <div key={slot.blockId} className="space-y-1">
                        <div className="aspect-video rounded-lg overflow-hidden border">
                          <img
                            src={pick.thumbUrl}
                            alt={pick.alt}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          #{idx + 1} · Photo by {pick.attribution.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A draft will be created and opened in the classic editor so you can fine-tune the copy.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-background">
          {step > 1 ? (
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3)}
              disabled={isGenerating || isFinalizing}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating || isFinalizing}>
              Cancel
            </Button>
            {step === 1 && (
              <Button onClick={handleGenerateStructure} className="gap-2" disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate structure
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => setStep(3)}
                className="gap-2"
                disabled={!allSlotsPicked || isLoadingImages}
              >
                Review
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleFinalize} className="gap-2" disabled={isFinalizing || !title.trim() || !subject.trim()}>
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create draft
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
