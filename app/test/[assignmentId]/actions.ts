"use server";

import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { revalidatePath } from "next/cache";
import { toEmbedUrl, type TestFormat } from "@/lib/test-resource";
import { attemptDeadline, isTimed, isTimeUp, remainingMs } from "@/lib/exam-timer";
import { isProctored, registerSwitch, warningMessage } from "@/lib/proctoring";

export interface FormResolutionResult {
  /**
   * The resource rewritten so it renders inside an iframe. The paper is only
   * ever shown within the portal, so the raw link is deliberately not returned.
   */
  embedUrl?: string;
  format?: TestFormat;
  /** Present only for a timed test: when this student's attempt ends. */
  endsAt?: string;
  /**
   * The server's clock at the moment of the reply. The countdown corrects for
   * the offset against this, so a browser clock that is minutes out does not
   * hand the student extra time or cut them short.
   */
  serverNow?: string;
  error?: string;
}

/**
 * High-security server action.
 * Resolves the Google Form URL on demand ONLY after strict verification.
 * The URL is NEVER serialized into the page HTML or client bundles.
 */
export async function resolveSecureFormUrl(
  assignmentId: string
): Promise<FormResolutionResult> {
  const sessionUser = await getVerifiedSession();
  if (!sessionUser?.email) {
    return { error: "Authentication required. Please sign in again." };
  }

  const normalizedEmail = sessionUser.email.trim().toLowerCase();

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      test: true,
      result: true,
    },
  });

  if (!assignment) {
    return { error: "Assignment not found." };
  }

  // 1. Email ownership verification
  if (assignment.studentEmail.toLowerCase() !== normalizedEmail) {
    return { error: "Unauthorized: This assessment is not assigned to your account." };
  }

  // 2. Submission status verification
  if (isAssignmentSubmitted(assignment)) {
    return { error: "This assessment has already been submitted." };
  }

  // 3. Test active status verification
  if (!assignment.test.active) {
    return { error: "This test has been deactivated by the tutor." };
  }

  // 4. Deadline verification -- the tutor's date and, on a timed test, the
  //    student's own window, whichever ends first. Re-opening the paper after
  //    the window closed must not hand the paper back, so this is checked
  //    against the stored `startedAt` rather than anything the client sent.
  if (isTimeUp(assignment)) {
    await closeOutAssignment(assignment.id, isTimed(assignment));
    return {
      error: isTimed(assignment)
        ? "Your time for this assessment is up. It has been submitted automatically."
        : "The deadline for this assessment has passed.",
    };
  }

  if (!assignment.test.formUrl) {
    return { error: "The question paper link is not configured. Please contact your tutor." };
  }

  const format = assignment.test.format as TestFormat;
  const embedUrl = toEmbedUrl(assignment.test.formUrl, format);

  if (!embedUrl) {
    return {
      error:
        "This paper's link cannot be displayed in the portal. Please ask your tutor to re-save it.",
    };
  }

  // Start the clock on first sight of the paper, and only then -- a student
  // who never opened it should not lose the window to a stale timestamp.
  const startedAt = await ensureStarted(assignment);

  if (!isTimed(assignment)) {
    return { embedUrl, format };
  }

  const deadline = attemptDeadline({ ...assignment, startedAt });
  return {
    embedUrl,
    format,
    endsAt: deadline.toISOString(),
    serverNow: new Date().toISOString(),
  };
}

/**
 * Stamps `startedAt` the first time a timed paper is opened and returns the
 * value now in force.
 *
 * The write is conditional on the column still being null so that two tabs
 * opening at once cannot restart the clock -- whoever loses the race reads the
 * winner's timestamp back rather than overwriting it.
 */
async function ensureStarted(assignment: {
  id: string;
  startedAt: Date | null;
  test: { durationMinutes: number | null };
}): Promise<Date | null> {
  if (!isTimed(assignment) || assignment.startedAt) return assignment.startedAt;

  const now = new Date();
  const claimed = await prisma.assignment.updateMany({
    where: { id: assignment.id, startedAt: null },
    data: { startedAt: now },
  });

  if (claimed.count > 0) {
    revalidatePath("/");
    return now;
  }

  const fresh = await prisma.assignment.findUnique({
    where: { id: assignment.id },
    select: { startedAt: true },
  });
  return fresh?.startedAt ?? now;
}

