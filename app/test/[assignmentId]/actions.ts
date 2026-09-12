"use server";

import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { revalidatePath } from "next/cache";
import { toEmbedUrl, type TestFormat } from "@/lib/test-resource";
import { attemptDeadline, isTimed, isTimeUp, remainingMs } from "@/lib/exam-timer";
import { isProctored, registerSwitch, warningMessage } from "@/lib/proctoring";
import {
  answerFolder,
  canSaveUpload,
  isInAnswerFolder,
  MAX_ANSWER_IMAGES,
  uploadClosesAt,
  uploadState,
  type UploadState,
} from "@/lib/answer-upload";
import { signAnswerUpload, type UploadSignature } from "@/lib/cloudinary";

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
  /** The attempt is over, so the page should move on to the answer upload. */
  ended?: boolean;
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
    return { error: "This assessment has already been submitted.", ended: true };
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
    // The attempt ended at its deadline, not now: a student coming back hours
    // later must not be handed a fresh upload window.
    await closeOutAssignment(assignment.id, isTimed(assignment), attemptDeadline(assignment));
    return {
      error: isTimed(assignment)
        ? "Your time for this assessment is up. It has been submitted automatically."
        : "The deadline for this assessment has passed.",
      ended: true,
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

/**
 * Marks an assignment submitted, recording whether the timer did it and when
 * the attempt ended -- the answer upload window runs from that instant.
 *
 * Guarded on status so an attempt already closed keeps its original end time.
 */
async function closeOutAssignment(
  assignmentId: string,
  auto: boolean,
  endedAt: Date = new Date()
) {
  await prisma.assignment.updateMany({
    where: { id: assignmentId, status: "ASSIGNED" },
    data: { status: "SUBMITTED", autoSubmitted: auto, endedAt },
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
    // The timer's attempt ended at the deadline, however late the request.
    await closeOutAssignment(
      assignmentId,
      trigger === "TIMER",
      trigger === "TIMER" ? attemptDeadline(assignment) : new Date()
    );
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

// ─────────────────────────────────────────────────────────────
// ANSWER UPLOAD
// ─────────────────────────────────────────────────────────────

/** Loads an assignment the signed-in student owns, or explains why not. */
async function loadOwnAssignment(assignmentId: string) {
  const sessionUser = await getVerifiedSession();
  if (!sessionUser?.email) {
    return { error: "Authentication required. Please sign in again." } as const;
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      test: { select: { durationMinutes: true } },
      result: { select: { id: true } },
      _count: { select: { answerImages: true } },
    },
  });

  if (!assignment) return { error: "Assignment not found." } as const;
  if (assignment.studentEmail.toLowerCase() !== sessionUser.email.trim().toLowerCase()) {
    return { error: "Unauthorized." } as const;
  }
  return { assignment } as const;
}

export interface AnswerUploadStatus {
  state?: UploadState;
  /** When the one-time upload closes. */
  closesAt?: string;
  /** The server clock, so the page can correct for a skewed browser clock. */
  serverNow?: string;
  /** Pages already saved, once uploaded. */
  pageCount?: number;
  error?: string;
}

/** What the upload panel should show: open, already done, or too late. */
export async function getAnswerUploadStatus(
  assignmentId: string
): Promise<AnswerUploadStatus> {
  const loaded = await loadOwnAssignment(assignmentId);
  if ("error" in loaded) return { error: loaded.error };
  const { assignment } = loaded;

  const closes = uploadClosesAt(assignment);
  return {
    state: uploadState(assignment),
    closesAt: closes?.toISOString(),
    serverNow: new Date().toISOString(),
    pageCount: assignment._count.answerImages,
  };
}

export interface SignatureResult {
  upload?: UploadSignature;
  error?: string;
}

/**
 * A short-lived permission to upload straight to Cloudinary, pinned to this
 * assignment's folder. Only issued while the window is open and nothing has
 * been saved yet.
 */
export async function getAnswerUploadSignature(
  assignmentId: string
): Promise<SignatureResult> {
  const loaded = await loadOwnAssignment(assignmentId);
  if ("error" in loaded) return { error: loaded.error };
  const { assignment } = loaded;

  const state = uploadState(assignment);
  if (state === "UPLOADED") return { error: "Your answers have already been uploaded." };
  if (state === "NOT_ENDED") return { error: "Finish the assessment before uploading your answers." };
  if (state === "EXPIRED") return { error: "The time to upload your answers is over." };

  const upload = signAnswerUpload(answerFolder(assignment.id));
  if (!upload) {
    console.error("Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.");
    return { error: "Uploads are not set up yet. Please tell your tutor." };
  }
  return { upload };
}

export interface UploadedPage {
  publicId: string;
  version: number;
  format: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
}

/**
 * Records the uploaded pages. This is the one-time step: the stamp is claimed
 * with a conditional write, so two taps or two tabs cannot both save a set.
 */
export async function saveAnswerUploads(
  assignmentId: string,
  pages: UploadedPage[]
): Promise<{ success?: true; pageCount?: number; error?: string }> {
  const loaded = await loadOwnAssignment(assignmentId);
  if ("error" in loaded) return { error: loaded.error };
  const { assignment } = loaded;

  if (assignment.answersUploadedAt) {
    return { error: "Your answers have already been uploaded." };
  }
  if (!canSaveUpload(assignment)) {
    return { error: "The time to upload your answers is over." };
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    return { error: "Add at least one photo of your answers." };
  }
  if (pages.length > MAX_ANSWER_IMAGES) {
    return { error: `You can upload at most ${MAX_ANSWER_IMAGES} pages.` };
  }

  for (const page of pages) {
    if (
      typeof page?.publicId !== "string" ||
      !isInAnswerFolder(page.publicId, assignment.id) ||
      !Number.isInteger(page.version) ||
      typeof page.format !== "string" ||
      !/^[a-z0-9]{2,5}$/i.test(page.format)
    ) {
      return { error: "One of the uploaded pages could not be verified. Please try again." };
    }
  }

  const toInt = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const claimed = await tx.assignment.updateMany({
        where: { id: assignment.id, answersUploadedAt: null },
        data: { answersUploadedAt: new Date() },
      });
      if (claimed.count === 0) return false;

      await tx.answerImage.createMany({
        data: pages.map((page, index) => ({
          assignmentId: assignment.id,
          publicId: page.publicId,
          version: page.version,
          format: page.format.toLowerCase(),
          width: toInt(page.width),
          height: toInt(page.height),
          bytes: toInt(page.bytes),
          position: index,
        })),
      });
      return true;
    });

    if (!saved) return { error: "Your answers have already been uploaded." };
  } catch (err) {
    console.error("Failed to save answer uploads:", err);
    return { error: "Your photos were sent but could not be saved. Please press Upload again." };
  }

  revalidatePath("/");
  revalidatePath("/admin/roster");
  return { success: true, pageCount: pages.length };
}
