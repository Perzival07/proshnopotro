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
 *   Q3. [matrix] Match the columns  <- matrix match: Column I is (A)-(D),
 *   (A) ...                            Column II is (P)-(T), each row may
 *   Column II:                         match more than one column
 *   (P) ...
 *   Answer: A-P,Q; B-R; C-S; D-T
 *
 * A tag in square brackets after the number forces the type: [single],
 * [multiple], [integer], [decimal], [matrix]. Without it, a question with options is
 * single-correct unless its answer lists more than one option. "Marks: +3 -1"
 * gives one question its own marks.
 *
 * Papers typed for print are read too, so a tutor's Word file needs little
 * rework:
 *   - questions numbered "1." or "1)" instead of "Q1.", as long as the numbers
 *     run in order;
 *   - all four options on one line: "(A) 2 (B) 4 (C) 6 (D) 8";
 *   - an answer key at the end instead of "Answer:" under each question:
 *       Answer key
 *       1. B   2. A, C   3. 7   4. 2.45 to 2.55
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
  /** Matrix questions only: Column II. `options` is then Column I. */
  columns: ImportedOption[];
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
// Hindi papers use प्रश्न (question), उत्तर (answer), हल (solution) and
// अनुच्छेद (paragraph); both spellings are read everywhere.
const QUESTION_RE = /^(?:Q(?:uestion)?|प्रश्न)\s*\.?\s*(\d+)\s*[.):]\s*(.*)$/i;
const TYPE_TAG_RE = /^\[(single|multiple|multi|integer|decimal|numerical|matrix|matrix match)\]\s*/i;
const COLUMN_OPTION_RE = /^\(?([P-Tp-t])[.)]\s+(.*)$/;
const COLUMN_HEADER_RE = /^(?:Column|List)[\s-]*(I{1,2}|1|2)\b\s*[:.-]?\s*$/i;
const COLUMN_IDS = ["P", "Q", "R", "S", "T"];
const OPTION_RE = /^\(?([A-Fa-f])[.)]\s+(.*)$/;
const ANSWER_RE = /^(?:Answer|Ans|Key|उत्तर)\s*[:.-]\s*(.*)$/i;
const SOLUTION_RE = /^(?:Solution|Sol|Explanation|हल)\s*[:.-]\s*(.*)$/i;
const MARKS_RE = /^Marks\s*[:.-]\s*(.*)$/i;
const PARAGRAPH_RE = /^(?:Paragraph|Passage|Comprehension|अनुच्छेद)\s*[:.-]?\s*(.*)$/i;
const END_PARAGRAPH_RE = /^(?:End\s+(?:paragraph|passage|comprehension)|अनुच्छेद\s+समाप्त)\s*$/i;
const ATTEMPT_RE = /\|\s*attempt\s+(?:any\s+)?(\d+)\s*$/i;
const PLAIN_QUESTION_RE = /^(\d{1,3})\s*[.)]\s+(\S.*)$/;
const ANSWER_KEY_RE = /^(?:answer\s*keys?|answers)\s*[:.\-\u2013]?\s*(.*)$/i;
const NUMBER_PATTERN = "-?(?:\\d+\\.?\\d*|\\.\\d+)";
/** "1. B", "2-A,C", "3) 7", "Q4: 2.45 to 2.55", "5 (c)" */
const KEY_ENTRY_RE = new RegExp(
  `(?:Q\\s*)?(\\d{1,3})\\s*[.):\\-\u2013]?\\s*\\(?\\s*(${NUMBER_PATTERN}\\s*(?:to|\u2013)\\s*${NUMBER_PATTERN}|[A-Fa-f](?:\\s*,\\s*[A-Fa-f]|[A-Fa-f])*(?![\\w.])|${NUMBER_PATTERN})\\s*\\)?`,
  "g"
);

/**
 * Reads an answer key: "1. B  2. A, C  3. 7". Returns question number ->
 * answer text, in the same forms an "Answer:" line takes.
 */
export function parseAnswerKeyText(text: string): Map<number, string> {
  const key = new Map<number, string>();
  for (const match of Array.from(text.matchAll(KEY_ENTRY_RE))) {
    key.set(Number(match[1]), match[2].trim());
  }
  return key;
}

