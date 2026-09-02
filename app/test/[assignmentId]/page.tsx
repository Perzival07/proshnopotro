import React from "react";
import { requireCompleteStudent } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SubjectIcon } from "@/components/SubjectIcon";
import { StartTestButton } from "./StartTestButton";
import { formatDate } from "@/lib/utils";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { attemptDeadline, formatDurationLabel, isTimed, isTimeUp } from "@/lib/exam-timer";
import { closeExpiredAttempts } from "@/lib/close-expired";
import { AlertTriangle, ArrowLeft, Calendar, Shield, Timer } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: {
    assignmentId: string;
  };
}

export default async function TestConfirmationPage({ params }: PageProps) {
  const user = await requireCompleteStudent();

  // Query test metadata WITHOUT selecting formUrl into HTML
  const assignment = await prisma.assignment.findUnique({
    where: { id: params.assignmentId },
    select: {
      id: true,
      studentEmail: true,
      dueAt: true,
      startedAt: true,
      status: true,
      test: {
        select: {
          id: true,
          title: true,
          subject: true,
          description: true,
          iconName: true,
          active: true,
          format: true,
          durationMinutes: true,
          proctored: true,
          // formUrl is explicitly OMITTED to prevent leakage into HTML
        },
      },
      result: {
        select: {
          id: true,
          score: true,
          maxScore: true,
        },
      },
    },
  });

  if (!assignment) {
    notFound();
  }

  // Security check: Must belong to signed-in user
  if (assignment.studentEmail.toLowerCase() !== user.email.toLowerCase()) {
    redirect("/");
  }

  // A window that ran out while the student was away is closed here, so the
  // record catches up before the page decides what to show them.
  await closeExpiredAttempts([assignment]);

  const isSubmitted = isAssignmentSubmitted(assignment);
  const isInactive = !assignment.test.active;

  // Covers both the tutor's deadline and, once started, this student's own
  // window -- either one ending puts the paper out of reach.
  const outOfTime = isTimeUp(assignment);

  // If closed or already submitted, redirect to dashboard
  if (isSubmitted || outOfTime || isInactive) {
    redirect("/");
  }

  const timed = isTimed(assignment);
  // Only a started attempt has a live clock; before that the countdown has
  // nothing to count and the student still sees the limit stated below.
  const endsAt = timed && assignment.startedAt ? attemptDeadline(assignment) : null;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-brand-page">
      <Navbar user={user} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:text-brand-blue mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Assessments</span>
        </Link>

        {/* Confirmation Container */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-card overflow-hidden">
          {/* Header Banner */}
          <div className="bg-brand-tint p-6 sm:p-8 border-b border-brand-border/60 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs border border-brand-border text-brand-navy">
              <SubjectIcon
                name={assignment.test.iconName}
                className="h-8 w-8 stroke-[2]"
              />
            </div>
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-brand-blue mb-1">
                {assignment.test.subject}
              </span>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-brand-navy leading-snug">
                {assignment.test.title}
              </h1>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8 space-y-6">
            {assignment.test.description && (
              <div className="text-body text-brand-ink/80 text-sm leading-relaxed">
                {assignment.test.description}
              </div>
            )}

            {/* Assessment Details Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-brand-page rounded-xl border border-brand-border/80 text-xs">
              <div className="flex items-center gap-2 text-brand-ink/75">
                <Calendar className="h-4 w-4 text-brand-blue shrink-0" />
                <span>
                  <strong>Submission Deadline:</strong>{" "}
                  {formatDate(assignment.dueAt)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-brand-ink/75">
                <Shield className="h-4 w-4 text-brand-navy shrink-0" />
                <span>
                  <strong>Candidate Email:</strong> {user.email}
                </span>
              </div>
              {timed && (
                <div className="flex items-center gap-2 text-brand-ink/75">
                  <Timer className="h-4 w-4 text-brand-blue shrink-0" />
                  <span>
                    <strong>Time Limit:</strong>{" "}
                    {formatDurationLabel(assignment.test.durationMinutes)}
                  </span>
                </div>
              )}
            </div>

            {/* Mandatory Instruction Warning Alert */}
            <div className="p-4 rounded-xl bg-[#FAEEDA] border border-[#F3DCB5] text-[#633806] flex items-start gap-3.5">
              <AlertTriangle className="h-5 w-5 text-[#E58A1F] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-heading font-semibold text-sm">
                  Important Assessment Guidelines
                </p>
                <p className="text-xs leading-relaxed font-medium">
                  You get one attempt. Do not close the form until you submit.
                </p>
                {timed && (
                  <p className="text-xs leading-relaxed font-medium">
                    {assignment.startedAt
                      ? "Your timer is already running \u2014 it started when you first opened this paper and does not reset."
                      : `This is a timed assessment. Your ${formatDurationLabel(
                          assignment.test.durationMinutes
                        )} starts the moment you open the paper and keeps running if you close this page. When it reaches zero the assessment is submitted automatically.`}
                  </p>
                )}
                {assignment.test.proctored && (
                  <p className="text-xs leading-relaxed font-medium">
                    Stay on this tab once the paper opens. Switching to another tab,
                    another window or another app is recorded; the third time your
                    assessment is submitted automatically.
                  </p>
                )}
                <p className="text-[11px] opacity-80 leading-normal">
                  Make sure your internet connection is stable before opening the test.
                </p>
              </div>
            </div>

            {/* Form Launch Button */}
            <div className="pt-2">
              <StartTestButton
                assignmentId={assignment.id}
                testTitle={assignment.test.title}
                testFormat={assignment.test.format}
                studentName={user.name}
                initialEndsAt={endsAt?.toISOString() ?? null}
                initialServerNow={endsAt ? new Date().toISOString() : null}
                proctored={assignment.test.proctored}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
