import { describe, it, expect } from "vitest";
import {
  CLASS_OPTIONS,
  isValidClass,
  isValidEmail,
  validateStudent,
} from "./students";

describe("CLASS_OPTIONS", () => {
  it("offers plain Class 11 and Class 12 alongside the Science streams", () => {
    expect(CLASS_OPTIONS).toContain("Class 11");
    expect(CLASS_OPTIONS).toContain("Class 12");
    expect(CLASS_OPTIONS).toContain("Class 11 - Science");
    expect(CLASS_OPTIONS).toContain("Class 12 - Science");
  });

  it("has no duplicates, which would render as two identical options", () => {
    expect(new Set(CLASS_OPTIONS).size).toBe(CLASS_OPTIONS.length);
  });
});

describe("isValidClass", () => {
  it("accepts a listed class and rejects a near-miss", () => {
    expect(isValidClass("Class 12")).toBe(true);
    expect(isValidClass("class 12")).toBe(false);
    expect(isValidClass("Class 13")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("rahul@gmail.com")).toBe(true);
    expect(isValidEmail("  rahul@gmail.com  ")).toBe(true);
  });
  it("rejects obvious typos", () => {
    expect(isValidEmail("rahul@gmail")).toBe(false);
    expect(isValidEmail("rahulgmail.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("validateStudent", () => {
  const base = { name: "Rahul Sharma", email: "rahul@gmail.com" };

  it("lower-cases the email, since assignments are matched by that string", () => {
    const res = validateStudent({ ...base, email: "  Rahul@GMAIL.com " });
    expect(res.ok && res.value.email).toBe("rahul@gmail.com");
  });

  it("trims the name", () => {
    const res = validateStudent({ ...base, name: "  Rahul Sharma  " });
    expect(res.ok && res.value.name).toBe("Rahul Sharma");
  });

  it("stores a blank phone or class as null, not an empty string", () => {
    const res = validateStudent({ ...base, phone: "   ", className: "" });
    expect(res.ok && res.value.phone).toBeNull();
    expect(res.ok && res.value.className).toBeNull();
  });

  it("keeps a supplied phone and class", () => {
    const res = validateStudent({ ...base, phone: " +91 98765 43210 ", className: "Class 12" });
    expect(res.ok && res.value.phone).toBe("+91 98765 43210");
    expect(res.ok && res.value.className).toBe("Class 12");
  });

  it("requires a name", () => {
    const res = validateStudent({ ...base, name: "  " });
    expect(res.ok).toBe(false);
  });

  it("requires an email and rejects a malformed one", () => {
    expect(validateStudent({ ...base, email: "" }).ok).toBe(false);
    const bad = validateStudent({ ...base, email: "rahul@gmail" });
    expect(bad.ok).toBe(false);
    // The message quotes what was typed, so the tutor can see the typo.
    expect(!bad.ok && bad.error).toContain("rahul@gmail");
  });

  it("rejects a class outside the list", () => {
    expect(validateStudent({ ...base, className: "Class 13" }).ok).toBe(false);
  });
});
