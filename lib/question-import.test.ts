import { describe, it, expect } from "vitest";
import { parseQuestionPaper, questionToText } from "./question-import";

const paper = (...lines: string[]) => parseQuestionPaper(lines.join("\n"));

describe("parseQuestionPaper: question types", () => {
  it("reads a single-correct question", () => {
    const { sections, errors } = paper(
      "Q1. A block of mass $m$ rests on a table.",
      "(A) $mg$",
      "(B) $2mg$",
      "(C) $0$",
      "(D) $mg/2$",
      "Answer: A"
    );
    expect(errors).toEqual([]);
    const q = sections[0].questions[0];
    expect(q.type).toBe("SINGLE");
    expect(q.stem).toBe("A block of mass $m$ rests on a table.");
    expect(q.options.map((o) => o.text)).toEqual(["$mg$", "$2mg$", "$0$", "$mg/2$"]);
    expect(q.key).toEqual({ type: "SINGLE", options: ["A"] });
  });

  it("reads several answer letters as multi-correct", () => {
    const { sections } = paper("Q1. Pick", "A. one", "B. two", "C. three", "D. four", "Answer: A, C");
    expect(sections[0].questions[0].key).toEqual({ type: "MULTIPLE", options: ["A", "C"] });
  });

  it("accepts answers written as AC or 'a and c'", () => {
    for (const answer of ["AC", "a and c", "(A), (C)"]) {
      const { sections } = paper("Q1. Pick", "A) one", "B) two", "C) three", `Answer: ${answer}`);
      expect(sections[0].questions[0].key).toEqual({ type: "MULTIPLE", options: ["A", "C"] });
    }
  });

  it("keeps a [multiple] question multi-correct even with one right option", () => {
    const { sections } = paper("Q1. [multiple] Pick", "(A) x", "(B) y", "Answer: B");
    expect(sections[0].questions[0].key).toEqual({ type: "MULTIPLE", options: ["B"] });
  });

  it("keeps a [single] question with two accepted options single-correct", () => {
    const { sections } = paper("Q1. [single] Pick", "(A) x", "(B) y", "Answer: A, B");
    expect(sections[0].questions[0].key).toEqual({ type: "SINGLE", options: ["A", "B"] });
  });

  it("reads a whole-number answer as an integer question", () => {
    const { sections } = paper("Q1. Find $n$.", "Answer: 7");
    expect(sections[0].questions[0].key).toEqual({ type: "INTEGER", values: [7] });
  });

  it("accepts more than one integer", () => {
    const { sections } = paper("Q1. Find $n$.", "Answer: 7 or 8");
    expect(sections[0].questions[0].key).toEqual({ type: "INTEGER", values: [7, 8] });
  });

  it.each([
    ["2.45 to 2.55", 2.45, 2.55],
    ["2.45-2.55", 2.45, 2.55],
    ["2.5 ± 0.05", 2.45, 2.55],
    ["2.5 +- 0.05", 2.45, 2.55],
    ["2.5", 2.5, 2.5],
  ])("reads %j as a decimal range", (answer, min, max) => {
    const { sections } = paper("Q1. Find $x$.", `Answer: ${answer}`);
    const key = sections[0].questions[0].key;
    expect(key.type).toBe("DECIMAL");
    if (key.type === "DECIMAL") {
      expect(key.min).toBeCloseTo(min);
      expect(key.max).toBeCloseTo(max);
    }
  });

  it("makes a [decimal] question with a whole-number answer a decimal", () => {
    const { sections } = paper("Q1. [decimal] Find $x$.", "Answer: 3");
    expect(sections[0].questions[0].key).toEqual({ type: "DECIMAL", min: 3, max: 3 });
  });
});

