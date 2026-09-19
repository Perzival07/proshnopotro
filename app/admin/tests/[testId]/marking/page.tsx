import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Clock, Images, PenLine } from "lucide-react";

export const dynamic = "force-dynamic";

/** Every submitted attempt at a test, and how far its marking has got. */
export default async function MarkingListPage({ params }: { params: { testId: string } }) {
  const test = await prisma.test.findUnique({
    where: { id: params.testId },
    select: { id: true, title: true, subject: true, format: true },
  });
  if (!test) notFound();

  const [attempts, writtenIds] = await Promise.all([
    prisma.assignment.findMany({
      where: { testId: test.id, status: "SUBMITTED" },
      orderBy: { studentEmail: "asc" },
      select: {
        id: true,
        studentEmail: true,
        endedAt: true,
        returnedAt: true,
        result: { select: { score: true, maxScore: true } },
        _count: { select: { answerImages: true } },
        responses: { where: { manualMarks: { not: null } }, select: { questionId: true } },
      },
    }),
    prisma.question.findMany({
      where: { section: { testId: test.id }, type: "SUBJECTIVE" },
      select: { id: true, choiceGroup: true },
    }),
  ]);
  const users = await prisma.user.findMany({
    where: { email: { in: attempts.map((a) => a.studentEmail) } },
    select: { email: true, name: true },
  });
  const names = new Map(users.map((u) => [u.email, u.name]));

  // A choice group is one question to mark.
  const units = new Set(writtenIds.map((q) => q.choiceGroup ?? q.id));
  const unitOf = new Map(writtenIds.map((q) => [q.id, q.choiceGroup ?? q.id]));

  const rows = attempts.map((a) => {
    const marked = new Set(a.responses.map((r) => unitOf.get(r.questionId)).filter(Boolean));
    return { ...a, name: names.get(a.studentEmail) ?? null, marked: marked.size };
  });
  const returned = rows.filter((r) => r.returnedAt).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link href="/admin/tests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:text-brand-blue">
          <ArrowLeft className="h-3.5 w-3.5" /> All tests
        </Link>
        <h1 className="mt-2 font-heading text-xl font-bold text-brand-navy">Mark answer sheets</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          {test.title} &middot; {rows.length} submitted &middot; {returned} returned
          {units.size > 0 && ` · ${units.size} written ${units.size === 1 ? "question" : "questions"} to mark in each`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          Nobody has submitted this test yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-card">
          <ul className="divide-y divide-brand-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/mark/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-brand-page">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-navy">{r.name || r.studentEmail}</p>
                    <p className="truncate text-[11px] text-brand-ink/60">
                      {r.studentEmail}
                      {r.endedAt ? ` · submitted ${formatDate(r.endedAt)}` : ""}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-brand-ink/70">
                    <Images className="h-3.5 w-3.5" /> {r._count.answerImages} {r._count.answerImages === 1 ? "page" : "pages"}
                  </span>
                  {units.size > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand-ink/70">
                      <PenLine className="h-3.5 w-3.5" /> {r.marked}/{units.size} marked
                    </span>
                  )}
                  <span className="w-20 text-right font-mono text-xs font-bold text-brand-navy">
                    {r.result ? `${Number(r.result.score.toFixed(2))} / ${Number(r.result.maxScore.toFixed(2))}` : "—"}
                  </span>
                  {r.returnedAt ? (
                    <span className="inline-flex w-24 items-center justify-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> Returned
                    </span>
                  ) : (
                    <span className="inline-flex w-24 items-center justify-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      <Clock className="h-3 w-3" /> To mark
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
