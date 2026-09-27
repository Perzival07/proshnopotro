import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { legal } from "@/lib/site";

/** A value from `legal` in lib/site.ts, or a visible gap saying what belongs there. */
export function Filled({ value, missing }: { value: string | null; missing: string }) {
  return value ? <>{value}</> : <mark className="rounded bg-amber-100 px-1 text-amber-900">[{missing}]</mark>;
}

/**
 * The frame for the privacy policy and terms. Until `legal.effectiveDate` is
 * set, a banner says the document is a draft.
 */
export function LegalDoc({ title, children }: { title: string; children: React.ReactNode }) {
  const effective = legal.effectiveDate
    ? new Date(`${legal.effectiveDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {!effective && (
          <p role="note" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Draft: this document is being finalised and is not yet in force.
          </p>
        )}
        <article className="legal rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
          <h1>{title}</h1>
          <p className="text-sm text-zinc-500">Proshnopotro{effective ? ` · In force from ${effective}` : ""}</p>
          {children}
        </article>
      </main>
    </div>
  );
}
