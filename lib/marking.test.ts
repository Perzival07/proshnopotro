import { describe, it, expect } from "vitest";
import {
  isAttempted,
  markPaper,
  markQuestion,
  parseNumericAnswer,
  SCHEME_PRESETS,
  type MarkableQuestion,
} from "./marking";

const MAIN = SCHEME_PRESETS.JEE_MAIN.scheme;
const ADV = SCHEME_PRESETS.JEE_ADVANCED.scheme;
const BOARDS = SCHEME_PRESETS.NO_NEGATIVE.scheme;

const single: MarkableQuestion = { id: "s", key: { type: "SINGLE", options: ["B"] } };
const multi = (options: string[]): MarkableQuestion => ({
  id: "m",
  key: { type: "MULTIPLE", options },
});
const integer: MarkableQuestion = { id: "i", key: { type: "INTEGER", values: [7] } };
const decimal: MarkableQuestion = { id: "d", key: { type: "DECIMAL", min: 2.45, max: 2.55 } };

describe("parseNumericAnswer", () => {
  it.each([
    ["5", 5],
    ["-3", -3],
    ["2.5", 2.5],
    [".5", 0.5],
    ["2.50", 2.5],
    [" 7 ", 7],
  ])("reads %j", (raw, n) => expect(parseNumericAnswer(raw)).toBe(n));

  it.each(["", "abc", "1e3", "5,5", "1.2.3", "--1", "-"])("refuses %j", (raw) =>
    expect(parseNumericAnswer(raw)).toBeNull()
  );
});

describe("isAttempted", () => {
  it("treats empty answers as unattempted", () => {
    expect(isAttempted(null)).toBe(false);
    expect(isAttempted(undefined)).toBe(false);
    expect(isAttempted("")).toBe(false);
    expect(isAttempted("  ")).toBe(false);
    expect(isAttempted([])).toBe(false);
  });
  it("treats anything entered as attempted", () => {
    expect(isAttempted("A")).toBe(true);
    expect(isAttempted(["A"])).toBe(true);
    expect(isAttempted("0")).toBe(true);
  });
});

describe("SINGLE (JEE Main +4/-1)", () => {
  it("gives +4 for the right option", () =>
    expect(markQuestion(single, "B", MAIN)).toEqual({ status: "CORRECT", marks: 4 }));
  it("gives -1 for a wrong option", () =>
    expect(markQuestion(single, "A", MAIN)).toEqual({ status: "WRONG", marks: -1 }));
  it("gives 0 when unattempted", () =>
    expect(markQuestion(single, null, MAIN)).toEqual({ status: "UNATTEMPTED", marks: 0 }));
  it("accepts any option a revised key allows", () => {
    const revised: MarkableQuestion = { id: "s", key: { type: "SINGLE", options: ["B", "C"] } };
    expect(markQuestion(revised, "C", MAIN).status).toBe("CORRECT");
  });
  it("treats two options picked as wrong", () =>
    expect(markQuestion(single, ["B", "C"], MAIN).status).toBe("WRONG"));
});

describe("MULTIPLE with JEE Advanced partial marking", () => {
  const four = multi(["A", "B", "C", "D"]);
  const three = multi(["A", "B", "C"]);
  const two = multi(["A", "B"]);

  it("gives +4 when exactly the right options are picked", () => {
    expect(markQuestion(four, ["A", "B", "C", "D"], ADV)).toEqual({ status: "CORRECT", marks: 4 });
    expect(markQuestion(two, ["B", "A"], ADV)).toEqual({ status: "CORRECT", marks: 4 });
  });
  it("gives +3 for three of four right options", () =>
    expect(markQuestion(four, ["A", "B", "C"], ADV)).toEqual({ status: "PARTIAL", marks: 3 }));
  it("gives +2 for two of three right options", () =>
    expect(markQuestion(three, ["A", "C"], ADV)).toEqual({ status: "PARTIAL", marks: 2 }));
  it("gives +1 for one of two right options", () =>
    expect(markQuestion(two, ["B"], ADV)).toEqual({ status: "PARTIAL", marks: 1 }));
  it("gives -2 when any wrong option is picked", () => {
    expect(markQuestion(three, ["A", "B", "C", "D"], ADV)).toEqual({ status: "WRONG", marks: -2 });
    expect(markQuestion(two, ["A", "C"], ADV)).toEqual({ status: "WRONG", marks: -2 });
  });
  it("gives 0 when unattempted", () =>
    expect(markQuestion(four, [], ADV)).toEqual({ status: "UNATTEMPTED", marks: 0 }));
  it("treats a partial answer as wrong without partial marking", () =>
    expect(markQuestion(three, ["A"], MAIN)).toEqual({ status: "WRONG", marks: -1 }));
});