/**
 * Splits options written on one line -- "(A) 2 (B) 4 (C) 6 (D) 8", perhaps
 * after the question text -- into one line each. Only the bracketed form is
 * split, only when the letters run A, B, ... in order, and after question
 * text only when there are at least three, so ordinary prose that mentions
 * "(a) and (b)" is left alone.
 */
export function splitInlineOptions(line: string): string[] {
  // A table row keeps its cells together.
  if (line.trimStart().startsWith("|")) return [line];
  const markers = Array.from(line.matchAll(/(^|\s)\(([A-Fa-f])\)\s/g));
  const first = markers.findIndex((m) => m[2] === "A" || m[2] === "a");
  if (first === -1) return [line];
  const upper = markers[first][2] === "A";
  const cuts: number[] = [];
  let expected = 0;
  for (const m of markers.slice(first)) {
    const letter = upper ? m[2] : m[2].toUpperCase();
    if ((upper ? m[2] !== m[2].toUpperCase() : m[2] !== m[2].toLowerCase()) || letter !== OPTION_IDS[expected]) continue;
    cuts.push(m.index! + m[1].length);
    expected++;
  }
  // Two markers mid-sentence ("compare (a) and (b) ...") are prose, not
  // options; a line that starts with (A), or runs to (C), is options.
  if (cuts.length < 2 || (cuts[0] !== 0 && cuts.length < 3)) return [line];
  const parts = [line.slice(0, cuts[0])];
  cuts.forEach((cut, i) => parts.push(line.slice(cut, cuts[i + 1] ?? line.length)));
  return parts.map((p) => p.trim()).filter(Boolean);
}

type Field = "stem" | "option" | "column" | "solution" | "paragraph" | null;

