import { describe, expect, it } from "vitest";
import { billingStatus, endOfMonth, fromDateKey, monthRange, monthlyAmount, rupees, suggestPaidUpTo, todayIst } from "./billing";

describe("todayIst", () => {
  it("is already tomorrow in India late in the UTC evening", () => {
    expect(todayIst(new Date("2026-09-27T19:00:00Z"))).toBe("2026-09-28");
    expect(todayIst(new Date("2026-09-27T18:00:00Z"))).toBe("2026-09-27");
  });
});

describe("billingStatus", () => {
  const createdOn = "2026-01-01";
  it("is paid through the paid-up-to day itself", () => {
    expect(billingStatus({ paidUpTo: "2026-09-30", createdOn }, "2026-09-30")).toBe("PAID");
  });
  it("is due for the grace period, then overdue", () => {
    expect(billingStatus({ paidUpTo: "2026-09-30", createdOn }, "2026-10-01")).toBe("DUE");
    expect(billingStatus({ paidUpTo: "2026-09-30", createdOn }, "2026-10-15")).toBe("DUE");
    expect(billingStatus({ paidUpTo: "2026-09-30", createdOn }, "2026-10-16")).toBe("OVERDUE");
  });
  it("counts a never-paid organisation from when it was added", () => {
    expect(billingStatus({ paidUpTo: null, createdOn: "2026-09-20" }, "2026-09-27")).toBe("DUE");
    expect(billingStatus({ paidUpTo: null, createdOn: "2026-08-01" }, "2026-09-27")).toBe("OVERDUE");
  });
});

describe("amounts and months", () => {
  it("bills every enrolled student", () => expect(monthlyAmount(120, 50)).toBe(6000));
  it("formats rupees the Indian way", () => expect(rupees(1234567)).toBe("₹12,34,567"));
  it("finds the end of a month, leap years included", () => {
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-12-31")).toBe("2026-12-31");
  });
  it("suggests one more month of cover", () => {
    expect(suggestPaidUpTo(null, "2026-09-05")).toBe("2026-09-30");
    expect(suggestPaidUpTo("2026-09-30", "2026-10-02")).toBe("2026-10-31");
    expect(suggestPaidUpTo("2026-12-31", "2026-12-20")).toBe("2027-01-31");
  });
  it("accepts only real months and days", () => {
    expect(monthRange("2026-02")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
    expect(monthRange("2026-13")).toBeNull();
    expect(() => fromDateKey("2026-9-1")).toThrow();
    expect(() => fromDateKey("2026-02-30")).toThrow();
  });
});
