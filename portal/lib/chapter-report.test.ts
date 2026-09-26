import { describe, it, expect } from "vitest";
import { chapterBreakdown } from "./chapter-report";
import { markPaper, SCHEME_PRESETS, type MarkableSection } from "./marking";

const MAIN = SCHEME_PRESETS.JEE_MAIN.scheme;
const q = (id: string, answer: string, choiceGroup: string | null = null) => ({
  id,
  key: { type: "SINGLE" as const, options: [answer] },
  choiceGroup,
});

describe("chapterBreakdown", () => {
  it("adds marks up by chapter, untagged questions on their own line", () => {
    const sections: MarkableSection[] = [{ id: "s", questions: [q("a", "A"), q("b", "A"), q("c", "A")] }];
    const marked = markPaper(sections, { a: "A", b: "B", c: "A" }, MAIN);
    const lines = chapterBreakdown(sections, marked, { a: "ch1", b: "ch1", c: null }, MAIN);
    expect(lines).toEqual([
      { chapterId: "ch1", questions: 2, scored: 3, max: 8 },
      { chapterId: null, questions: 1, scored: 4, max: 4 },
    ]);
    expect(lines.reduce((n, l) => n + l.scored, 0)).toBe(marked.score);
  });

  it("counts an internal choice once, under the side that counted", () => {
    const sections: MarkableSection[] = [{ id: "s", questions: [q("x", "A", "g"), q("y", "A", "g")] }];
    const marked = markPaper(sections, { y: "A" }, MAIN);
    expect(chapterBreakdown(sections, marked, { x: "ch1", y: "ch2" }, MAIN)).toEqual([
      { chapterId: "ch2", questions: 1, scored: 4, max: 4 },
    ]);
  });

  it("leaves out questions over an attempt limit", () => {
    const sections: MarkableSection[] = [{ id: "s", attemptLimit: 1, questions: [q("a", "A"), q("b", "A")] }];
    const marked = markPaper(sections, { a: "A", b: "A" }, MAIN);
    expect(chapterBreakdown(sections, marked, { a: "ch1", b: "ch2" }, MAIN)).toEqual([
      { chapterId: "ch1", questions: 1, scored: 4, max: 4 },
    ]);
  });
});

describe("chapterBreakdown with a part-used attempt limit", () => {
  it("counts exactly N questions, so the chapters add up to the paper's maximum", () => {
    const sections: MarkableSection[] = [{ id: "s", attemptLimit: 2, questions: [q("a", "A"), q("b", "A"), q("c", "A")] }];
    const marked = markPaper(sections, { b: "A" }, MAIN);
    const lines = chapterBreakdown(sections, marked, { a: "ch1", b: "ch2", c: "ch3" }, MAIN);
    expect(lines.reduce((n, l) => n + l.max, 0)).toBe(marked.maxScore);
    expect(lines.map((l) => l.chapterId)).toEqual(["ch2", "ch1"]);
  });
});