/** Marks an assignment submitted, recording whether the timer did it. */
async function closeOutAssignment(assignmentId: string, auto: boolean) {
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: "SUBMITTED", autoSubmitted: auto },
  });

  revalidatePath(`/test/${assignmentId}`);
  revalidatePath("/");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/results");
}

export type SubmissionTrigger = "STUDENT" | "TIMER" | "TAB_SWITCH";

/**
 * Records a submission, either because the student confirmed it or because
 * their timer ran out (works for both graded and non-graded forms).
 *
 * A TIMER submission is re-checked against the server's own clock before it is
 * accepted: the browser is the one that notices zero, but it is not the one
 * that gets to decide the attempt is over.
 */
export async function markStudentSubmission(
  assignmentId: string,
  trigger: SubmissionTrigger = "STUDENT"
) {
  const sessionUser = await getVerifiedSession();
  if (!sessionUser?.email) {
    return { error: "Authentication required." };
  }

  const normalizedEmail = sessionUser.email.trim().toLowerCase();

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { test: { select: { durationMinutes: true } }, result: true },
  });

  if (!assignment) {
    return { error: "Assignment not found." };
  }

  if (assignment.studentEmail.toLowerCase() !== normalizedEmail) {
    return { error: "Unauthorized." };
  }

  // Already done (including by an earlier auto-submit) -- treat as success so a
  // countdown that fires twice does not surface a spurious error.
  if (isAssignmentSubmitted(assignment)) {
    return { success: true, alreadySubmitted: true };
  }

  if (trigger === "TIMER" && remainingMs(assignment) > 0) {
    return { error: "There is still time left on this assessment." };
  }

  try {
    await closeOutAssignment(assignmentId, trigger === "TIMER");
    return { success: true };
  } catch (err) {
    console.error("Failed to mark student submission:", err);
    return { error: "Database error marking submission." };
  }
}


/** Sentinel for "not being watched", so the client stops counting. */
const MAX_UNWATCHED = Number.MAX_SAFE_INTEGER;

export interface TabSwitchResult {
  count?: number;
  remaining?: number;
  submitted?: boolean;
  message?: string;
  error?: string;
}

/**
 * Records that the student left the exam tab, and ends the attempt once they
 * have done it too often.
 *
 * The increment is a single atomic statement rather than a read-then-write:
 * leaving and returning quickly can fire two of these at once, and a
 * read-modify-write would let one overwrite the other, quietly handing the
 * student a free departure.
 */
export async function recordTabSwitch(
  assignmentId: string
): Promise<TabSwitchResult> {
  const sessionUser = await getVerifiedSession();
  if (!sessionUser?.email) {
    return { error: "Authentication required." };
  }

  const normalizedEmail = sessionUser.email.trim().toLowerCase();

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      test: { select: { proctored: true, durationMinutes: true } },
      result: true,
    },
  });

  if (!assignment) return { error: "Assignment not found." };
  if (assignment.studentEmail.toLowerCase() !== normalizedEmail) {
    return { error: "Unauthorized." };
  }

  // Nothing to police on an unproctored test or a finished attempt.
  if (!isProctored(assignment)) return { count: 0, remaining: MAX_UNWATCHED };
  if (isAssignmentSubmitted(assignment)) {
    return { submitted: true, count: assignment.tabSwitches };
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { tabSwitches: { increment: 1 } },
    select: { tabSwitches: true },
  });

  const outcome = registerSwitch(updated.tabSwitches - 1);

  if (outcome.shouldSubmit) {
    await closeOutAssignment(assignmentId, true);
    return {
      count: outcome.count,
      remaining: 0,
      submitted: true,
      message: warningMessage(outcome),
    };
  }

  revalidatePath("/admin/roster");

  return {
    count: outcome.count,
    remaining: outcome.remaining,
    submitted: false,
    message: warningMessage(outcome),
  };
}
