import React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { studentProgress } from "@/lib/progress";
import { ProgressView } from "@/components/student/ProgressView";
import { LogoLockup } from "@/components/brand/LogoLockup";

export const dynamic = "force-dynamic";

// A private link: keep it out of search engines and previews.
export const metadata: Metadata = { title: "Progress report", robots: { index: false, follow: false } };

/**
 * The read-only progress a student shares with a parent. No sign-in: the
 * link's secret is the permission, and the student can replace or switch it
 * off at any time.
 */
export default async function ParentReportPage({ params }: { params: { token: string } }) {
  if (!/^[\w-]{20,40}$/.test(params.token)) notFound();
  const student = await prisma.user.findUnique({
    where: { parentToken: params.token },
    select: { email: true, name: true, className: true, role: true },
  });
  if (!student || student.role !== "STUDENT") notFound();
  const report = await studentProgress(student.email);

  return (
    <div className="min-h-screen bg-brand-page">
      <header className="border-b border-brand-border bg-brand-navy px-4 py-3">
        <LogoLockup variant="white" href="/login" />
      </header>
      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">Progress report</p>
          <h1 className="font-heading text-xl font-bold text-brand-navy sm:text-2xl">
            {student.name || "Student"}
            {student.className ? <span className="ml-2 text-base font-medium text-brand-ink/60">{student.className}</span> : null}
          </h1>
          <p className="mt-1 text-xs text-brand-ink/60">Shared by the student. Read-only; answers are not shown.</p>
        </div>
        <ProgressView report={report} />
      </main>
    </div>
  );
}
