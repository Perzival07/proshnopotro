import React from "react";
import { requireCompleteStudent } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StudentTestCard } from "@/components/student/StudentTestCard";
import { EmptyState } from "@/components/student/EmptyState";
import { Clock, CheckCircle2, BookOpen, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const user = await requireCompleteStudent();

  // Resolve assignments strictly by session email
  const assignments = await prisma.assignment.findMany({
    where: {
      studentEmail: user.email.toLowerCase(),
    },
    include: {
      test: true,
      result: true,
    },
    orderBy: [
      { status: "asc" },
      { dueAt: "asc" },
    ],
  });

  const availableCount = assignments.filter(
    (a) =>
      a.status === "ASSIGNED" &&
      a.test.active &&
      new Date() <= new Date(a.dueAt)
  ).length;

  const submittedCount = assignments.filter(
    (a) => a.status === "SUBMITTED" || a.result !== null
  ).length;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-brand-page">
      <Navbar user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome & Stats Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-brand-navy">
                Welcome, {user.name || "Student"}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-tint text-brand-navy border border-brand-blue/30">
                {user.className || "Student"}
              </span>
            </div>
            <p className="text-body text-brand-ink/70 mt-1 text-sm">
              Your assigned assessments for Classes by Koustav.
            </p>
          </div>

          {/* Quick summary chips */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-brand-border shadow-xs">
              <div className="h-2.5 w-2.5 rounded-full bg-[#E58A1F]" />
              <span className="text-xs font-medium text-brand-ink/80">
                <strong className="text-brand-navy font-semibold">{availableCount}</strong> Available
              </span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-brand-border shadow-xs">
              <div className="h-2.5 w-2.5 rounded-full bg-[#085041]" />
              <span className="text-xs font-medium text-brand-ink/80">
                <strong className="text-brand-navy font-semibold">{submittedCount}</strong> Completed
              </span>
            </div>
          </div>
        </div>

        {/* Tests Grid */}
        {assignments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-brand-navy flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-blue" />
                <span>Assigned Tests ({assignments.length})</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map((assignment) => (
                <StudentTestCard
                  key={assignment.id}
                  assignment={assignment}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
