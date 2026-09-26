/**
 * The clock a timed assessment runs on.
 *
 * Two deadlines are in play and the student is bound by whichever bites first:
 *   dueAt        - the tutor's calendar deadline for the whole assignment.
 *   startedAt + durationMinutes - the personal window that opens the moment
 *                  this student first opens the paper.
 *
 * The window is anchored to a server timestamp (`startedAt`) rather than to
 * anything the browser holds, so reloading the page, opening a second tab or
 * winding the system clock back cannot buy more time. Every function here is
 * pure and takes `now` explicitly; the server and the countdown widget both
 * call the same ones so they can never disagree about when time is up.
 */

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 600; // 10 hours -- longer is a typo, not a test.

export interface TimedAssignment {
  dueAt: Date | string;
  startedAt?: Date | string | null;
  test: { durationMinutes?: number | null };
}

/** Whether this test is on a per-student clock at all. */
export function isTimed(assignment: { test: { durationMinutes?: number | null } }): boolean {
  const d = assignment.test.durationMinutes;
  return typeof d === "number" && d > 0;
}

/**
 * The instant this student's attempt ends: the earlier of the calendar
 * deadline and their personal window. Before they start, only `dueAt` applies
 * -- a timed test they never opened simply closes at the deadline.
 */
export function attemptDeadline(assignment: TimedAssignment): Date {
  const dueAt = new Date(assignment.dueAt);
  if (!isTimed(assignment) || !assignment.startedAt) return dueAt;

  const startedAt = new Date(assignment.startedAt);
  const windowEnd = new Date(
    startedAt.getTime() + assignment.test.durationMinutes! * 60_000
  );
  return windowEnd < dueAt ? windowEnd : dueAt;
}

/** Milliseconds left, floored at 0. */
export function remainingMs(
  assignment: TimedAssignment,
  now: Date = new Date()
): number {
  return Math.max(0, attemptDeadline(assignment).getTime() - now.getTime());
}

/**
 * Whether the attempt is over. Deliberately excludes the exact deadline
 * instant, matching `isPastDue` -- being at 00:00 remaining is not yet late.
 */
export function isTimeUp(
  assignment: TimedAssignment,
  now: Date = new Date()
): boolean {
  return now.getTime() > attemptDeadline(assignment).getTime();
}

/**
 * A countdown label: "09:59" under an hour, "1:09:59" above it. Seconds are
 * rounded up so a fresh 10-minute test reads "10:00" instead of "09:59".
 */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** A duration for admin surfaces: 90 -> "1h 30m", 45 -> "45m". */
export function formatDurationLabel(minutes?: number | null): string {
  if (typeof minutes !== "number" || minutes <= 0) return "No time limit";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export interface DurationParseResult {
  minutes: number | null;
  error?: string;
}

/**
 * Reads the admin's "time limit" box. Blank means untimed, which is why this
 * returns a discriminated result rather than a bare number -- null-as-invalid
 * and null-as-untimed would otherwise be the same value.
 */
export function parseDurationMinutes(input: unknown): DurationParseResult {
  if (input === null || input === undefined) return { minutes: null };
  if (typeof input === "string" && input.trim() === "") return { minutes: null };

  const value = typeof input === "number" ? input : Number(String(input).trim());

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { minutes: null, error: "The time limit must be a whole number of minutes." };
  }
  if (value < MIN_DURATION_MINUTES || value > MAX_DURATION_MINUTES) {
    return {
      minutes: null,
      error: `The time limit must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes, or left blank for no limit.`,
    };
  }
  return { minutes: value };
}
