/**
 * Shown while a student page's data loads -- the dashboard, notes, a test --
 * so tapping a link on a slow phone connection answers at once.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-page" aria-busy="true" aria-label="Loading">
      <div className="h-16 border-b border-brand-border bg-white" />
      <main className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2 border-b border-brand-border pb-6">
          <div className="h-7 w-56 rounded-md bg-brand-border" />
          <div className="h-3 w-72 max-w-full rounded bg-brand-border/70" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-brand-border bg-white p-5">
              <div className="mb-4 h-10 w-10 rounded-lg bg-brand-tint" />
              <div className="mb-2 h-4 w-2/3 rounded bg-brand-border" />
              <div className="mb-5 h-3 w-1/2 rounded bg-brand-border/70" />
              <div className="h-9 w-full rounded-lg bg-brand-tint" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
