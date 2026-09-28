import { describe, expect, it } from "vitest";
import { normalisePortalUrl, parseOrgForm, parsePaymentForm, parsePersonForm, parseSettingsForm } from "./org-input";

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
      data: {
        slug: "classes-by-koustav",
        name: "Classes by Koustav",
        portalUrl: "https://koustav.example.in",
        pricePerStudentInr: 40,
        maxStudents: null,
        notes: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        address: "",
      },
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

describe("organisation contact details", () => {
  it("lower-cases the organisation's email and refuses a bad one", () => {
    expect(parseOrgForm(form({ ...good, contactEmail: " Office@Koustav.IN " }))).toMatchObject({ data: { contactEmail: "office@koustav.in" } });
    expect(parseOrgForm(form({ ...good, contactEmail: "office" }))).toHaveProperty("error");
  });
});

describe("parsePersonForm", () => {
  const person = { role: "STUDENT", email: "Riya@Mail.com", name: "Riya", phone: "", className: "Class 10" };
  it("builds the portal command", () => {
    expect(parsePersonForm(form(person))).toEqual({
      data: { action: "add", role: "STUDENT", email: "riya@mail.com", name: "Riya", phone: null, className: "Class 10" },
    });
  });
  it("needs a name for students only, a known role and a listed class", () => {
    expect(parsePersonForm(form({ ...person, name: "" }))).toHaveProperty("error");
    expect(parsePersonForm(form({ ...person, role: "ADMIN", name: "" }))).toHaveProperty("data");
    expect(parsePersonForm(form({ ...person, role: "OWNER" }))).toHaveProperty("error");
    expect(parsePersonForm(form({ ...person, className: "Year 5" }))).toHaveProperty("error");
    expect(parsePersonForm(form({ ...person, email: "riya" }))).toHaveProperty("error");
  });
});

describe("parseSettingsForm", () => {
  it("wants a whole-rupee default price", () => {
    expect(parseSettingsForm(form({ defaultPricePerStudentInr: "35", paymentInstructions: " UPI " }))).toEqual({
      data: { defaultPricePerStudentInr: 35, paymentInstructions: "UPI" },
    });
    expect(parseSettingsForm(form({ defaultPricePerStudentInr: "3.5" }))).toHaveProperty("error");
  });
});
