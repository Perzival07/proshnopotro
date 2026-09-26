import { describe, it, expect } from "vitest";
import {
  checkResponse,
  normalizeScheme,
  sectionalDuration,
  sectionOpen,
  sectionWindows,
  parseAnswerKey,
  toMarkableSections,
  toStudentPaper,
  withinAttemptLimit,
  type SectionRow,
} from "./paper";
import { markPaper, SCHEME_PRESETS } from "./marking";

const MAIN = SCHEME_PRESETS.JEE_MAIN.scheme;

const section = (overrides: Partial<SectionRow> = {}): SectionRow => ({
  id: "s1",
  title: "Physics",
  position: 0,
  instructions: null,
  attemptLimit: null,
  durationMinutes: null,
  markingScheme: null,
  questions: [
    {
      id: "q2",
      position: 1,
      type: "INTEGER",
      stem: "Find n",
      options: [],
      answerKey: { type: "INTEGER", values: [7] },
      solution: "Because 7",
      marksCorrect: null,
      marksWrong: null,
      bonus: false,
      passageId: null,
    },
    {
      id: "q1",
      position: 0,
      type: "SINGLE",
      stem: "Pick",
      options: [
        { id: "A", text: "x" },
        { id: "B", text: "y" },
      ],
      answerKey: { type: "SINGLE", options: ["B"] },
      solution: "It is B",
      marksCorrect: 3,
      marksWrong: null,
      bonus: false,
      passageId: null,
    },
  ],
  ...overrides,
});

describe("normalizeScheme", () => {
  it("falls back to JEE Main for anything missing", () =>
    expect(normalizeScheme(null)).toEqual(MAIN));
  it("keeps what is stored", () => {
    const adv = SCHEME_PRESETS.JEE_ADVANCED.scheme;
    expect(normalizeScheme(JSON.parse(JSON.stringify(adv)))).toEqual(adv);
  });
  it("ignores junk values", () =>
    expect(normalizeScheme({ SINGLE: { correct: "lots" } }).SINGLE).toEqual(MAIN.SINGLE));
});

describe("parseAnswerKey", () => {
  it("reads each kind of key", () => {
    expect(parseAnswerKey("SINGLE", { type: "SINGLE", options: ["A"] })).toEqual({ type: "SINGLE", options: ["A"] });
    expect(parseAnswerKey("INTEGER", { type: "INTEGER", values: [1, 2] })).toEqual({ type: "INTEGER", values: [1, 2] });
    expect(parseAnswerKey("DECIMAL", { type: "DECIMAL", min: 1, max: 2 })).toEqual({ type: "DECIMAL", min: 1, max: 2 });
  });
  it("refuses a key of the wrong type or shape", () => {
    expect(parseAnswerKey("SINGLE", { type: "MULTIPLE", options: ["A"] })).toBeNull();
    expect(parseAnswerKey("SINGLE", { type: "SINGLE", options: [] })).toBeNull();
    expect(parseAnswerKey("INTEGER", { type: "INTEGER", values: [1.5] })).toBeNull();
    expect(parseAnswerKey("DECIMAL", { type: "DECIMAL", min: 3, max: 2 })).toBeNull();
  });
});

