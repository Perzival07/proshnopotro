import { describe, it, expect } from "vitest";
import {
  MAX_TAB_SWITCHES,
  isProctored,
  registerSwitch,
  warningMessage,
} from "./proctoring";

describe("registerSwitch", () => {
  it("counts the first departure without ending the attempt", () => {
    expect(registerSwitch(0)).toEqual({ count: 1, remaining: 2, shouldSubmit: false });
  });

  it("still forgives the second", () => {
    expect(registerSwitch(1)).toEqual({ count: 2, remaining: 1, shouldSubmit: false });
  });

  it("ends the attempt on the third", () => {
    expect(registerSwitch(2)).toEqual({ count: 3, remaining: 0, shouldSubmit: true });
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
  it("counts the warning out of the limit", () => {
    const msg = warningMessage(registerSwitch(0));
    expect(msg).toContain(`warning 1 of ${MAX_TAB_SWITCHES}`);
  });

  it("says 'once more' rather than '1 more times' on the last chance", () => {
    expect(warningMessage(registerSwitch(1))).toContain("once more");
  });

  it("switches to the submitted wording once the limit is hit", () => {
    expect(warningMessage(registerSwitch(2))).toContain("submitted automatically");
    expect(warningMessage(registerSwitch(2))).not.toContain("warning");
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
