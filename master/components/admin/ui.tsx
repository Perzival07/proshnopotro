import clsx from "clsx";
import type { BillingStatus } from "@/lib/billing";

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 shadow-sm transition hover:bg-zinc-50";

export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-brand-900">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-xl border border-zinc-200 bg-white p-5 shadow-sm", className)}>
      {title && <h2 className="mb-4 text-base font-semibold text-brand-900">{title}</h2>}
      {children}
    </section>
  );
}

const BILLING_STYLES: Record<BillingStatus, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DUE: "bg-amber-50 text-amber-800 border-amber-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
};

export function BillingBadge({ status }: { status: BillingStatus }) {
  return (
    <span className={clsx("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", BILLING_STYLES[status])}>
      {status === "PAID" ? "Paid" : status === "DUE" ? "Due" : "Overdue"}
    </span>
  );
}

export function SuspendedBadge() {
  return (
    <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
      Suspended
    </span>
  );
}

/** The message a server action left in the address after redirecting back. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={clsx(
        "rounded-lg border px-4 py-3 text-sm",
        error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      )}
    >
      {error ?? ok}
    </p>
  );
}

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-brand-50 text-brand-800 border-brand-200",
  TUTOR: "bg-sky-50 text-sky-800 border-sky-200",
  STUDENT: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={clsx("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", ROLE_STYLES[role] ?? ROLE_STYLES.STUDENT)}>
      {role === "ADMIN" ? "Owner" : role === "TUTOR" ? "Tutor" : "Student"}
    </span>
  );
}
