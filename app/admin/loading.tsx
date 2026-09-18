/**
 * Shown inside the admin console while a page's data loads, so a click in
 * the sidebar answers at once instead of leaving the old page on screen.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-md bg-brand-border" />
          <div className="h-3 w-72 max-w-full rounded bg-brand-border/70" />
        </div>
        <div className="h-9 w-28 shrink-0 rounded-lg bg-brand-border" />
      </div>
      <div className="overflow-hidden rounded-xl border border-brand-border bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-brand-border px-4 py-4 last:border-b-0"
          >
            <div className="h-9 w-9 shrink-0 rounded-lg bg-brand-tint" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-brand-border" />
              <div className="h-3 w-1/2 rounded bg-brand-border/70" />
            </div>
            <div className="hidden h-6 w-20 rounded-full bg-brand-tint sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
