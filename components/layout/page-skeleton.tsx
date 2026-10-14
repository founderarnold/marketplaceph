/**
 * Placeholder a page shows the moment a link is tapped, while its per-user data streams in.
 * Pages wrap their content in <Suspense fallback={<PageSkeleton />}> so in-app navigation is instant
 * (a Suspense boundary above the shared layout, like the root loading.tsx, doesn't apply to client navigations).
 */
export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="h-8 w-1/2 max-w-sm animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
