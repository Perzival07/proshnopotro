import { describe, it, expect } from "vitest";
import { parseScoreString } from "./score";

describe("parseScoreString", () => {
  it("reads a bare number and applies the default maximum", () => {
    expect(parseScoreString("45", 50)).toEqual({ score: 45, maxScore: 50 });
  });

  it("reads a decimal", () => {
    expect(parseScoreString("45.5", 50)).toEqual({ score: 45.5, maxScore: 50 });
  });

  it("reads Google Forms' own 'x / y' output", () => {
    expect(parseScoreString("45 / 50", 100)).toEqual({ score: 45, maxScore: 50 });
    expect(parseScoreString("45.5/50", 100)).toEqual({ score: 45.5, maxScore: 50 });
    expect(parseScoreString("45 of 50", 100)).toEqual({ score: 45, maxScore: 50 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseScoreString("  45 / 50  ", 100)).toEqual({ score: 45, maxScore: 50 });
  });

  it("rejects a malformed number instead of silently truncating it", () => {
    // Regression: /^[\d.]+$/ matched "1.2.3" and parseFloat returned 1.2,
    // writing a wrong grade to a student record with no error.
    expect(parseScoreString("1.2.3", 50)).toEqual({ score: null, maxScore: null });
  });

  it.each([".", "", "abc", "-5", "4 5", "45%", "N/A"])(
    "rejects %j",
    (input) => {
      expect(parseScoreString(input, 50)).toEqual({ score: null, maxScore: null });
    }
  );

  it("rejects a zero maximum rather than dividing by it later", () => {
    expect(parseScoreString("45/0", 50)).toEqual({ score: null, maxScore: null });
  });

  it("allows a score above the maximum (callers validate that separately)", () => {
    expect(parseScoreString("99/50", 50)).toEqual({ score: 99, maxScore: 50 });
  });

  it("handles a zero score", () => {
    expect(parseScoreString("0", 50)).toEqual({ score: 0, maxScore: 50 });
    expect(parseScoreString("0/50", 100)).toEqual({ score: 0, maxScore: 50 });
  });
});
