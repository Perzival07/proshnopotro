import React from "react";
import { Receipt } from "lucide-react";
import { requireAdmin } from "@/lib/auth-utils";
import { masterConfig, masterStatus } from "@/lib/master";
import { PRODUCT_NAME } from "@/lib/org";

export const dynamic = "force-dynamic";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const moment = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const STATUS = {
  PAID: { label: "Paid", className: "bg-status-green-bg text-status-green-text border-status-green-border" },
  DUE: { label: "Payment due", className: "bg-status-amber-bg text-status-amber-text border-status-amber-border" },
  OVERDUE: { label: "Overdue", className: "border-red-200 bg-red-50 text-red-700" },
} as const;

/**
 * The owner's read-only view of what this organisation pays for
 * Proshnopotro, as the platform owner's master app records it. Payment itself
 * happens outside the app.
 */
export default async function BillingPage() {
  await requireAdmin();
  const connected = masterConfig() !== null;
  const status = connected ? await masterStatus() : null;
  const billing = status?.billing;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-brand-navy">Billing</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">Your {PRODUCT_NAME} subscription: every enrolled student, each month.</p>
      </div>

      {!billing ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          <Receipt className="mx-auto mb-2 h-6 w-6 text-brand-ink/40" />
          {connected
            ? "Billing details could not be loaded just now. Try again in a few minutes."
            : "Billing details are not available for this portal yet."}
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-semibold text-brand-navy">This month</h2>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS[billing.billingStatus].className}`}>
                {STATUS[billing.billingStatus].label}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-brand-ink/60">Enrolled students</dt>
              <dd className="text-right font-semibold tabular-nums">
                {billing.studentCount.toLocaleString("en-IN")}
                {billing.maxStudents !== null && <span className="font-normal text-brand-ink/50"> of {billing.maxStudents}</span>}
              </dd>
              <dt className="text-brand-ink/60">Price per student</dt>
              <dd className="text-right tabular-nums">{rupees(billing.pricePerStudentInr)} / month</dd>
              <dt className="text-brand-ink/60">Amount per month</dt>
              <dd className="text-right font-heading text-lg font-bold tabular-nums text-brand-navy">{rupees(billing.monthlyAmountInr)}</dd>
              <dt className="text-brand-ink/60">Paid up to</dt>
              <dd className="text-right">{billing.paidUpTo ? day(billing.paidUpTo) : "No payment yet"}</dd>
            </dl>
            <p className="mt-4 text-[11px] text-brand-ink/50">
              Every student account on the Students page counts.
              {billing.countedAt ? ` Last counted ${moment(billing.countedAt)}.` : ""}
            </p>
          </section>

          <section className="rounded-xl border border-brand-blue/30 bg-brand-tint/40 p-4 text-sm text-brand-navy">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">How to pay</p>
            <p className="whitespace-pre-line">{billing.instructions}</p>
          </section>

          <section className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
            <h2 className="mb-3 font-heading text-sm font-semibold text-brand-navy">Payments received</h2>
            {billing.payments.length === 0 ? (
              <p className="text-xs text-brand-ink/60">None recorded yet.</p>
            ) : (
              <ul className="divide-y divide-brand-border text-sm">
                {billing.payments.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{day(p.receivedOn)}</span>
                    <span className="font-mono text-xs text-brand-ink/60">{p.reference}</span>
                    <span className="font-semibold tabular-nums">{rupees(p.amountInr)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
