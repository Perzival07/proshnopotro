import { describe, it, expect } from "vitest";
import { isProctored, registerSwitch, warningMessage } from "./proctoring";

describe("registerSwitch", () => {
  it("counts the first departure as a warning without ending the attempt", () => {
    expect(registerSwitch(0)).toEqual({ count: 1, remaining: 1, shouldSubmit: false });
  });

  it("ends the attempt on the second", () => {
    expect(registerSwitch(1)).toEqual({ count: 2, remaining: 0, shouldSubmit: true });
  });

  it("keeps ending it past the limit, never going negative on remaining", () => {
    // A late event arriving after the auto-submit must not report -1 left.
    expect(registerSwitch(7)).toEqual({ count: 8, remaining: 0, shouldSubmit: true });
  });

  it("treats a nonsensical negative tally as zero", () => {
    expect(registerSwitch(-3).count).toBe(1);
  });
});

describe("warningMessage", () => {
  it("tells the student the single warning is all they get", () => {
    const msg = warningMessage(registerSwitch(0));
    expect(msg).toContain("only warning");
    expect(msg).toContain("leaving again will submit your test automatically");
  });

  it("says the clock kept running, since the warning interrupts a live paper", () => {
    expect(warningMessage(registerSwitch(0))).toContain("timer has kept running");
  });

  it("switches to the submitted wording once the limit is hit", () => {
    expect(warningMessage(registerSwitch(1))).toContain("submitted automatically");
    expect(warningMessage(registerSwitch(1))).not.toContain("warning");
  });
});

describe("isProctored", () => {
  it("is true only when the tutor left the guard on", () => {
    expect(isProctored({ test: { proctored: true } })).toBe(true);
    expect(isProctored({ test: { proctored: false } })).toBe(false);
  });

  it("is false when the flag is missing rather than assuming it is on", () => {
    expect(isProctored({ test: {} })).toBe(false);
    expect(isProctored({ test: { proctored: null } })).toBe(false);
  });
});
