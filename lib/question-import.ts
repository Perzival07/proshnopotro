/**
 * Reads a whole question paper pasted as plain text.
 *
 * The format is written to be typed by a tutor, not a programmer, and every
 * other way questions arrive (a Word file, later) is turned into this text
 * first, so there is one reader and one set of error messages.
 *
 *   # Physics                     <- a section; "# Physics | attempt 5" limits it
 *
 *   Q1. A block of mass $m$ ...   <- a question; maths in $...$ or $$...$$
 *   (A) $2mg$                     <- options (A)-(D), also "A." "A)" "a)"
 *   (B) $mg$
 *   Answer: B                     <- B, or "A, C" for more than one
 *   Solution: ...                 <- optional, may run over several lines
 *
 *   Q2. [integer] Find $n$.       <- no options: the answer decides the type
 *   Answer: 7                         7 -> integer, 2.45 to 2.55 -> decimal
 *
 *   Paragraph:                    <- a passage shared by the questions after
 *   ...                              it, until "End paragraph" or a new section
 *
 * A tag in square brackets after the number forces the type: [single],
 * [multiple], [integer], [decimal]. Without it, a question with options is
 * single-correct unless its answer lists more than one option. "Marks: +3 -1"
 * gives one question its own marks.
 */

import type { AnswerKey, QuestionType } from "./marking";

export interface ImportedOption {
  id: string;
  text: string;
}

export interface ImportedQuestion {
  /** Line the question starts on, for error messages. */
  line: number;
  type: QuestionType;
  stem: string;
  options: ImportedOption[];
  key: AnswerKey;
  solution: string | null;
  /** Index into the paper's passages, or null. */
  passage: number | null;
  rule: { correct?: number; wrong?: number } | null;
}

export interface ImportedSection {
  title: string;
  attemptLimit: number | null;
  questions: ImportedQuestion[];
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ImportedPaper {
  sections: ImportedSection[];
  passages: string[];
  errors: ImportError[];
}

const OPTION_IDS = ["A", "B", "C", "D", "E", "F"];

const SECTION_RE = /^#\s*(.+?)\s*$/;
const QUESTION_RE = /^Q(?:uestion)?\s*\.?\s*(\d+)\s*[.):]\s*(.*)$/i;
const TYPE_TAG_RE = /^\[(single|multiple|multi|integer|decimal|numerical)\]\s*/i;
const OPTION_RE = /^\(?([A-Fa-f])[.)]\s+(.*)$/;
const ANSWER_RE = /^(?:Answer|Ans|Key)\s*[:.-]\s*(.*)$/i;
const SOLUTION_RE = /^(?:Solution|Sol|Explanation)\s*[:.-]\s*(.*)$/i;
const MARKS_RE = /^Marks\s*[:.-]\s*(.*)$/i;
const PARAGRAPH_RE = /^(?:Paragraph|Passage|Comprehension)\s*[:.-]?\s*(.*)$/i;
const END_PARAGRAPH_RE = /^End\s+(?:paragraph|passage|comprehension)\s*$/i;
const ATTEMPT_RE = /\|\s*attempt\s+(?:any\s+)?(\d+)\s*$/i;

type Field = "stem" | "option" | "solution" | "paragraph" | null;

interface Draft {
  line: number;
  tag: QuestionType | null;
  stem: string[];
  options: ImportedOption[];
  answer: string | null;
  answerLine: number;
  solution: string[] | null;
  marks: string | null;
  marksLine: number;
  passage: number | null;
}

function tagToType(tag: string): QuestionType {
  const t = tag.toLowerCase();
  if (t === "multiple" || t === "multi") return "MULTIPLE";
  if (t === "integer") return "INTEGER";
  if (t === "decimal" || t === "numerical") return "DECIMAL";
  return "SINGLE";
}

