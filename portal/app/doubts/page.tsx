import React from "react";
import Link from "next/link";
import { requireCompleteStudent } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { statusLabel } from "@/lib/doubts";
import { formatDate } from "@/lib/utils";
import { MessageCircleQuestion } from "lucide-react";

export const dynamic = "force-dynamic";

/** Every doubt the student has asked, newest activity first. */
export default async function MyDoubtsPage() {
  const user = await requireCompleteStudent();
  const email = user.email.toLowerCase();
  const doubts = await prisma.doubt.findMany({
    where: { studentEmail: email },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      question: { select: { stem: true, section: { select: { test: { select: { id: true, title: true } } } } } },
    },
  });
  const assignments = await prisma.assignment.findMany({
    where: { studentEmail: email, testId: { in: Array.from(new Set(doubts.map((d) => d.question.section.test.id))) } },
    select: { id: true, testId: true },
  });
  const assignmentOf = new Map(assignments.map((a) => [a.testId, a.id]));

  return (
    <div className="flex min-h-screen flex-col justify-between bg-brand-page">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="font-heading text-xl font-bold text-brand-navy sm:text-2xl">Your doubts</h1>
          <p className="mt-1 text-xs text-brand-ink/60">
            Ask about any question from its result page. Your tutor&apos;s replies appear here and under the question.
          </p>
        </div>
        {doubts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
            <MessageCircleQuestion className="mx-auto mb-2 h-6 w-6 text-brand-ink/40" />
            No doubts yet. Open a marked test and choose &ldquo;Ask a doubt&rdquo; under a question.
          </div>
        ) : (
          <ul className="divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border bg-white shadow-card">
            {doubts.map((d) => {
              const last = d.messages[0];
              const href = assignmentOf.get(d.question.section.test.id);
              return (
                <li key={d.id}>
                  <Link href={href ? `/test/${href}` : "/"} className="block px-4 py-3 hover:bg-brand-page">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-brand-navy">{d.question.section.test.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          d.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : d.status === "ANSWERED" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {statusLabel(d.status, "student")}
                      </span>
                      {d.studentUnread && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">New reply</span>
                      )}
                      <span className="ml-auto text-[11px] text-brand-ink/50">{formatDate(d.updatedAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-brand-ink/60">{d.question.stem.replace(/\s+/g, " ")}</p>
                    {last && (
                      <p className="mt-1 line-clamp-2 text-xs text-brand-ink/80">
                        <span className="font-semibold">{last.fromTutor ? "Your tutor: " : "You: "}</span>
                        {last.body}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
