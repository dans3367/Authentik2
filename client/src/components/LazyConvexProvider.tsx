// ---------------------------------------------------------------------------
// LazyConvexProvider
//
// `convex/react` is ~50-80 KB minified+gzipped. Importing `ConvexProvider`
// and `ConvexReactClient` from the top of App.tsx pulled the entire Convex
// runtime into the entry chunk, paying that cost on every cold load even
// for users who never visit a Convex-powered page (auth screen, settings,
// public form viewer, etc.).
//
// The fix is to dynamic-import the provider and only mount it when needed.
// Provider children render unconditionally — the Convex client is mounted
// asynchronously and rewraps the tree once it has loaded.
//
// While loading, children render WITHOUT a ConvexProvider — any component
// using `useQuery` from convex/react will not have a client yet. The
// components that actually use Convex (live-stats-card, newsletter-stats-
// card, ContactViewDrawer, useRealtimeNewsletters, useNewsletterTracking,
// dashboard) all live inside lazy-loaded route chunks, so by the time
// those routes finish their own dynamic import the Convex client will
// have arrived in parallel.
// ---------------------------------------------------------------------------
import { useEffect, useState, type ReactNode } from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

interface LoadedConvex {
  Provider: React.ComponentType<{ client: any; children: ReactNode }>;
  client: any;
}

export function LazyConvexProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<LoadedConvex | null>(null);

  useEffect(() => {
    if (!convexUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("convex/react");
        if (cancelled) return;
        const client = new mod.ConvexReactClient(convexUrl);
        setLoaded({ Provider: mod.ConvexProvider as any, client });
      } catch (err) {
        // Swallow — components that need Convex will simply not have a
        // client. They should defensively handle the missing-provider case
        // (e.g. show a spinner or fall back to REST endpoints).
        console.error("[LazyConvexProvider] Failed to load convex/react:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!convexUrl || !loaded) {
    // Render children without a provider during the brief window before
    // Convex finishes loading (or when VITE_CONVEX_URL is unset).
    return <>{children}</>;
  }

  const { Provider, client } = loaded;
  return <Provider client={client}>{children}</Provider>;
}
