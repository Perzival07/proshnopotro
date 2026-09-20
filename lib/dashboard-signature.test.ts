import { describe, it, expect } from "vitest";
import { dashboardSignature, type SignatureRow } from "./dashboard-signature";

const row = (over: Partial<SignatureRow> = {}): SignatureRow => ({
  id: "a1",
  status: "ASSIGNED",
  active: true,
  dueAt: "2026-09-25T00:00:00Z",
  hasResult: false,
  ...over,
});

describe("dashboardSignature", () => {
  it("is the same for the same dashboard, in any order", () => {
    expect(dashboardSignature([row({ id: "a" }), row({ id: "b" })])).toBe(dashboardSignature([row({ id: "b" }), row({ id: "a" })]));
  });
  it("changes when a test is assigned", () => {
    expect(dashboardSignature([row()])).not.toBe(dashboardSignature([row(), row({ id: "a2" })]));
  });
  it.each([
    ["turned off", { active: false }],
    ["deadline moved", { dueAt: "2026-09-30T00:00:00Z" }],
    ["opening scheduled", { opensAt: "2026-09-24T00:00:00Z" }],
    ["submitted", { status: "SUBMITTED" }],
    ["result recorded", { hasResult: true }],
    ["copy returned", { returnedAt: "2026-09-26T00:00:00Z" }],
    ["results released", { resultsReleasedAt: "2026-09-26T00:00:00Z" }],
  ])("changes when a test is %s", (_, change) => {
    expect(dashboardSignature([row(change as Partial<SignatureRow>)])).not.toBe(dashboardSignature([row()]));
  });
});
