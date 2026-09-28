import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { billingStatus, dateKey, formatDay, monthlyAmount, rupees, todayIst } from "@/lib/billing";
import { BillingBadge, Card, Flash, SuspendedBadge, buttonClass, inputClass, secondaryButtonClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; show?: string }>;
}) {
  const { q = "", show = "", ...flash } = await searchParams;
  const today = todayIst();
  const orgs = (await prisma.organisation.findMany({ orderBy: { name: "asc" } })).map((o) => {
    const paidUpTo = o.paidUpTo ? dateKey(o.paidUpTo) : null;
    return {
      ...o,
      paidUpTo,
      monthly: monthlyAmount(o.studentCount, o.pricePerStudentInr),
      billing: billingStatus({ paidUpTo, createdOn: dateKey(o.createdAt) }, today),
      overLimit: o.maxStudents !== null && o.studentCount > o.maxStudents,
    };
  });
  const active = orgs.filter((o) => o.status === "ACTIVE");
  const needle = q.trim().toLowerCase();
  const shown = orgs.filter(
    (o) =>
      (!needle || [o.name, o.slug, o.contactEmail, o.contactName, o.portalUrl].some((v) => v.toLowerCase().includes(needle))) &&
      (!show ||
        (show === "SUSPENDED" ? o.status === "SUSPENDED" : o.status === "ACTIVE" && (show === "ACTIVE" || o.billing === show)))
  );

  const totals = [
    { label: "Active organisations", value: String(active.length) },
    { label: "Enrolled students", value: active.reduce((n, o) => n + o.studentCount, 0).toLocaleString("en-IN") },
    { label: "Billed per month", value: rupees(active.reduce((n, o) => n + o.monthly, 0)) },
    { label: "Overdue", value: String(active.filter((o) => o.billing === "OVERDUE").length) },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-900">Organisations</h1>
        <Link href="/admin/orgs/new" className={buttonClass}>
          <Plus className="h-4 w-4" /> Add organisation
        </Link>
      </div>
      <Flash {...flash} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-brand-900">{t.value}</p>
          </div>
        ))}
      </div>

      {orgs.length > 0 && (
        <form className="flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, slug or email" className={`${inputClass} max-w-xs`} />
          <select name="show" defaultValue={show} className={`${inputClass} w-auto`}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE">Due</option>
            <option value="PAID">Paid</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <button type="submit" className={secondaryButtonClass}>
            <Search className="h-4 w-4" /> Filter
          </button>
        </form>
      )}

      {orgs.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">No organisations yet. Add the first one to start tracking its students and billing.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Organisation</th>
                <th className="px-4 py-3 text-right font-semibold">Students</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Per month</th>
                <th className="px-4 py-3 font-semibold">Paid up to</th>
                <th className="px-4 py-3 font-semibold">Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    No organisation matches.
                  </td>
                </tr>
              )}
              {shown.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orgs/${o.slug}`} className="font-semibold text-brand-800 hover:underline">
                      {o.name}
                    </Link>
                    <p className="text-xs text-zinc-500">{o.portalUrl.replace(/^https?:\/\//, "")}</p>
                    {o.contactEmail && <p className="text-xs text-zinc-500">{o.contactEmail}</p>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.studentCount.toLocaleString("en-IN")}
                    {o.maxStudents !== null && <span className="text-zinc-400"> / {o.maxStudents}</span>}
                    {o.overLimit && <p className="text-xs font-semibold text-red-600">Over limit</p>}
                    {o.lastSyncError && <p className="text-xs text-amber-700">Sync failing</p>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupees(o.pricePerStudentInr)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{rupees(o.monthly)}</td>
                  <td className="px-4 py-3">{o.paidUpTo ? formatDay(o.paidUpTo) : <span className="text-zinc-400">Never paid</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {o.status === "SUSPENDED" ? <SuspendedBadge /> : <BillingBadge status={o.billing} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