/** "A, C" / "AC" / "a and c" -> ["A", "C"]; null when it is not a list of letters. */
function parseOptionAnswer(raw: string): string[] | null {
  const cleaned = raw.toUpperCase().replace(/\b(AND|&)\b/g, ",").replace(/[()\s]/g, "");
  const letters = cleaned.includes(",") ? cleaned.split(",").filter(Boolean) : cleaned.split("");
  if (letters.length === 0 || !letters.every((l) => OPTION_IDS.includes(l))) return null;
  return Array.from(new Set(letters)).sort();
}

const NUM = "-?(?:\\d+\\.?\\d*|\\.\\d+)";

/**
 * A numeric answer: "7", "7 or 8", "2.45 to 2.55", "2.45-2.55", "2.5 ± 0.05",
 * "2.5 +- 0.05". Returns an integer key for whole numbers, else a range.
 */
function parseNumericKey(raw: string, forced: QuestionType | null): AnswerKey | null {
  const s = raw.trim();

  const range = s.match(new RegExp(`^(${NUM})\\s*(?:to|–|—|-)\\s*(${NUM})$`, "i"));
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    return { type: "DECIMAL", min: Math.min(a, b), max: Math.max(a, b) };
  }

  const plusMinus = s.match(new RegExp(`^(${NUM})\\s*(?:±|\\+/?-)\\s*(${NUM})$`));
  if (plusMinus) {
    const [mid, tol] = [Number(plusMinus[1]), Math.abs(Number(plusMinus[2]))];
    return { type: "DECIMAL", min: mid - tol, max: mid + tol };
  }

  const list = s.split(/\s*(?:,|\bor\b)\s*/i).filter(Boolean);
  if (list.length > 0 && list.every((v) => new RegExp(`^${NUM}$`).test(v))) {
    const values = list.map(Number);
    if (forced === "DECIMAL" || values.some((v) => !Number.isInteger(v))) {
      if (values.length !== 1) return null;
      return { type: "DECIMAL", min: values[0], max: values[0] };
    }
    return { type: "INTEGER", values };
  }
  return null;
}

/** "+3 -1", "+4, -2", "3/-1" -> { correct: 3, wrong: -1 }. */
function parseMarks(raw: string): { correct: number; wrong: number } | null {
  const nums = raw.match(/[+-]?\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0 || nums.length > 2) return null;
  const correct = Math.abs(Number(nums[0]));
  const wrong = nums[1] !== undefined ? -Math.abs(Number(nums[1])) : 0;
  return { correct, wrong };
}

function joinLines(lines: string[]): string {
  return lines.join("\n").replace(/^\n+|\n+$/g, "");
}

