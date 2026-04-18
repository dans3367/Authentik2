import { useEffect, useMemo, useState } from "react";
import { createUsePuck } from "@puckeditor/core";
import { Images, Loader2, RefreshCw, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UnsplashResult {
  provider: "unsplash" | "pexels";
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  attribution: { name: string; profileUrl?: string };
}

const lazyUsePuck = (() => {
  let hook: any = null;
  return () => {
    if (!hook) hook = createUsePuck();
    return hook;
  };
})();

/**
 * Custom Puck field rendered in the Image block's properties panel.
 * Shows the current image query and a "Replace image" button that opens
 * an Unsplash search dialog. On pick, dispatches a Puck setData update
 * that rewrites the block's first image, alt, caption, and imageQuery.
 */
export function ReplaceImageField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const usePuck = lazyUsePuck();
  const selectedItem = usePuck((s: any) => s.selectedItem);
  const dispatch = usePuck((s: any) => s.dispatch);
  const { toast } = useToast();

  const currentAlt = selectedItem?.props?.images?.[0]?.alt ?? "";
  const initialQuery = (value ?? "").trim() || currentAlt;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<UnsplashResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  // Re-seed the query when opening the dialog so it always reflects the saved query.
  useEffect(() => {
    if (open) {
      const seed = (value ?? "").trim() || selectedItem?.props?.images?.[0]?.alt || "";
      setQuery(seed);
      setResults([]);
      if (seed) void runSearch(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function runSearch(q: string) {
    const term = q.trim();
    if (term.length < 2) return;
    setIsSearching(true);
    try {
      const res = await apiRequest("GET", `/api/newsletters/ai/unsplash-search?q=${encodeURIComponent(term)}&per_page=12`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Search failed");
      }
      setResults(data.results as UnsplashResult[]);
    } catch (error: any) {
      toast({
        title: "Could not search images",
        description: error?.message || "Try a different query.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }

  function handlePick(result: UnsplashResult) {
    const targetId: string | undefined = selectedItem?.props?.id;
    if (!targetId) {
      toast({ title: "No block selected", variant: "destructive" });
      return;
    }
    setApplying(`${result.provider}-${result.id}`);

    const nextCaption = result.attribution?.name
      ? `Photo by ${result.attribution.name} on Unsplash`
      : selectedItem?.props?.caption || "";
    const nextQuery = query.trim();
    const updateItem = (i: any) => {
      if (i.props?.id !== targetId) return i;
      const firstAlt = result.alt || i.props?.images?.[0]?.alt || "";
      const rest = Array.isArray(i.props?.images) ? i.props.images.slice(1) : [];
      return {
        ...i,
        props: {
          ...i.props,
          images: [{ src: result.url, alt: firstAlt, href: i.props?.images?.[0]?.href }, ...rest],
          caption: nextCaption,
          imageQuery: nextQuery,
        },
      };
    };

    dispatch({
      type: "setData",
      data: (prev: any) => {
        const updated: any = { ...prev, content: (prev.content ?? []).map(updateItem) };
        if (prev.zones) {
          updated.zones = Object.fromEntries(
            Object.entries(prev.zones).map(([zone, items]: [string, any]) => [
              zone,
              Array.isArray(items) ? items.map(updateItem) : items,
            ]),
          );
        }
        return updated;
      },
    });

    // Keep the field's own imageQuery state in sync for any other observers.
    if (nextQuery !== value) onChange(nextQuery);

    setApplying(null);
    setOpen(false);
    toast({ title: "Image replaced" });
  }

  const canSearch = query.trim().length >= 2 && !isSearching;
  const displayQuery = useMemo(() => (value ?? "").trim() || currentAlt || "", [value, currentAlt]);

  return (
    <>
      <div className="space-y-2">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. barista pouring latte art"
          className="h-8 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 h-8 text-xs"
          onClick={() => setOpen(true)}
        >
          <Images className="w-3.5 h-3.5" />
          Replace image
          {displayQuery && (
            <span className="ml-1 text-muted-foreground truncate max-w-[120px]">
              · "{displayQuery}"
            </span>
          )}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[82vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>Replace image</DialogTitle>
            <DialogDescription>
              Search Unsplash and pick a replacement. Edit the query to find different photos.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 border-b flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSearch) {
                    e.preventDefault();
                    void runSearch(query);
                  }
                }}
                placeholder="Search Unsplash..."
                className="pl-8"
                autoFocus
              />
            </div>
            <Button
              type="button"
              onClick={() => void runSearch(query)}
              disabled={!canSearch}
              className="gap-1.5"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Search
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isSearching && results.length === 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-video rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                {query.trim().length < 2
                  ? "Enter a search term to find photos."
                  : "No results. Try a different search."}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {results.map((r) => {
                  const key = `${r.provider}-${r.id}`;
                  const isApplying = applying === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePick(r)}
                      disabled={!!applying}
                      className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-60"
                    >
                      <img
                        src={r.thumbUrl}
                        alt={r.alt}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {isApplying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                        <div className="text-[10px] text-white/90 truncate">
                          Photo by {r.attribution.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
