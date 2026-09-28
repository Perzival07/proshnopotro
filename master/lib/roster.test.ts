import { describe, expect, it } from "vitest";
import { MAX_ROSTER, parseRoster } from "./roster";

describe("parseRoster", () => {
  it("lower-cases and de-duplicates emails", () => {
    expect(parseRoster({ students: ["B@x.in", "a@x.in", " b@x.in "] })).toEqual({ students: ["a@x.in", "b@x.in"], staff: [] });
  });
  it("accepts an empty roster", () => expect(parseRoster({ students: [] })).toEqual({ students: [], staff: [] }));
  it("reads owners and tutors, and never bills staff as students", () => {
    expect(
      parseRoster({
        students: ["s@x.in", "T@x.in"],
        staff: [
          { email: "t@x.in", role: "TUTOR" },
          { email: "o@x.in", role: "ADMIN" },
          { email: "o@x.in", role: "TUTOR" },
        ],
      })
    ).toEqual({ students: ["s@x.in"], staff: [{ email: "o@x.in", role: "ADMIN" }, { email: "t@x.in", role: "TUTOR" }] });
  });
  it("refuses anything that is not a list of emails and roles", () => {
    expect(parseRoster(null)).toHaveProperty("error");
    expect(parseRoster({ students: "a@x.in" })).toHaveProperty("error");
    expect(parseRoster({ students: ["a@x.in", 3] })).toHaveProperty("error");
    expect(parseRoster({ students: ["not-an-email"] })).toHaveProperty("error");
    expect(parseRoster({ students: [], staff: [{ email: "a@x.in", role: "STUDENT" }] })).toHaveProperty("error");
    expect(parseRoster({ students: [], staff: "a@x.in" })).toHaveProperty("error");
    expect(parseRoster({ students: new Array(MAX_ROSTER + 1).fill("a@x.in") })).toHaveProperty("error");
  });
});
