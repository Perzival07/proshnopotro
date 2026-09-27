import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LogoLockup } from "@/components/brand/LogoLockup";
import { org } from "@/lib/org";

/** A value from org.json "legal", or a visible gap saying what belongs there. */
export function Filled({ value, missing }: { value: string | null; missing: string }) {
  return value ? <>{value}</> : <mark className="rounded bg-amber-100 px-1 text-amber-900">[{missing}]</mark>;
}

export function effectiveLabel(date: string | null): string | null {
  return date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;
}

/**
 * The frame for the privacy notice and the terms: a plain, readable page that
 * works signed out. Until org.json names an effective date, a banner says the
 * document is a draft.
 */
export function LegalDoc({ title, children }: { title: string; children: React.ReactNode }) {
  const effective = effectiveLabel(org.legal.effectiveDate);
  return (
    <div className="flex min-h-screen flex-col bg-brand-page">
      <header className="border-b border-brand-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <LogoLockup variant="navy" />
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:text-brand-blue">
            <ArrowLeft className="h-4 w-4" /> Portal
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {!effective && (
          <p role="note" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Draft: this document is being finalised and is not yet in force.
          </p>
        )}
        <article className="legal rounded-xl border border-brand-border bg-white p-6 shadow-card sm:p-8">
          <h1>{title}</h1>
          <p className="text-xs text-brand-ink/60">
            {org.name}
            {effective ? ` · In force from ${effective}` : ""}
          </p>
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