interface Draft {
  line: number;
  /** The number the paper gives it, for the answer key. */
  number: number;
  /** Saw a numbered list ("1. ... 2. ...") inside its text. */
  sawNumbered: boolean;
  tag: QuestionType | null;
  stem: string[];
  options: ImportedOption[];
  columns: ImportedOption[];
  /** Reading Column II of a matrix question. */
  inColumns: boolean;
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
  if (t.startsWith("matrix")) return "MATRIX";
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

/** "A-P,Q; B-R" / "A→PQ B→R" -> { A: ["P","Q"], B: ["R"] }; null if unreadable. */
function parseMatrixAnswer(raw: string): Record<string, string[]> | null {
  const rows: Record<string, string[]> = {};
  const re = /([A-Fa-f])\s*(?:-|\u2013|\u2192|->|:|=)\s*\(?([P-Tp-t](?:\s*[,&]?\s*[P-Tp-t])*)\)?/g;
  for (const m of Array.from(raw.matchAll(re))) {
    const cols = Array.from(new Set(m[2].toUpperCase().replace(/[^P-T]/g, "").split(""))).sort();
    rows[m[1].toUpperCase()] = cols;
  }
  return Object.keys(rows).length ? rows : null;
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

export interface ParseOptions {
  /**
   * For a paper in a second language: its answers come from the first
   * language's paper, so a question without one is kept instead of refused.
   * Such a question's type and key are placeholders and must not be used.
   */
  answersOptional?: boolean;
}

export function parseQuestionPaper(text: string, options: ParseOptions = {}): ImportedPaper {
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");

  // An answer key at the end is read first, and its lines are left out of
  // the questions.
  let keyStart = rawLines.findIndex((l) => {
    const m = l.trim().match(ANSWER_KEY_RE);
    return !!m && (m[1] === "" || parseAnswerKeyText(m[1]).size > 0);
  });
  if (keyStart === -1) keyStart = rawLines.length;
  const keyText = rawLines
    .slice(keyStart)
    .map((l, i) => (i === 0 ? l.trim().replace(ANSWER_KEY_RE, "$1") : l))
    .join("\n");
  const answerKey = parseAnswerKeyText(keyText);
  const keyLine = keyStart + 1;

  // Options run together on one line are split, keeping each piece's line
  // number for error messages.
  const lines: { raw: string; lineNo: number }[] = [];
  rawLines.slice(0, keyStart).forEach((raw, index) => {
    const parts = splitInlineOptions(raw);
    if (parts.length === 1) lines.push({ raw, lineNo: index + 1 });
    else for (const part of parts) lines.push({ raw: part, lineNo: index + 1 });
  });
  let lastNumber = 0;
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
    if ((d.answer === null || !d.answer.trim()) && answerKey.has(d.number)) {
      d.answer = answerKey.get(d.number)!;
      d.answerLine = keyLine;
    }
    if ((d.answer === null || !d.answer.trim()) && options.answersOptional) {
      ensureSection().questions.push({
        line: d.line,
        type: d.tag === "MATRIX" || d.columns.length ? "MATRIX" : d.options.length ? "SINGLE" : "INTEGER",
        stem,
        options: d.options.map((o) => ({ id: o.id, text: o.text.trim() })),
        columns: d.columns.map((c) => ({ id: c.id, text: c.text.trim() })),
        key: { type: "SINGLE", options: [] },
        solution: d.solution ? joinLines(d.solution) || null : null,
        passage: d.passage,
        rule: null,
      });
      return;
    }
    if (d.answer === null || !d.answer.trim()) {
      errors.push({
        line: d.line,
        message:
          answerKey.size > 0
            ? `${where} has no "Answer:" line, and the answer key has nothing for question ${d.number}.`
            : `${where} has no "Answer:" line.`,
      });
      return;
    }

    let key: AnswerKey | null = null;
    let type: QuestionType;

    if (d.tag === "MATRIX" || d.columns.length > 0) {
      if (d.options.length < 2 || d.columns.length < 2) {
        errors.push({
          line: d.line,
          message: `${where} is a matrix match, so it needs rows (A), (B), ... and columns (P), (Q), ...`,
        });
        return;
      }
      const rows = parseMatrixAnswer(d.answer);
      if (!rows) {
        errors.push({ line: d.answerLine, message: `Answer "${d.answer}" should look like "A-P,Q; B-R; C-S; D-T".` });
        return;
      }
      const rowIds = new Set(d.options.map((o) => o.id));
      const colIds = new Set(d.columns.map((c) => c.id));
      const badRow = Object.keys(rows).find((r) => !rowIds.has(r));
      const badCol = Object.values(rows).flat().find((c) => !colIds.has(c));
      const missing = d.options.map((o) => o.id).filter((r) => !rows[r]);
      if (badRow || badCol) {
        errors.push({ line: d.answerLine, message: `Answer names ${badRow ? `row ${badRow}` : `column ${badCol}`}, which the question does not have.` });
        return;
      }
      if (missing.length) {
        errors.push({ line: d.answerLine, message: `Answer does not say what row ${missing.join(", ")} matches.` });
        return;
      }
      type = "MATRIX";
      key = { type: "MATRIX", rows };
    } else if (d.options.length > 0) {
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
      columns: d.columns.map((c) => ({ id: c.id, text: c.text.trim() })),
      key,
      solution: d.solution ? joinLines(d.solution) || null : null,
      passage: d.passage,
      rule,
    });
  };

  /**
   * Whether a line starts a question: "Q7." always, a plain "7." only when it
   * is the next number in the paper. A numbered list inside a question ("1. ...
   * 2. ...") would otherwise be read as questions, so once one is seen in the
   * question text, plain numbers start a new question only after the options
   * or the answer.
   */
  const questionStart = (line: string): { number: number; rest: string } | null => {
    const explicit = line.match(QUESTION_RE);
    if (explicit) return { number: Number(explicit[1]), rest: explicit[2] };
    const plain = line.match(PLAIN_QUESTION_RE);
    if (!plain) return null;
    const n = Number(plain[1]);
    const d = draft as Draft | null;
    const listInText = !!d && d.sawNumbered && (field === "stem" || field === "solution");
    if (n === lastNumber + 1 && !listInText) return { number: n, rest: plain[2] };
    if (d) d.sawNumbered = true;
    return null;
  };

