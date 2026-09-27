import { describe, expect, it } from "vitest";
import { MAX_ROSTER, parseRoster } from "./roster";

describe("parseRoster", () => {
  it("lower-cases and de-duplicates emails", () => {
    expect(parseRoster({ students: ["B@x.in", "a@x.in", " b@x.in "] })).toEqual({ emails: ["a@x.in", "b@x.in"] });
  });
  it("accepts an empty roster", () => expect(parseRoster({ students: [] })).toEqual({ emails: [] }));
  it("refuses anything that is not a list of emails", () => {
    expect(parseRoster(null)).toHaveProperty("error");
    expect(parseRoster({ students: "a@x.in" })).toHaveProperty("error");
    expect(parseRoster({ students: ["a@x.in", 3] })).toHaveProperty("error");
    expect(parseRoster({ students: ["not-an-email"] })).toHaveProperty("error");
    expect(parseRoster({ students: new Array(MAX_ROSTER + 1).fill("a@x.in") })).toHaveProperty("error");
  });
});
