import { describe, it, expect } from "vitest";
import { chapterVerdict, formatDuration, standing, summarizeAttempt } from "./analytics";
import { markPaper, SCHEME_PRESETS, type MarkableSection } from "./marking";

const MAIN = SCHEME_PRESETS.JEE_MAIN.scheme;
const q = (id: string) => ({ id, key: { type: "SINGLE" as const, options: ["A"] } });

describe("summarizeAttempt", () => {
  it("counts right, wrong and skipped, accuracy and negative marks", () => {
    const sections: MarkableSection[] = [{ id: "s", questions: [q("a"), q("b"), q("c"), q("d")] }];
    const s = summarizeAttempt(markPaper(sections, { a: "A", b: "B", c: "C" }, MAIN));
    expect(s).toEqual({ attempted: 3, correct: 1, partial: 0, wrong: 2, unattempted: 1, accuracy: 1 / 3, negativeLost: 2 });
  });
  it("has no accuracy with nothing attempted", () => {
    const s = summarizeAttempt(markPaper([{ id: "s", questions: [q("a")] }], {}, MAIN));
    expect(s.accuracy).toBeNull();
  });
});

describe("standing", () => {
  it("ranks with ties sharing a place, and gives an NTA-style percentile", () => {
    const scores = [80, 72, 72, 60, 40];
    expect(standing(scores, 80)).toEqual({ rank: 1, of: 5, percentile: 100 });
    expect(standing(scores, 72)).toEqual({ rank: 2, of: 5, percentile: 80 });
    expect(standing(scores, 40)).toEqual({ rank: 5, of: 5, percentile: 20 });
  });
  it("has nothing to say with no scores", () => expect(standing([], 10)).toBeNull());
});

describe("formatDuration and chapterVerdict", () => {
  it("formats durations", () => {
    expect(formatDuration(35_000)).toBe("35 s");
    expect(formatDuration(260_000)).toBe("4 m 20 s");
    expect(formatDuration(3_900_000)).toBe("1 h 5 m");
  });
  it("labels chapters", () => {
    expect(chapterVerdict(8, 10)).toBe("strong");
    expect(chapterVerdict(5, 10)).toBe("ok");
    expect(chapterVerdict(3, 10)).toBe("weak");
    expect(chapterVerdict(0, 0)).toBeNull();
  });
});
