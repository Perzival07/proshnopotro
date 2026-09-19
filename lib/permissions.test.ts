import { describe, it, expect } from "vitest";
import { canAccessStudent, homeFor } from "./permissions";

describe("canAccessStudent", () => {
  it("lets the owner reach every student", () => expect(canAccessStudent(null, "anyone@example.com")).toBe(true));
  it("limits a tutor to their own students, ignoring case", () => {
    const scope = ["asha@example.com", "ravi@example.com"];
    expect(canAccessStudent(scope, "Asha@Example.com")).toBe(true);
    expect(canAccessStudent(scope, "meera@example.com")).toBe(false);
  });
  it("gives a tutor with no classrooms nobody", () => expect(canAccessStudent([], "asha@example.com")).toBe(false));
});

describe("homeFor", () => {
  it("sends each role to its own start", () => {
    expect(homeFor("ADMIN")).toBe("/admin/tests");
    expect(homeFor("TUTOR")).toBe("/admin/marking");
    expect(homeFor("STUDENT")).toBe("/");
  });
});
