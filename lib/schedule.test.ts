import { describe, it, expect } from "vitest";
import { isNotYetOpen, scheduleError } from "./schedule";
import { deriveCardStatus } from "./assignment-status";

const now = new Date("2026-09-20T10:00:00Z");

describe("isNotYetOpen", () => {
  it("is closed until the opening time", () => {
    expect(isNotYetOpen({ opensAt: "2026-09-20T11:00:00Z" }, now)).toBe(true);
    expect(isNotYetOpen({ opensAt: "2026-09-20T09:00:00Z" }, now)).toBe(false);
  });
  it("is open with no opening time", () => {
    expect(isNotYetOpen({ opensAt: null }, now)).toBe(false);
    expect(isNotYetOpen({}, now)).toBe(false);
  });
});

describe("scheduleError", () => {
  const due = new Date("2026-09-21T10:00:00Z");
  it("needs the opening before the deadline", () => {
    expect(scheduleError(new Date("2026-09-22T00:00:00Z"), due)).toMatch(/open before/);
    expect(scheduleError(due, due)).toMatch(/open before/);
    expect(scheduleError(new Date("2026-09-20T00:00:00Z"), due)).toBeNull();
    expect(scheduleError(null, due)).toBeNull();
  });
});

describe("deriveCardStatus with a schedule", () => {
  const base = { status: "ASSIGNED" as const, dueAt: "2026-09-25T00:00:00Z", test: { active: true } };
  it("shows UPCOMING before the test opens, then AVAILABLE", () => {
    expect(deriveCardStatus({ ...base, opensAt: "2026-09-21T00:00:00Z" }, now)).toBe("UPCOMING");
    expect(deriveCardStatus({ ...base, opensAt: "2026-09-20T09:00:00Z" }, now)).toBe("AVAILABLE");
  });
  it("still closes after the deadline and still shows a submission", () => {
    expect(deriveCardStatus({ ...base, opensAt: "2026-09-01T00:00:00Z", dueAt: "2026-09-10T00:00:00Z" }, now)).toBe("CLOSED");
    expect(deriveCardStatus({ ...base, status: "SUBMITTED", opensAt: "2026-09-21T00:00:00Z" }, now)).toBe("SUBMITTED");
  });
});
