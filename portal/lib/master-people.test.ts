import { describe, expect, it } from "vitest";
import { parsePeopleCommand } from "./master-people";

describe("parsePeopleCommand", () => {
  it("reads an added student, lower-casing the email", () => {
    expect(
      parsePeopleCommand({ action: "add", role: "STUDENT", email: " Riya@Mail.com ", name: "Riya", phone: "98", className: "Class 10" })
    ).toEqual({ action: "add", role: "STUDENT", email: "riya@mail.com", name: "Riya", phone: "98", className: "Class 10" });
  });

  it("needs a name for a student but not for staff", () => {
    expect(parsePeopleCommand({ action: "add", role: "STUDENT", email: "a@b.co" })).toEqual({ error: "A student needs a name." });
    expect(parsePeopleCommand({ action: "add", role: "ADMIN", email: "a@b.co" })).toMatchObject({ action: "add", role: "ADMIN", name: "" });
  });

  it("refuses unknown roles, classes, actions and bad emails", () => {
    expect(parsePeopleCommand({ action: "add", role: "GOD", email: "a@b.co", name: "x" })).toEqual({ error: "Unknown role." });
    expect(parsePeopleCommand({ action: "add", role: "STUDENT", email: "a@b.co", name: "x", className: "Year 3" })).toEqual({
      error: "Not one of the portal's classes.",
    });
    expect(parsePeopleCommand({ action: "drop", email: "a@b.co" })).toEqual({ error: "Unknown action." });
    expect(parsePeopleCommand({ action: "remove", email: "nope" })).toEqual({ error: "Not an email address." });
    expect(parsePeopleCommand(null)).toEqual({ error: "Not an email address." });
  });

  it("reads remove and setRole", () => {
    expect(parsePeopleCommand({ action: "remove", email: "a@b.co" })).toEqual({ action: "remove", email: "a@b.co" });
    expect(parsePeopleCommand({ action: "setRole", email: "a@b.co", role: "TUTOR" })).toEqual({ action: "setRole", email: "a@b.co", role: "TUTOR" });
  });
});
