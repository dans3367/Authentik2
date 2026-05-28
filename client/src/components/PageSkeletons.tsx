// ---------------------------------------------------------------------------
// Suspense fallbacks shaped like the routes they replace.
//
// Previously every lazy-loaded route used a centered spinner as its
// Suspense fallback, which causes large visual jumps (CLS) and slow
// perceived performance during chunk loading. The skeletons below
// approximate the typical layouts so the page "appears" instantly and
// content fades into the same boxes that were already painted.
//
// Two flavours:
//   * `FullPageSkeleton` \u2014 used for routes rendered outside AppLayout
//     (auth, onboarding, public newsletter views, etc.).
//   * `ContentSkeleton`  \u2014 used for routes rendered inside AppLayout;
//     the sidebar and header are already on screen, so we only need to
//     fill the content area.
//
// Both are pure CSS / Tailwind \u2014 no JS, no flashes, no layout shift.
// ---------------------------------------------------------------------------
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic full-viewport skeleton: header bar + 3-card grid + table body.
 * Used as the Suspense fallback for the top-level Switch in `Router`.
 */
export function FullPageSkeleton() {
  return (
    <div className="min-h-screen w-full bg-background p-6">
      {/* Header strip */}
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        {/* Card row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>

        {/* Body table */}
        <div className="rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="divide-y divide-border">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * In-layout content skeleton: rendered inside AppLayout, so sidebar and
 * top bar are already on screen. Only the content well shimmers.
 */
export function ContentSkeleton() {
  return (
    <div className="w-full p-6 space-y-6">
      {/* Page title row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>

      {/* Main content well */}
      <div className="rounded-lg border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
        <div className="divide-y divide-border">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