describe("INTEGER", () => {
  it("gives full marks for the right number", () =>
    expect(markQuestion(integer, "7", ADV)).toEqual({ status: "CORRECT", marks: 4 }));
  it("accepts 7.0 as the integer 7", () =>
    expect(markQuestion(integer, "7.0", ADV).status).toBe("CORRECT"));
  it("marks a wrong or unreadable number wrong", () => {
    expect(markQuestion(integer, "8", MAIN)).toEqual({ status: "WRONG", marks: -1 });
    expect(markQuestion(integer, "7.5", MAIN).status).toBe("WRONG");
    expect(markQuestion(integer, "seven", MAIN).status).toBe("WRONG");
  });
  it("uses no negative marks under JEE Advanced's integer rule", () =>
    expect(markQuestion(integer, "8", ADV)).toEqual({ status: "WRONG", marks: 0 }));
});

describe("DECIMAL", () => {
  it("accepts anything inside the range, ends included", () => {
    expect(markQuestion(decimal, "2.50", ADV).status).toBe("CORRECT");
    expect(markQuestion(decimal, "2.45", ADV).status).toBe("CORRECT");
    expect(markQuestion(decimal, "2.55", ADV).status).toBe("CORRECT");
  });
  it("refuses anything outside it", () => {
    expect(markQuestion(decimal, "2.44", ADV).status).toBe("WRONG");
    expect(markQuestion(decimal, "2.56", ADV).status).toBe("WRONG");
  });
});

describe("per-question rules and bonus questions", () => {
  it("lets one question carry its own marks", () => {
    const heavy: MarkableQuestion = { ...single, rule: { correct: 6 } };
    expect(markQuestion(heavy, "B", MAIN).marks).toBe(6);
    expect(markQuestion(heavy, "A", MAIN).marks).toBe(-1);
  });
  it("gives a dropped question full marks to anyone who attempted it", () => {
    const dropped: MarkableQuestion = { ...single, bonus: true };
    expect(markQuestion(dropped, "A", MAIN)).toEqual({ status: "CORRECT", marks: 4 });
    expect(markQuestion(dropped, null, MAIN)).toEqual({ status: "UNATTEMPTED", marks: 0 });
  });
});

describe("markPaper", () => {
  const q = (id: string, answer: string): MarkableQuestion => ({
    id,
    key: { type: "SINGLE", options: [answer] },
  });

  it("totals sections and the paper", () => {
    const result = markPaper(
      [
        { id: "phy", questions: [q("p1", "A"), q("p2", "B")] },
        { id: "chem", questions: [q("c1", "C")] },
      ],
      { p1: "A", p2: "C", c1: "C" },
      MAIN
    );
    expect(result.sections.map((s) => s.score)).toEqual([3, 4]);
    expect(result.score).toBe(7);
    expect(result.maxScore).toBe(12);
  });

  it("counts only the first N attempted under an attempt limit", () => {
    const result = markPaper(
      [{ id: "b", attemptLimit: 2, questions: [q("1", "A"), q("2", "A"), q("3", "A")] }],
      { "1": "A", "2": "B", "3": "A" },
      MAIN
    );
    const marks = result.sections[0].questions;
    expect(marks["1"].status).toBe("CORRECT");
    expect(marks["2"].status).toBe("WRONG");
    expect(marks["3"]).toEqual({ status: "NOT_COUNTED", marks: 0 });
    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(8);
  });

  it("skips unattempted questions when counting towards the limit", () => {
    const result = markPaper(
      [{ id: "b", attemptLimit: 1, questions: [q("1", "A"), q("2", "A")] }],
      { "2": "A" },
      MAIN
    );
    expect(result.sections[0].questions["2"].status).toBe("CORRECT");
  });

  it("lets a section use its own scheme", () => {
    const result = markPaper(
      [
        { id: "main", questions: [q("1", "A")] },
        { id: "boards", scheme: BOARDS, questions: [q("2", "A")] },
      ],
      { "1": "B", "2": "B" },
      MAIN
    );
    expect(result.sections.map((s) => s.score)).toEqual([-1, 0]);
  });
});