export function parseQuestionPaper(text: string): ImportedPaper {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sections: ImportedSection[] = [];
  const passages: string[] = [];
  const errors: ImportError[] = [];

  let section: ImportedSection | null = null;
  let draft: Draft | null = null;
  let field: Field = null;
  let passageLines: string[] | null = null;
  let currentPassage: number | null = null;

  const ensureSection = () => {
    if (!section) {
      section = { title: "Questions", attemptLimit: null, questions: [] };
      sections.push(section);
    }
    return section;
  };

  const closePassage = () => {
    if (passageLines) {
      const body = joinLines(passageLines);
      if (body) {
        passages.push(body);
        currentPassage = passages.length - 1;
      }
      passageLines = null;
    }
  };

  const finish = () => {
    if (!draft) return;
    const d = draft;
    draft = null;
    const stem = joinLines(d.stem);
    const where = `Question on line ${d.line}`;

    if (!stem) {
      errors.push({ line: d.line, message: `${where} has no text.` });
      return;
    }
    if (d.answer === null || !d.answer.trim()) {
      errors.push({ line: d.line, message: `${where} has no "Answer:" line.` });
      return;
    }

    let key: AnswerKey | null = null;
    let type: QuestionType;

    if (d.options.length > 0) {
      if (d.tag === "INTEGER" || d.tag === "DECIMAL") {
        errors.push({ line: d.line, message: `${where} is marked [${d.tag.toLowerCase()}] but has options.` });
        return;
      }
      if (d.options.length < 2) {
        errors.push({ line: d.line, message: `${where} has only one option.` });
        return;
      }
      const letters = parseOptionAnswer(d.answer);
      if (!letters) {
        errors.push({ line: d.answerLine, message: `Answer "${d.answer}" is not a list of option letters.` });
        return;
      }
      const known = new Set(d.options.map((o) => o.id));
      const missing = letters.filter((l) => !known.has(l));
      if (missing.length > 0) {
        errors.push({ line: d.answerLine, message: `Answer names option ${missing.join(", ")}, which the question does not have.` });
        return;
      }
      type = d.tag ?? (letters.length > 1 ? "MULTIPLE" : "SINGLE");
      if (type === "SINGLE" && letters.length > 1) {
        // A single-correct question whose revised key accepts either option.
        key = { type: "SINGLE", options: letters };
      } else {
        key = { type, options: letters } as AnswerKey;
      }
    } else {
      if (d.tag === "SINGLE" || d.tag === "MULTIPLE") {
        errors.push({ line: d.line, message: `${where} is marked [${d.tag.toLowerCase()}] but has no options.` });
        return;
      }
      key = parseNumericKey(d.answer, d.tag);
      if (!key) {
        errors.push({
          line: d.answerLine,
          message: `Answer "${d.answer}" is not a number. Use 7, "7 or 8", "2.45 to 2.55" or "2.5 ± 0.05".`,
        });
        return;
      }
      if (d.tag === "INTEGER" && key.type !== "INTEGER") {
        errors.push({ line: d.answerLine, message: `${where} is marked [integer] but its answer is not a whole number.` });
        return;
      }
      if (d.tag === "DECIMAL" && key.type === "INTEGER") {
        key = { type: "DECIMAL", min: key.values[0], max: key.values[0] };
      }
      type = key.type;
    }

    let rule: ImportedQuestion["rule"] = null;
    if (d.marks !== null) {
      rule = parseMarks(d.marks);
      if (!rule) {
        errors.push({ line: d.marksLine, message: `Marks "${d.marks}" should look like "+4 -1".` });
        return;
      }
    }

    ensureSection().questions.push({
      line: d.line,
      type,
      stem,
      options: d.options.map((o) => ({ id: o.id, text: o.text.trim() })),
      key,
      solution: d.solution ? joinLines(d.solution) || null : null,
      passage: d.passage,
      rule,
    });
  };

  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();

    // Inside a passage, everything is passage text until a question starts it
    // being used, an explicit end, or a new section.
    if (passageLines && !QUESTION_RE.test(line) && !SECTION_RE.test(line) && !END_PARAGRAPH_RE.test(line)) {
      passageLines.push(raw);
      return;
    }

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      finish();
      closePassage();
      currentPassage = null;
      let title = sectionMatch[1];
      let attemptLimit: number | null = null;
      const attempt = title.match(ATTEMPT_RE);
      if (attempt) {
        attemptLimit = Number(attempt[1]);
        title = title.replace(ATTEMPT_RE, "").trim();
      }
      section = { title, attemptLimit, questions: [] };
      sections.push(section);
      field = null;
      return;
    }

    if (END_PARAGRAPH_RE.test(line)) {
      finish();
      closePassage();
      currentPassage = null;
      field = null;
      return;
    }

    const paragraph = line.match(PARAGRAPH_RE);
    if (paragraph) {
      finish();
      closePassage();
      passageLines = paragraph[1] ? [paragraph[1]] : [];
      field = "paragraph";
      return;
    }

    const question = line.match(QUESTION_RE);
    if (question) {
      finish();
      closePassage();
      let rest = question[2];
      let tag: QuestionType | null = null;
      const tagMatch = rest.match(TYPE_TAG_RE);
      if (tagMatch) {
        tag = tagToType(tagMatch[1]);
        rest = rest.slice(tagMatch[0].length);
      }
      draft = {
        line: lineNo,
        tag,
        stem: rest ? [rest] : [],
        options: [],
        answer: null,
        answerLine: lineNo,
        solution: null,
        marks: null,
        marksLine: lineNo,
        passage: currentPassage,
      };
      field = "stem";
      return;
    }

    if (!draft) {
      if (line) {
        errors.push({ line: lineNo, message: `"${line.slice(0, 40)}" is outside any question. Start questions with "Q1."` });
      }
      return;
    }
    const d: Draft = draft;

    const answer = line.match(ANSWER_RE);
    if (answer) {
      d.answer = answer[1];
      d.answerLine = lineNo;
      field = null;
      return;
    }

    const solution = line.match(SOLUTION_RE);
    if (solution) {
      d.solution = solution[1] ? [solution[1]] : [];
      field = "solution";
      return;
    }

    const marks = line.match(MARKS_RE);
    if (marks) {
      d.marks = marks[1];
      d.marksLine = lineNo;
      field = null;
      return;
    }

    const option = field !== "solution" && d.answer === null ? line.match(OPTION_RE) : null;
    if (option) {
      const id = option[1].toUpperCase();
      const expected = OPTION_IDS[d.options.length];
      if (id !== expected) {
        errors.push({ line: lineNo, message: `Expected option (${expected}) here, found (${id}).` });
      }
      d.options.push({ id, text: option[2] });
      field = "option";
      return;
    }

    // A continuation line belongs to whatever came last.
    if (field === "stem") d.stem.push(raw);
    else if (field === "option") d.options[d.options.length - 1].text += `\n${raw}`;
    else if (field === "solution") d.solution!.push(raw);
    else if (line) {
      errors.push({ line: lineNo, message: `"${line.slice(0, 40)}" comes after the answer. Put it before "Answer:", or start it with "Solution:".` });
    }
  });

  finish();
  closePassage();

  return { sections: sections.filter((s) => s.questions.length > 0), passages, errors };
}

