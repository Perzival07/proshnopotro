import { isAssignmentSubmitted } from "./assignment-status";
import { attemptDeadline, isTimed } from "./exam-timer";

/**
 * The one-time answer upload.
 *
 * Once an attempt ends -- the student finishing, the timer, or the tab guard --
 * the paper closes and the student photographs their answer sheets. They get a
 * single upload, and only for a short window after the end: long enough to
 * photograph a handful of pages on a slow connection, short enough that the
 * time after the bell cannot be spent still writing.
 *
 * Every rule is a pure function of the assignment and `now`, so the server
 * (which enforces them) and the page (which only displays them) agree.
 */

/** Minutes after the attempt ends that the upload stays open. */
export const UPLOAD_WINDOW_MINUTES = 30;

/**
 * Extra time the server still accepts a save that was signed inside the
 * window. Uploading is photo by photo, so a student who pressed Upload with a
 * minute left must not lose everything to the last page arriving late.
 */
export const SAVE_GRACE_MINUTES = 10;

/** Pages accepted in one upload. */
export const MAX_ANSWER_IMAGES = 20;

/** Longest edge of an uploaded photo, in pixels. Enough to read handwriting. */
export const MAX_IMAGE_EDGE = 1600;

/** JPEG quality the photos are re-encoded at before upload. */
export const IMAGE_QUALITY = 0.85;

export interface UploadableAssignment {
  status: "ASSIGNED" | "SUBMITTED";
  result?: unknown | null;
  dueAt: Date | string;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  answersUploadedAt?: Date | string | null;
  test: { durationMinutes?: number | null };
}

/**
 * When this attempt ended, or null if that is not known.
 *
 * `endedAt` is stamped whenever the portal closes an attempt. Rows closed
 * before that column existed fall back to the timed deadline, which puts them
 * long outside any window rather than handing them a fresh one.
 */
export function attemptEndedAt(assignment: UploadableAssignment): Date | null {
  if (assignment.endedAt) return new Date(assignment.endedAt);
  if (isTimed(assignment) && assignment.startedAt) return attemptDeadline(assignment);
  return null;
}

/** When the upload window closes, or null when there is no window at all. */
export function uploadClosesAt(assignment: UploadableAssignment): Date | null {
  const ended = attemptEndedAt(assignment);
  return ended ? new Date(ended.getTime() + UPLOAD_WINDOW_MINUTES * 60_000) : null;
}

export type UploadState = "NOT_ENDED" | "OPEN" | "UPLOADED" | "EXPIRED";

export function uploadState(
  assignment: UploadableAssignment,
  now: Date = new Date()
): UploadState {
  if (assignment.answersUploadedAt) return "UPLOADED";
  if (!isAssignmentSubmitted(assignment)) return "NOT_ENDED";
  const closes = uploadClosesAt(assignment);
  if (!closes || now.getTime() > closes.getTime()) return "EXPIRED";
  return "OPEN";
}

/** Whether a finished save is still accepted (the window plus the grace). */
export function canSaveUpload(
  assignment: UploadableAssignment,
  now: Date = new Date()
): boolean {
  if (assignment.answersUploadedAt || !isAssignmentSubmitted(assignment)) return false;
  const closes = uploadClosesAt(assignment);
  return !!closes && now.getTime() <= closes.getTime() + SAVE_GRACE_MINUTES * 60_000;
}

/** The Cloudinary folder one assignment's pages live in. */
export function answerFolder(assignmentId: string): string {
  return `proshnopotro/answers/${assignmentId}`;
}

/**
 * Whether a public id the browser reports really sits in this assignment's
 * folder. The upload signature pins the folder, but the save call is a
 * separate request and must not let one student attach another's files.
 */
export function isInAnswerFolder(publicId: string, assignmentId: string): boolean {
  const prefix = `${answerFolder(assignmentId)}/`;
  return (
    publicId.startsWith(prefix) &&
    publicId.length > prefix.length &&
    !publicId.slice(prefix.length).includes("..")
  );
}

/**
 * Scales an image to fit within `maxEdge` on its longest side, never
 * enlarging it. Returns whole pixels, at least 1 on each side.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