describe("toMarkableSections", () => {
  it("orders questions by position and applies their own marks", () => {
    const [s] = toMarkableSections([section()], MAIN);
    expect(s.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(s.questions[0].rule).toEqual({ correct: 3, wrong: undefined });
    const result = markPaper([s], { q1: "B", q2: "7" }, MAIN);
    expect(result.score).toBe(7);
  });

  it("turns an unreadable key into a bonus, never a lost mark", () => {
    const broken = section();
    broken.questions[1].answerKey = { type: "SINGLE", options: "B" };
    const [s] = toMarkableSections([broken], MAIN);
    expect(s.questions[0].bonus).toBe(true);
  });
});

describe("toStudentPaper", () => {
  it("never includes answer keys or solutions", () => {
    const json = JSON.stringify(toStudentPaper([section()], MAIN));
    expect(json).not.toContain("answerKey");
    expect(json).not.toContain("Because 7");
    expect(json).not.toContain("It is B");
    expect(json).not.toContain('"values"');
  });

  it("numbers questions straight through the paper and shows their marks", () => {
    const paper = toStudentPaper(
      [section(), section({ id: "s2", position: 1, title: "Chemistry" })],
      MAIN
    );
    expect(paper.flatMap((s) => s.questions.map((q) => q.number))).toEqual([1, 2, 3, 4]);
    expect(paper[0].questions[0].marks).toEqual({ correct: 3, wrong: -1 });
  });
});

describe("checkResponse", () => {
  const ids = ["A", "B", "C", "D"];
  it("accepts a valid answer of each type", () => {
    expect(checkResponse("SINGLE", ids, "B")).toEqual({ ok: true, value: "B" });
    expect(checkResponse("MULTIPLE", ids, ["C", "A", "A"])).toEqual({ ok: true, value: ["A", "C"] });
    expect(checkResponse("INTEGER", [], " 42 ")).toEqual({ ok: true, value: "42" });
    expect(checkResponse("DECIMAL", [], "-2.50")).toEqual({ ok: true, value: "-2.50" });
  });
  it("treats an empty answer as cleared", () => {
    expect(checkResponse("SINGLE", ids, null)).toEqual({ ok: true, value: null });
    expect(checkResponse("MULTIPLE", ids, [])).toEqual({ ok: true, value: null });
    expect(checkResponse("INTEGER", [], "  ")).toEqual({ ok: true, value: null });
  });
  it("refuses anything else", () => {
    expect(checkResponse("SINGLE", ids, "E").ok).toBe(false);
    expect(checkResponse("SINGLE", ids, ["A"]).ok).toBe(false);
    expect(checkResponse("MULTIPLE", ids, ["A", "Z"]).ok).toBe(false);
    expect(checkResponse("INTEGER", [], "12abc").ok).toBe(false);
    expect(checkResponse("INTEGER", [], 12).ok).toBe(false);
    expect(checkResponse("DECIMAL", [], "1".repeat(21)).ok).toBe(false);
  });
});

describe("withinAttemptLimit", () => {
  it("allows anything without a limit", () => expect(withinAttemptLimit(null, 99, false)).toBe(true));
  it("allows a new answer below the limit", () => expect(withinAttemptLimit(5, 4, false)).toBe(true));
  it("refuses a new answer at the limit", () => expect(withinAttemptLimit(5, 5, false)).toBe(false));
  it("always allows changing an existing answer", () => expect(withinAttemptLimit(5, 5, true)).toBe(true));
});

describe("section windows", () => {
  const sections = [
    { id: "chem", position: 1, durationMinutes: 40 },
    { id: "phy", position: 0, durationMinutes: 60 },
  ];
  const min = 60_000;

  it("runs sections back to back in paper order", () => {
    expect(sectionWindows(sections)).toEqual([
      { id: "phy", opensAt: 0, closesAt: 60 * min },
      { id: "chem", opensAt: 60 * min, closesAt: 100 * min },
    ]);
    expect(sectionalDuration(sections)).toBe(100);
  });

  it("does not time sections unless every one has a time", () => {
    expect(sectionWindows([...sections, { id: "bio", position: 2, durationMinutes: null }])).toBeNull();
    expect(sectionWindows([])).toBeNull();
  });

  it("opens each section only in its own window", () => {
    const w = sectionWindows(sections);
    expect(sectionOpen(w, "phy", 10 * min)).toBe(true);
    expect(sectionOpen(w, "chem", 10 * min)).toBe(false);
    expect(sectionOpen(w, "phy", 61 * min)).toBe(false);
    expect(sectionOpen(w, "chem", 61 * min)).toBe(true);
  });

  it("lets an answer sent at the last moment land", () =>
    expect(sectionOpen(sectionWindows(sections), "phy", 60 * min + 5000, 15000)).toBe(true));

  it("leaves an untimed paper open", () => expect(sectionOpen(null, "any", 0)).toBe(true));
});