/** A number written back the way a tutor would type it: 2.45, not 2.4500000001. */
function formatNumber(n: number): string {
  return String(Number(n.toFixed(10)));
}

function keyToAnswer(key: AnswerKey): string {
  switch (key.type) {
    case "SINGLE":
    case "MULTIPLE":
      return key.options.join(", ");
    case "INTEGER":
      return key.values.join(" or ");
    case "DECIMAL":
      return key.min === key.max
        ? formatNumber(key.min)
        : `${formatNumber(key.min)} to ${formatNumber(key.max)}`;
  }
}

/**
 * One question written back in the paste format, so it can be edited as text
 * and read back by parseQuestionPaper. The type tag is written out whenever
 * the answer alone would not say it -- a multi-correct question with one right
 * option, a single-correct one with two accepted, a decimal with a whole-number
 * answer.
 */
export function questionToText(
  question: Pick<ImportedQuestion, "type" | "stem" | "options" | "key" | "solution" | "rule">,
  number = 1
): string {
  const { type, key } = question;
  const needsTag =
    (type === "MULTIPLE" && key.type === "MULTIPLE" && key.options.length === 1) ||
    (type === "SINGLE" && key.type === "SINGLE" && key.options.length > 1) ||
    (type === "DECIMAL" && key.type === "DECIMAL" && Number.isInteger(key.min) && key.min === key.max);
  const tag = needsTag ? `[${type.toLowerCase()}] ` : "";

  const lines = [`Q${number}. ${tag}${question.stem}`];
  for (const option of question.options) lines.push(`(${option.id}) ${option.text}`);
  lines.push(`Answer: ${keyToAnswer(key)}`);
  if (question.rule && (question.rule.correct !== undefined || question.rule.wrong !== undefined)) {
    const correct = question.rule.correct ?? 0;
    const wrong = question.rule.wrong ?? 0;
    lines.push(`Marks: +${formatNumber(correct)} ${wrong <= 0 ? "-" : "+"}${formatNumber(Math.abs(wrong))}`);
  }
  if (question.solution) lines.push(`Solution: ${question.solution}`);
  return lines.join("\n");
}
