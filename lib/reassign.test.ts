import { describe, it, expect } from "vitest";
import { canReassign, parseNewDeadline, REOPEN_DATA } from "./reassign";

const someResult = { id: "r1", score: 46, maxScore: 50 };

describe("canReassign", () => {
  it("allows a student-submitted attempt", () => {
    expect(canReassign({ status: "SUBMITTED", result: null })).toBe(true);
  });

  it("allows an auto-submitted attempt", () => {
    // The timer and the tab guard are exactly the cases a tutor reopens.
    expect(canReassign({ status: "SUBMITTED", result: null })).toBe(true);
  });

  it("allows a graded attempt whose status column still says ASSIGNED", () => {
    expect(canReassign({ status: "ASSIGNED", result: someResult })).toBe(true);
  });

  it("refuses an attempt that is still open", () => {
    expect(canReassign({ status: "ASSIGNED", result: null })).toBe(false);
  });
});

describe("REOPEN_DATA", () => {
  it("clears the clock, the tally and the auto-submit flag together", () => {
    // Each of these left behind breaks the retake in its own way, so the set
    // is asserted whole rather than field by field.
    expect(REOPEN_DATA).toEqual({
      status: "ASSIGNED",
      startedAt: null,
      autoSubmitted: false,
      tabSwitches: 0,
    });
  });
});

describe("parseNewDeadline", () => {
  const now = new Date("2026-09-08T10:00:00.000Z");

  it("accepts a future deadline", () => {
    const res = parseNewDeadline("2026-09-15T18:29:00.000Z", now);
    expect(res.error).toBeUndefined();
    expect(res.dueAt?.toISOString()).toBe("2026-09-15T18:29:00.000Z");
  });

  it("rejects a blank deadline", () => {
    expect(parseNewDeadline("", now).error).toBeTruthy();
    expect(parseNewDeadline(null, now).error).toBeTruthy();
    expect(parseNewDeadline("   ", now).error).toBeTruthy();
  });

  it("rejects an unparseable deadline", () => {
    expect(parseNewDeadline("next tuesday", now).error).toBeTruthy();
  });

  it("rejects a deadline in the past", () => {
    // Reopening to a past date deletes the marks and still leaves the card
    // closed, which reads as the reassignment having done nothing.
    expect(parseNewDeadline("2026-09-07T18:29:00.000Z", now).error).toBeTruthy();
  });

  it("rejects the current instant", () => {
    expect(parseNewDeadline(now.toISOString(), now).error).toBeTruthy();
  });
});
