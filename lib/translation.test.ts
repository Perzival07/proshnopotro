import { describe, it, expect } from "vitest";
import { matchTranslation, parseTranslation, type OriginalQuestion } from "./translation";
import { parseQuestionPaper } from "./question-import";

const original: OriginalQuestion[] = [
  { id: "q1", optionIds: ["A", "B", "C", "D"], columnIds: [], passageId: null },
  { id: "q2", optionIds: [], columnIds: [], passageId: "p1" },
  { id: "q3", optionIds: ["A", "B"], columnIds: [], passageId: "p1" },
];

const hindi = (...lines: string[]) => parseQuestionPaper(lines.join("\n"), { answersOptional: true });

describe("matchTranslation", () => {
  it("pairs questions and passages by position, without answers", () => {
    const m = matchTranslation(
      original,
      hindi(
        "प्रश्न 1. एक गेंद ऊपर फेंकी जाती है",
        "(A) क (B) ख (C) ग (D) घ",
        "अनुच्छेद:",
        "एक गैस फैलती है।",
        "2. कार्य ज्ञात करें",
        "3. ऊष्मा?",
        "(A) हाँ",
        "(B) नहीं",
        "हल: क्योंकि"
      )
    );
    expect(m.errors).toEqual([]);
    expect(m.questions.get("q1")?.options.map((o) => o.text)).toEqual(["क", "ख", "ग", "घ"]);
    expect(m.questions.get("q2")?.stem).toBe("कार्य ज्ञात करें");
    expect(m.questions.get("q3")?.solution).toBe("क्योंकि");
    expect(m.passages.get("p1")).toBe("एक गैस फैलती है।");
  });

  it("refuses a translation with a different number of questions", () => {
    const m = matchTranslation(original, hindi("1. a", "(A) x", "(B) y"));
    expect(m.errors[0]).toContain("3 questions, but the translation has 1");
  });

  it("names a question whose options differ", () => {
    const m = matchTranslation(
      original,
      hindi("1. a", "(A) x", "(B) y", "(C) z", "अनुच्छेद:", "p", "2. b", "3. c", "(A) x", "(B) y")
    );
    expect(m.errors[0]).toMatch(/^Question 1: the paper has options A, B, C, D, the translation has options A, B, C/);
  });

  it("names a question whose passage differs", () => {
    const m = matchTranslation(original, hindi("1. a", "(A) w (B) x (C) y (D) z", "2. b", "3. c", "(A) x", "(B) y"));
    expect(m.errors[0]).toContain("Question 2 belongs to a passage in the paper");
  });
});

describe("parseTranslation", () => {
  it("reads what was stored", () =>
    expect(parseTranslation({ stem: "क", options: [{ id: "A", text: "ख" }], columns: [], solution: null })).toEqual({
      stem: "क",
      options: [{ id: "A", text: "ख" }],
      columns: [],
      solution: null,
    }));
  it("ignores anything unreadable", () => {
    expect(parseTranslation(null)).toBeNull();
    expect(parseTranslation({ options: [] })).toBeNull();
  });
});
