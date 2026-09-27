import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dateKey, formatDay, formatMonth, fromDateKey, monthOf, monthRange, monthlyAmount, rupees, todayIst } from "@/lib/billing";
import { site } from "@/lib/site";
import { PrintButton } from "@/components/admin/PrintButton";
import { inputClass, secondaryButtonClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/**
 * A one-month statement to send to an organisation: its student count, the
 * amount for the month and what it paid in that month. The student count is
 * the latest one synced from the portal; the master keeps no monthly history.
 */
export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const today = todayIst();
  const month = (await searchParams).month ?? monthOf(today);
  const range = monthRange(month) ?? monthRange(monthOf(today))!;
  const shownMonth = range.first.slice(0, 7);

  const org = await prisma.organisation.findUnique({
    where: { slug },
    include: {
      payments: {
        where: { receivedOn: { gte: fromDateKey(range.first), lte: fromDateKey(range.last) } },
        orderBy: { receivedOn: "asc" },
      },
    },
  });
  if (!org) notFound();

  const amount = monthlyAmount(org.studentCount, org.pricePerStudentInr);
  const received = org.payments.reduce((n, p) => n + p.amountInr, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <Link href={`/admin/orgs/${org.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
          <ArrowLeft className="h-4 w-4" /> {org.name}
        </Link>
        <div className="flex flex-wrap items-end gap-2">
          <form className="flex items-end gap-2">
            <input type="month" name="month" defaultValue={shownMonth} className={inputClass} />
            <button type="submit" className={secondaryButtonClass}>
              Show
            </button>
          </form>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-2xl space-y-8 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-brand-600">{site.name}</p>
            <h1 className="text-2xl font-bold text-brand-900">Statement</h1>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-brand-900">{formatMonth(shownMonth)}</p>
            <p className="text-zinc-500">Issued {formatDay(today)}</p>
          </div>
        </header>

        <section className="text-sm">
          <p className="text-zinc-500">For</p>
          <p className="text-lg font-semibold text-brand-900">{org.name}</p>
          <p className="text-zinc-600">{org.portalUrl}</p>
        </section>

        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <td className="py-2 text-zinc-600">Enrolled students</td>
              <td className="py-2 text-right tabular-nums">{org.studentCount.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-2 text-zinc-600">Price per student per month</td>
              <td className="py-2 text-right tabular-nums">{rupees(org.pricePerStudentInr)}</td>
            </tr>
            <tr className="font-semibold text-brand-900">
              <td className="py-3">Amount for {formatMonth(shownMonth)}</td>
              <td className="py-3 text-right text-lg tabular-nums">{rupees(amount)}</td>
            </tr>
          </tbody>
        </table>

        <section className="space-y-2 text-sm">
          <h2 className="font-semibold text-brand-900">Payments received in {formatMonth(shownMonth)}</h2>
          {org.payments.length === 0 ? (
            <p className="text-zinc-600">None.</p>
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-zinc-100">
                {org.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2">{formatDay(dateKey(p.receivedOn))}</td>
                    <td className="py-2 font-mono text-xs text-zinc-600">{p.reference}</td>
                    <td className="py-2 text-right tabular-nums">{rupees(p.amountInr)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2" colSpan={2}>
                    Total received
                  </td>
                  <td className="py-2 text-right tabular-nums">{rupees(received)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="pt-2 text-zinc-600">
            Paid up to: <strong>{org.paidUpTo ? formatDay(dateKey(org.paidUpTo)) : "no payment yet"}</strong>
          </p>
        </section>

        <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
          Student count as synced from the portal
          {org.lastSyncAt ? ` on ${formatDay(todayIst(org.lastSyncAt))}` : ""}. Questions: {site.contactEmail}
        </footer>
      </article>
    </>
  );
}
