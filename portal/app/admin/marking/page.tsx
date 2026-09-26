import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff, studentScope } from "@/lib/auth-utils";
import { PenLine } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * What needs marking: every test that collects answer photos, with how many
 * submitted copies are still to be returned. A tutor sees only their own
 * classrooms' students, so this is their working list.
 */
export default async function ToMarkPage() {
  const user = await requireStaff();
  const scope = await studentScope(user);

  const attempts = await prisma.assignment.findMany({
    where: {
      status: "SUBMITTED",
      test: { bank: false, answerSheets: true },
      ...(scope === null ? {} : { studentEmail: { in: scope } }),
    },
    select: { testId: true, returnedAt: true, test: { select: { title: true, subject: true } } },
  });

  const tests = new Map<string, { title: string; subject: string; total: number; toReturn: number }>();
  for (const a of attempts) {
    const t = tests.get(a.testId) ?? { title: a.test.title, subject: a.test.subject, total: 0, toReturn: 0 };
    t.total++;
    if (!a.returnedAt) t.toReturn++;
    tests.set(a.testId, t);
  }
  const rows = Array.from(tests.entries()).sort((a, b) => b[1].toReturn - a[1].toReturn);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-brand-navy">To mark</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          {user.role === "TUTOR"
            ? "Answer sheets from students in your classrooms."
            : "Answer sheets from every student."}
        </p>
      </div>

      {scope !== null && scope.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          You are not on any classroom with students yet. Ask the owner to add you to one on the Team page.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          <PenLine className="mx-auto mb-2 h-6 w-6 text-brand-ink/40" />
          Nothing submitted yet.
        </div>
      ) : (
        <ul className="divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border bg-white shadow-card">
          {rows.map(([id, t]) => (
            <li key={id}>
              <Link href={`/admin/tests/${id}/marking`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-brand-page">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brand-navy">{t.title}</p>
                  <p className="text-[11px] text-brand-ink/60">{t.subject}</p>
                </div>
                <span className="text-xs text-brand-ink/70">
                  {t.total} submitted
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    t.toReturn > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {t.toReturn > 0 ? `${t.toReturn} to return` : "All returned"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
