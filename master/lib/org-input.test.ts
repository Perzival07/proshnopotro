import { describe, expect, it } from "vitest";
import { normalisePortalUrl, parseOrgForm, parsePaymentForm } from "./org-input";

const form = (fields: Record<string, string>) => ({ get: (k: string) => fields[k] ?? null });

const good = {
  slug: "classes-by-koustav",
  name: "Classes by Koustav",
  portalUrl: "https://koustav.example.in/some/path",
  pricePerStudentInr: "40",
  maxStudents: "",
};

describe("parseOrgForm", () => {
  it("accepts a complete organisation and keeps only the portal's origin", () => {
    expect(parseOrgForm(form(good))).toEqual({
      data: { slug: "classes-by-koustav", name: "Classes by Koustav", portalUrl: "https://koustav.example.in", pricePerStudentInr: 40, maxStudents: null, notes: "" },
    });
  });
  it("refuses a slug that is not a folder name", () => {
    for (const slug of ["", "Has Space", "-lead", "trail-", "a--b", "a_b"]) {
      expect(parseOrgForm(form({ ...good, slug }))).toHaveProperty("error");
    }
  });
  it("refuses plain http except on localhost", () => {
    expect(normalisePortalUrl("http://koustav.example.in")).toBeNull();
    expect(normalisePortalUrl("http://localhost:3000/x")).toBe("http://localhost:3000");
    expect(normalisePortalUrl("not a url")).toBeNull();
  });
  it("wants whole-rupee prices and a positive limit", () => {
    expect(parseOrgForm(form({ ...good, pricePerStudentInr: "12.5" }))).toHaveProperty("error");
    expect(parseOrgForm(form({ ...good, pricePerStudentInr: "-3" }))).toHaveProperty("error");
    expect(parseOrgForm(form({ ...good, maxStudents: "0" }))).toHaveProperty("error");
    expect(parseOrgForm(form({ ...good, maxStudents: "300" }))).toMatchObject({ data: { maxStudents: 300 } });
  });
});

describe("parsePaymentForm", () => {
  const today = "2026-09-27";
  it("accepts a payment and an optional new paid-up-to date", () => {
    expect(parsePaymentForm(form({ amountInr: "6000", receivedOn: "2026-09-26", reference: " UTR123 ", paidUpTo: "2026-10-31" }), today)).toEqual({
      data: { amountInr: 6000, receivedOn: "2026-09-26", reference: "UTR123", note: "", paidUpTo: "2026-10-31" },
    });
    expect(parsePaymentForm(form({ amountInr: "1", receivedOn: today }), today)).toMatchObject({ data: { paidUpTo: null } });
  });
  it("refuses a zero amount, a future date or a bad date", () => {
    expect(parsePaymentForm(form({ amountInr: "0", receivedOn: today }), today)).toHaveProperty("error");
    expect(parsePaymentForm(form({ amountInr: "10", receivedOn: "2026-09-28" }), today)).toHaveProperty("error");
    expect(parsePaymentForm(form({ amountInr: "10", receivedOn: today, paidUpTo: "2026-02-30x" }), today)).toHaveProperty("error");
  });
});
