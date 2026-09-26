import React from "react";
import { requireCompleteStudent } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { studentProgress } from "@/lib/progress";
import { ProgressView } from "@/components/student/ProgressView";
import { ParentLinkPanel } from "./ParentLinkPanel";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireCompleteStudent();
  const [report, me] = await Promise.all([
    studentProgress(user.email.toLowerCase()),
    prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { parentToken: true } }),
  ]);
  return (
    <div className="flex min-h-screen flex-col justify-between bg-brand-page">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="font-heading text-xl font-bold text-brand-navy sm:text-2xl">Your progress</h1>
          <p className="mt-1 text-xs text-brand-ink/60">Every marked test over time, by series and by chapter.</p>
        </div>
        <ParentLinkPanel initialToken={me?.parentToken ?? null} />
        <ProgressView report={report} />
      </main>
      <Footer />
    </div>
  );
}