  lines.forEach(({ raw, lineNo }) => {
    const line = raw.trim();

    // Inside a passage, everything is passage text until a question starts it
    // being used, an explicit end, or a new section.
    if (
      passageLines &&
      !(PLAIN_QUESTION_RE.test(line) ? Number(line.match(PLAIN_QUESTION_RE)![1]) === lastNumber + 1 : QUESTION_RE.test(line)) &&
      !SECTION_RE.test(line) &&
      !END_PARAGRAPH_RE.test(line)
    ) {
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

    const question = questionStart(line);
    if (question) {
      finish();
      closePassage();
      lastNumber = question.number;
      let rest = question.rest;
      let tag: QuestionType | null = null;
      const tagMatch = rest.match(TYPE_TAG_RE);
      if (tagMatch) {
        tag = tagToType(tagMatch[1]);
        rest = rest.slice(tagMatch[0].length);
      }
      draft = {
        line: lineNo,
        number: question.number,
        sawNumbered: false,
        tag,
        stem: rest ? [rest] : [],
        options: [],
        columns: [],
        inColumns: false,
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
        errors.push({
          line: lineNo,
          message: `"${line.slice(0, 40)}" is outside any question. Start questions with "Q1." or "1."; if this is a section heading, start it with "#".`,
        });
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

    // Only a question tagged [matrix] has columns: in a list-match question
    // (single correct), "List-II" and its entries are just question text.
    const matrix = d.tag === "MATRIX" && d.answer === null && field !== "solution";
    const columnHeader = matrix ? line.match(COLUMN_HEADER_RE) : null;
    if (columnHeader) {
      d.inColumns = /^(II|2)$/i.test(columnHeader[1]);
      field = null;
      return;
    }

    // Column II of a matrix question: its (P), (Q), ... lines, with or
    // without a "Column II" line before them.
    const column = matrix ? line.match(COLUMN_OPTION_RE) : null;
    if (column) {
      d.inColumns = true;
      const id = column[1].toUpperCase();
      const expected = COLUMN_IDS[d.columns.length];
      if (id !== expected) errors.push({ line: lineNo, message: `Expected column (${expected}) here, found (${id}).` });
      d.columns.push({ id, text: column[2] });
      field = "column";
      return;
    }

    const option = field !== "solution" && d.answer === null && !d.inColumns ? line.match(OPTION_RE) : null;
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
    else if (field === "column") d.columns[d.columns.length - 1].text += `\n${raw}`;
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
    case "MATRIX":
      return Object.entries(key.rows)
        .map(([row, cols]) => `${row}-${cols.join(",")}`)
        .join("; ");
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
  question: Pick<ImportedQuestion, "type" | "stem" | "options" | "key" | "solution" | "rule"> & {
    columns?: ImportedOption[];
  },
  number = 1
): string {
  const { type, key } = question;
  const needsTag =
    (type === "MULTIPLE" && key.type === "MULTIPLE" && key.options.length === 1) ||
    (type === "SINGLE" && key.type === "SINGLE" && key.options.length > 1) ||
    (type === "DECIMAL" && key.type === "DECIMAL" && Number.isInteger(key.min) && key.min === key.max);
  const tag = type === "MATRIX" ? "[matrix] " : needsTag ? `[${type.toLowerCase()}] ` : "";

  const lines = [`Q${number}. ${tag}${question.stem}`];
  for (const option of question.options) lines.push(`(${option.id}) ${option.text}`);
  if (type === "MATRIX") {
    lines.push("Column II:");
    for (const column of question.columns ?? []) lines.push(`(${column.id}) ${column.text}`);
  }
  lines.push(`Answer: ${keyToAnswer(key)}`);
  if (question.rule && (question.rule.correct !== undefined || question.rule.wrong !== undefined)) {
    const correct = question.rule.correct ?? 0;
    const wrong = question.rule.wrong ?? 0;
    lines.push(`Marks: +${formatNumber(correct)} ${wrong <= 0 ? "-" : "+"}${formatNumber(Math.abs(wrong))}`);
  }
  if (question.solution) lines.push(`Solution: ${question.solution}`);
  return lines.join("\n");
}
