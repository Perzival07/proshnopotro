import { describe, it, expect } from "vitest";
import {
  attemptDeadline,
  formatDurationLabel,
  formatRemaining,
  isTimed,
  isTimeUp,
  parseDurationMinutes,
  remainingMs,
} from "./exam-timer";

const dueAt = new Date("2026-09-08T18:00:00.000Z");
const startedAt = new Date("2026-09-08T10:00:00.000Z");

describe("isTimed", () => {
  it("is false when the tutor left the limit blank", () => {
    expect(isTimed({ test: { durationMinutes: null } })).toBe(false);
  });
  it("is false for a zero limit, which would otherwise expire instantly", () => {
    expect(isTimed({ test: { durationMinutes: 0 } })).toBe(false);
  });
  it("is true for a positive limit", () => {
    expect(isTimed({ test: { durationMinutes: 45 } })).toBe(true);
  });
});

describe("attemptDeadline", () => {
  it("is the calendar deadline for an untimed test", () => {
    expect(attemptDeadline({ dueAt, startedAt, test: { durationMinutes: null } })).toEqual(dueAt);
  });

  it("is the calendar deadline for a timed test the student has not opened", () => {
    // Nothing has started counting, so the window has not opened yet.
    expect(attemptDeadline({ dueAt, startedAt: null, test: { durationMinutes: 45 } })).toEqual(dueAt);
  });

  it("is start + duration once the student has opened it", () => {
    expect(
      attemptDeadline({ dueAt, startedAt, test: { durationMinutes: 45 } })
    ).toEqual(new Date("2026-09-08T10:45:00.000Z"));
  });

  it("never runs past the calendar deadline", () => {
    // A 3-hour window opened 30 minutes before the deadline still ends at the
    // deadline -- starting late must not extend the assignment.
    expect(
      attemptDeadline({
        dueAt,
        startedAt: new Date("2026-09-08T17:30:00.000Z"),
        test: { durationMinutes: 180 },
      })
    ).toEqual(dueAt);
  });

  it("accepts ISO strings, as they arrive from a client payload", () => {
    expect(
      attemptDeadline({
        dueAt: dueAt.toISOString(),
        startedAt: startedAt.toISOString(),
        test: { durationMinutes: 30 },
      })
    ).toEqual(new Date("2026-09-08T10:30:00.000Z"));
  });
});

describe("remainingMs", () => {
  const assignment = { dueAt, startedAt, test: { durationMinutes: 60 } };

  it("counts down within the window", () => {
    expect(remainingMs(assignment, new Date("2026-09-08T10:15:00.000Z"))).toBe(45 * 60_000);
  });

  it("floors at zero rather than going negative", () => {
    expect(remainingMs(assignment, new Date("2026-09-08T23:00:00.000Z"))).toBe(0);
  });

  it("ignores a clock wound back before the start", () => {
    // A student who sets their machine back gets the honest remainder, because
    // the anchor is the server-stamped startedAt, not their clock.
    expect(remainingMs(assignment, new Date("2026-09-08T09:00:00.000Z"))).toBe(120 * 60_000);
  });
});

describe("isTimeUp", () => {
  const assignment = { dueAt, startedAt, test: { durationMinutes: 60 } };

  it("is false inside the window", () => {
    expect(isTimeUp(assignment, new Date("2026-09-08T10:59:59.000Z"))).toBe(false);
  });
  it("is false exactly at the deadline, matching isPastDue", () => {
    expect(isTimeUp(assignment, new Date("2026-09-08T11:00:00.000Z"))).toBe(false);
  });
  it("is true one second past it", () => {
    expect(isTimeUp(assignment, new Date("2026-09-08T11:00:01.000Z"))).toBe(true);
  });
  it("still honours the calendar deadline for an untimed test", () => {
    expect(
      isTimeUp({ dueAt, startedAt, test: { durationMinutes: null } }, new Date("2026-09-08T18:00:01.000Z"))
    ).toBe(true);
  });
});

describe("formatRemaining", () => {
  it("shows mm:ss under an hour", () => {
    expect(formatRemaining(9 * 60_000 + 5_000)).toBe("09:05");
  });
  it("shows h:mm:ss at or above an hour", () => {
    expect(formatRemaining(3_600_000 + 5 * 60_000 + 9_000)).toBe("1:05:09");
  });
  it("rounds part-seconds up so a fresh 10-minute test reads 10:00", () => {
    expect(formatRemaining(599_400)).toBe("10:00");
  });
  it("reads 00:00 at zero and below", () => {
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-5_000)).toBe("00:00");
  });
});

describe("formatDurationLabel", () => {
  it("names the untimed case", () => {
    expect(formatDurationLabel(null)).toBe("No time limit");
    expect(formatDurationLabel(0)).toBe("No time limit");
  });
  it("formats minutes, hours, and both", () => {
    expect(formatDurationLabel(45)).toBe("45m");
    expect(formatDurationLabel(120)).toBe("2h");
    expect(formatDurationLabel(90)).toBe("1h 30m");
  });
});

describe("parseDurationMinutes", () => {
  it("treats blank and absent as untimed, not as an error", () => {
    expect(parseDurationMinutes("")).toEqual({ minutes: null });
    expect(parseDurationMinutes("   ")).toEqual({ minutes: null });
    expect(parseDurationMinutes(undefined)).toEqual({ minutes: null });
    expect(parseDurationMinutes(null)).toEqual({ minutes: null });
  });

  it("accepts a plain number and its string form", () => {
    expect(parseDurationMinutes(45)).toEqual({ minutes: 45 });
    expect(parseDurationMinutes(" 45 ")).toEqual({ minutes: 45 });
  });

  it("rejects non-numeric and fractional input", () => {
    expect(parseDurationMinutes("abc").error).toBeTruthy();
    expect(parseDurationMinutes("12.5").error).toBeTruthy();
  });

  it("rejects a limit outside the allowed range", () => {
    // 0 would expire the moment the paper opened; the upper bound catches a
    // stray extra digit.
    expect(parseDurationMinutes(0).error).toBeTruthy();
    expect(parseDurationMinutes(-30).error).toBeTruthy();
    expect(parseDurationMinutes(6000).error).toBeTruthy();
  });
});