describe("parseQuestionPaper: structure", () => {
  it("splits sections and reads attempt limits", () => {
    const { sections } = paper(
      "# Physics",
      "Q1. a",
      "Answer: 1",
      "# Chemistry | attempt any 5",
      "Q2. b",
      "Answer: 2"
    );
    expect(sections.map((s) => [s.title, s.attemptLimit, s.questions.length])).toEqual([
      ["Physics", null, 1],
      ["Chemistry", 5, 1],
    ]);
  });

  it("keeps multi-line stems, options and solutions", () => {
    const { sections } = paper(
      "Q1. First line",
      "$$E = mc^2$$",
      "(A) one",
      "continued",
      "(B) two",
      "Answer: A",
      "Solution: Because",
      "of physics."
    );
    const q = sections[0].questions[0];
    expect(q.stem).toBe("First line\n$$E = mc^2$$");
    expect(q.options[0].text).toBe("one\ncontinued");
    expect(q.solution).toBe("Because\nof physics.");
  });

  it("attaches a passage to the questions after it", () => {
    const { sections, passages } = paper(
      "Paragraph:",
      "A gas expands slowly.",
      "Q1. Work done?",
      "Answer: 4",
      "Q2. Heat?",
      "Answer: 5",
      "End paragraph",
      "Q3. Unrelated",
      "Answer: 1"
    );
    expect(passages).toEqual(["A gas expands slowly."]);
    expect(sections[0].questions.map((q) => q.passage)).toEqual([0, 0, null]);
  });

  it("reads a question's own marks", () => {
    const { sections } = paper("Q1. a", "Answer: 1", "Marks: +3 -1");
    expect(sections[0].questions[0].rule).toEqual({ correct: 3, wrong: -1 });
  });

  it("accepts 'Question 1:' and 'Q 1)' numbering", () => {
    const { sections, errors } = paper("Question 1: a", "Answer: 1", "Q 2) b", "Answer: 2");
    expect(errors).toEqual([]);
    expect(sections[0].questions).toHaveLength(2);
  });
});

describe("parseQuestionPaper: errors", () => {
  it("reports a missing answer", () => {
    const { errors } = paper("Q1. a", "(A) x", "(B) y");
    expect(errors[0]).toEqual({ line: 1, message: 'Question on line 1 has no "Answer:" line.' });
  });

  it("reports an answer naming an option that does not exist", () => {
    const { errors } = paper("Q1. a", "(A) x", "(B) y", "Answer: C");
    expect(errors[0].line).toBe(4);
    expect(errors[0].message).toContain("option C");
  });

  it("reports an answer that is not a number", () => {
    const { errors } = paper("Q1. a", "Answer: seven");
    expect(errors[0].message).toContain("not a number");
  });

  it("reports options out of order", () => {
    const { errors } = paper("Q1. a", "(A) x", "(C) y", "Answer: A");
    expect(errors[0]).toEqual({ line: 3, message: "Expected option (B) here, found (C)." });
  });

  it("reports text outside any question", () => {
    const { errors } = paper("Some heading", "Q1. a", "Answer: 1");
    expect(errors[0].line).toBe(1);
  });

  it("reports [integer] with a fractional answer", () => {
    const { errors } = paper("Q1. [integer] a", "Answer: 2.5");
    expect(errors[0].message).toContain("[integer]");
  });

  it("still returns the good questions around a bad one", () => {
    const { sections, errors } = paper("Q1. a", "Answer: 1", "Q2. b", "Q3. c", "Answer: 3");
    expect(errors).toHaveLength(1);
    expect(sections[0].questions.map((q) => q.stem)).toEqual(["a", "c"]);
  });
});

describe("questionToText", () => {
  const roundTrip = (text: string) => {
    const first = parseQuestionPaper(text);
    expect(first.errors).toEqual([]);
    const q = first.sections[0].questions[0];
    const again = parseQuestionPaper(questionToText(q));
    expect(again.errors).toEqual([]);
    const back = again.sections[0].questions[0];
    expect({ ...back, line: 0 }).toEqual({ ...q, line: 0 });
  };

  it.each([
    ["single", "Q1. Pick $x$\n(A) one\n(B) two\nAnswer: B\nSolution: Since $x=2$."],
    ["multiple", "Q1. Pick\n(A) one\n(B) two\n(C) three\nAnswer: A, C"],
    ["multiple, one right", "Q1. [multiple] Pick\n(A) one\n(B) two\nAnswer: B"],
    ["single, two accepted", "Q1. [single] Pick\n(A) one\n(B) two\nAnswer: A, B"],
    ["integer", "Q1. Find\nAnswer: 7 or 8"],
    ["decimal range", "Q1. Find\nAnswer: 2.45 to 2.55"],
    ["decimal whole", "Q1. [decimal] Find\nAnswer: 3"],
    ["own marks", "Q1. Find\nAnswer: 3\nMarks: +3 -1"],
    ["multi-line", "Q1. Line one\n$$x$$\n(A) a\nmore\n(B) b\nAnswer: A\nSolution: one\ntwo"],
  ])("round-trips a %s question", (_, text) => roundTrip(text));
});
