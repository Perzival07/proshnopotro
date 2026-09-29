import { LogoLockup } from "@/components/brand/LogoLockup";
import { org } from "@/lib/org";

/** Every page of a portal the platform owner has suspended shows this instead. */
export function SuspendedNotice() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-brand-border bg-white p-8 text-center shadow-card">
        <div className="flex justify-center">
          <LogoLockup variant="navy" href="" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-brand-navy">Temporarily unavailable</h1>
        <p className="text-sm text-brand-ink/70">
          The {org.name} portal is not available right now. Your tests, results and notes are safe and will be here when it
          reopens.{org.support.phoneDisplay && ` For anything urgent, contact ${org.name} on ${org.support.phoneDisplay}.`}
        </p>
      </div>
    </main>
  );
}
