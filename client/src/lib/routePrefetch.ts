// ---------------------------------------------------------------------------
// Route prefetch registry
//
// All top-level routes in App.tsx are mounted via `React.lazy(() => import(...))`,
// which means each page's JS chunk is only fetched when the user actually
// navigates to it. The first navigation therefore pays a network round-trip
// before the new page can render.
//
// We can cheaply warm those chunks by triggering the SAME dynamic import
// when the user hovers / focuses a sidebar link. By the time the click
// fires, the chunk is usually already in the browser cache and the new
// page renders instantly.
//
// Implementation notes:
//   * The thunks MUST be the same import expressions used by `lazy()` in
//     App.tsx so Vite reuses the same chunk and the cache hits.
//   * Imports are fire-and-forget; errors are swallowed (a real navigation
//     will surface them).
//   * The `prefetched` set guards against repeat triggers from sticky hover
//     / re-render storms.
// ---------------------------------------------------------------------------

const prefetched = new Set<string>();

// Map of path → import thunk. Keys are checked with `startsWith` against the
// link's `href`, so deeper subroutes still match the parent chunk.
const routePrefetchers: Array<{ prefix: string; load: () => Promise<unknown> }> = [
  { prefix: '/dashboard',     load: () => import('@/pages/dashboard') },
  { prefix: '/newsletter',    load: () => import('@/pages/newsletter') },
  { prefix: '/newsletters',   load: () => import('@/pages/newsletter') },
  { prefix: '/advertise',     load: () => import('@/pages/advertise') },
  { prefix: '/promotions',    load: () => import('@/pages/promotions') },
  { prefix: '/templates',     load: () => import('@/pages/templates') },
  { prefix: '/cards',         load: () => import('@/pages/cards') },
  { prefix: '/appointments',  load: () => import('@/pages/appointments') },
  { prefix: '/contacts',      load: () => import('@/pages/email-contacts') },
  { prefix: '/segmentation',  load: () => import('@/pages/segmentation') },
  { prefix: '/analytics',     load: () => import('@/pages/analytics') },
  { prefix: '/email-analytics', load: () => import('@/pages/email-analytics') },
  { prefix: '/shops',         load: () => import('@/pages/shops') },
  { prefix: '/users',         load: () => import('@/pages/users') },
  { prefix: '/forms',         load: () => import('@/pages/forms') },
  { prefix: '/management',    load: () => import('@/pages/management') },
  { prefix: '/profile',       load: () => import('@/pages/profile') },
  { prefix: '/sessions',      load: () => import('@/pages/sessions') },
  { prefix: '/company',       load: () => import('@/pages/company') },
  { prefix: '/subscribe',     load: () => import('@/pages/subscribe') },
];

/**
 * Trigger the dynamic import for the chunk that owns `href` (if any).
 * Safe to call repeatedly; subsequent calls are no-ops.
 */
export function prefetchRoute(href: string | undefined): void {
  if (!href) return;
  if (prefetched.has(href)) return;

  // Find the longest matching prefix so e.g. `/shops/tags` prefers the
  // `/shops` entry rather than something accidentally registered earlier.
  let best: typeof routePrefetchers[number] | undefined;
  for (const entry of routePrefetchers) {
    if (href === entry.prefix || href.startsWith(entry.prefix + '/') || href.startsWith(entry.prefix + '?')) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry;
    }
  }
  if (!best) return;

  prefetched.add(href);
  void best.load().catch(() => {
    // Allow a real navigation to retry by clearing the guard on failure.
    prefetched.delete(href);
  });
}

/**
 * Props spread helper for any element that should warm a route on hover.
 *
 * Usage:
 *   <Link href={item.href} {...prefetchOn(item.href)}>...</Link>
 */
export function prefetchOn(href: string | undefined) {
  return {
    onMouseEnter: () => prefetchRoute(href),
    onFocus: () => prefetchRoute(href),
    // Touch devices: warm on touchstart so the chunk loads in parallel with
    // the tap-to-click delay.
    onTouchStart: () => prefetchRoute(href),
  };
}
