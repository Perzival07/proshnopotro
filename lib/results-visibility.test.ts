import { describe, it, expect } from "vitest";
import { resultsVisible } from "./results-visibility";

const due = { dueAt: "2026-09-20T12:00:00Z" };
const before = new Date("2026-09-20T11:00:00Z");
const after = new Date("2026-09-20T13:00:00Z");

describe("resultsVisible", () => {
  it("shows instant results at once", () =>
    expect(resultsVisible({ resultRelease: "INSTANT", resultsReleasedAt: null }, due, before)).toBe(true));
  it("waits for the tutor on release", () => {
    expect(resultsVisible({ resultRelease: "ON_RELEASE", resultsReleasedAt: null }, due, after)).toBe(false);
    expect(resultsVisible({ resultRelease: "ON_RELEASE", resultsReleasedAt: before }, due, before)).toBe(true);
  });
  it("waits for the deadline, unless released earlier", () => {
    expect(resultsVisible({ resultRelease: "AFTER_DEADLINE", resultsReleasedAt: null }, due, before)).toBe(false);
    expect(resultsVisible({ resultRelease: "AFTER_DEADLINE", resultsReleasedAt: null }, due, after)).toBe(true);
    expect(resultsVisible({ resultRelease: "AFTER_DEADLINE", resultsReleasedAt: before }, due, before)).toBe(true);
  });
});
