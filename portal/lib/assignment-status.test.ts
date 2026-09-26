import { describe, it, expect } from "vitest";
import {
  isAssignmentSubmitted,
  isPastDue,
  deriveCardStatus,
} from "./assignment-status";

const someResult = { id: "r1", score: 46, maxScore: 50 };

describe("isAssignmentSubmitted", () => {
  it("is true when the status column says SUBMITTED", () => {
    expect(isAssignmentSubmitted({ status: "SUBMITTED", result: null })).toBe(true);
  });

  it("is true when a result exists even if status still says ASSIGNED", () => {
    // Regression: an admin action that flipped only `status` left the result
    // behind, so 'un-submitting' a graded student silently did nothing.
    expect(isAssignmentSubmitted({ status: "ASSIGNED", result: someResult })).toBe(true);
  });

  it("is false only when neither says submitted", () => {
    expect(isAssignmentSubmitted({ status: "ASSIGNED", result: null })).toBe(false);
  });

  it("treats undefined result the same as null", () => {
    expect(isAssignmentSubmitted({ status: "ASSIGNED" })).toBe(false);
  });
});

describe("isPastDue", () => {
  const due = new Date("2026-09-08T18:29:00.000Z");
  it("is false before the deadline", () => {
    expect(isPastDue(due, new Date("2026-09-08T18:28:59.000Z"))).toBe(false);
  });
  it("is true after the deadline", () => {
    expect(isPastDue(due, new Date("2026-09-08T18:29:01.000Z"))).toBe(true);
  });
  it("is false exactly at the deadline", () => {
    expect(isPastDue(due, due)).toBe(false);
  });
  it("accepts an ISO string", () => {
    expect(isPastDue(due.toISOString(), new Date("2026-09-09T00:00:00.000Z"))).toBe(true);
  });
});

describe("deriveCardStatus", () => {
  const now = new Date("2026-09-01T00:00:00.000Z");
  const future = new Date("2026-09-08T00:00:00.000Z");
  const past = new Date("2026-08-01T00:00:00.000Z");
  const active = { active: true };

  it("is AVAILABLE for an open, active, undue test", () => {
    expect(
      deriveCardStatus({ status: "ASSIGNED", dueAt: future, result: null, test: active }, now)
    ).toBe("AVAILABLE");
  });

  it("is SUBMITTED once a result exists, even past the deadline", () => {
    expect(
      deriveCardStatus({ status: "ASSIGNED", dueAt: past, result: someResult, test: active }, now)
    ).toBe("SUBMITTED");
  });

  it("submission outranks a deactivated test", () => {
    expect(
      deriveCardStatus({ status: "SUBMITTED", dueAt: future, result: null, test: { active: false } }, now)
    ).toBe("SUBMITTED");
  });

  it("is CLOSED when the test is deactivated", () => {
    expect(
      deriveCardStatus({ status: "ASSIGNED", dueAt: future, result: null, test: { active: false } }, now)
    ).toBe("CLOSED");
  });

  it("is CLOSED once the deadline passes", () => {
    expect(
      deriveCardStatus({ status: "ASSIGNED", dueAt: past, result: null, test: active }, now)
    ).toBe("CLOSED");
  });

  it("is CLOSED when a timed attempt's own window has run out", () => {
    // The tutor's deadline is still a week off, but this student's 30 minutes
    // ended an hour ago -- the card must not offer them the paper again.
    expect(
      deriveCardStatus(
        {
          status: "ASSIGNED",
          dueAt: future,
          startedAt: new Date("2026-08-31T23:00:00.000Z"),
          result: null,
          test: { active: true, durationMinutes: 30 },
        },
        now
      )
    ).toBe("CLOSED");
  });

  it("is AVAILABLE while a timed attempt still has minutes left", () => {
    expect(
      deriveCardStatus(
        {
          status: "ASSIGNED",
          dueAt: future,
          startedAt: new Date("2026-08-31T23:50:00.000Z"),
          result: null,
          test: { active: true, durationMinutes: 30 },
        },
        now
      )
    ).toBe("AVAILABLE");
  });

  it("is AVAILABLE for a timed test the student has not opened yet", () => {
    expect(
      deriveCardStatus(
        {
          status: "ASSIGNED",
          dueAt: future,
          startedAt: null,
          result: null,
          test: { active: true, durationMinutes: 30 },
        },
        now
      )
    ).toBe("AVAILABLE");
  });
});
