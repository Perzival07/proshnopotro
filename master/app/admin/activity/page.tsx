import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Field, inputClass, secondaryButtonClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const LIMIT = 300;
const timeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** What the super admins did, newest first: the record for "who changed this?". */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: slug = "" } = await searchParams;
  const orgs = await prisma.organisation.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } });
  const chosen = orgs.find((o) => o.slug === slug);
  const entries = await prisma.activityLog.findMany({
    where: chosen ? { orgId: chosen.id } : {},
    orderBy: { at: "desc" },
    take: LIMIT,
    select: { id: true, at: true, actor: true, orgName: true, action: true, detail: true, org: { select: { slug: true } } },
  });

  return (
    <>
      <h1 className="text-2xl font-bold text-brand-900">Activity{chosen ? `: ${chosen.name}` : ""}</h1>
      <Card className="p-0">
        <form className="flex flex-wrap items-end gap-2 border-b border-zinc-100 p-4">
          <div className="min-w-[240px]">
            <Field label="Organisation">
              <select name="org" defaultValue={slug} className={inputClass}>
                <option value="">All</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button type="submit" className={secondaryButtonClass}>
            Show
          </button>
        </form>
        {entries.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Who</th>
                  <th className="px-4 py-2 font-semibold">Organisation</th>
                  <th className="px-4 py-2 font-semibold">What</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-600">{timeFormat.format(e.at)}</td>
                    <td className="px-4 py-2 text-xs">{e.actor}</td>
                    <td className="px-4 py-2">
                      {e.org ? (
                        <Link href={`/admin/orgs/${e.org.slug}`} className="text-brand-800 hover:underline">
                          {e.orgName}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">{e.orgName || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-medium text-brand-900">{e.action}</span>
                      {e.detail && <p className="text-xs text-zinc-500">{e.detail}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">The latest {LIMIT} entries at most.</p>
      </Card>
    </>
  );
}
