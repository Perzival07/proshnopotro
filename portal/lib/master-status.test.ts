import { describe, expect, it } from "vitest";
import { parseMasterStatus } from "./master-status";

const reply = {
  status: "ACTIVE",
  billing: {
    studentCount: 120,
    maxStudents: null,
    pricePerStudentInr: 40,
    monthlyAmountInr: 4800,
    paidUpTo: "2026-09-30",
    billingStatus: "PAID",
    countedAt: "2026-09-27T03:00:00.000Z",
    payments: [{ receivedOn: "2026-09-01", amountInr: 4800, reference: "UTR1" }],
    instructions: "Pay by UPI.",
  },
};

describe("parseMasterStatus", () => {
  it("reads a well-formed reply", () => {
    expect(parseMasterStatus(reply)).toEqual(reply);
    expect(parseMasterStatus({ ...reply, status: "SUSPENDED" })?.status).toBe("SUSPENDED");
  });
  it("refuses an unknown status or broken billing", () => {
    expect(parseMasterStatus(null)).toBeNull();
    expect(parseMasterStatus({ ...reply, status: "PAUSED" })).toBeNull();
    expect(parseMasterStatus({ ...reply, billing: { ...reply.billing, studentCount: "120" } })).toBeNull();
    expect(parseMasterStatus({ ...reply, billing: { ...reply.billing, paidUpTo: "soon" } })).toBeNull();
  });
  it("drops a malformed payment rather than the whole reply", () => {
    const withBad = { ...reply, billing: { ...reply.billing, payments: [...reply.billing.payments, { amountInr: 1 }] } };
    expect(parseMasterStatus(withBad)?.billing.payments).toHaveLength(1);
  });
});
