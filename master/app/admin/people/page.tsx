import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, Field, RoleBadge, SuspendedBadge, inputClass, secondaryButtonClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const LIMIT = 200;

/** Everyone in every organisation, found by email: which organisations someone is in, and as what. */
export default async function PeopleSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const { q = "", role = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const where = {
    ...(needle ? { email: { contains: needle } } : {}),
    ...(role ? { role } : {}),
  };
  const [rows, total, byRole] = await Promise.all([
    prisma.enrolment.findMany({
      where,
      orderBy: [{ email: "asc" }],
      take: LIMIT,
      select: { email: true, role: true, org: { select: { slug: true, name: true, status: true } } },
    }),
    prisma.enrolment.count({ where }),
    prisma.enrolment.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);
  const count = (r: string) => byRole.find((g) => g.role === r)?._count._all ?? 0;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-brand-900">People</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Across every organisation: {count("ADMIN")} owners, {count("TUTOR")} tutors, {count("STUDENT").toLocaleString("en-IN")} students. To
          add, remove or change someone, open their organisation.
        </p>
      </div>

      <Card className="p-0">
        <form className="flex flex-wrap items-end gap-2 border-b border-zinc-100 p-4">
          <div className="min-w-[240px] flex-1">
            <Field label="Search by email">
              <input name="q" defaultValue={q} className={inputClass} placeholder="part of an email" autoFocus />
            </Field>
          </div>
          <Field label="Role">
            <select name="role" defaultValue={role} className={inputClass}>
              <option value="">Everyone</option>
              <option value="ADMIN">Owners</option>
              <option value="TUTOR">Tutors</option>
              <option value="STUDENT">Students</option>
            </select>
          </Field>
          <button type="submit" className={secondaryButtonClass}>
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">No one matches.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Organisation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={`${r.org.slug}:${r.email}`}>
                    <td className="px-4 py-2 font-mono text-xs">{r.email}</td>
                    <td className="px-4 py-2">
                      <RoleBadge role={r.role} />
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/admin/orgs/${r.org.slug}/people?q=${encodeURIComponent(r.email)}`} className="font-medium text-brand-800 hover:underline">
                        {r.org.name}
                      </Link>{" "}
                      {r.org.status === "SUSPENDED" && <SuspendedBadge />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
          {total > LIMIT ? `Showing the first ${LIMIT} of ${total.toLocaleString("en-IN")}; search to narrow it.` : `${total.toLocaleString("en-IN")} found.`}
        </p>
      </Card>
    </>
  );
}
