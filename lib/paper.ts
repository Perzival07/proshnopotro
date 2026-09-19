/**
 * The bridge between stored questions and the marker, and between stored
 * questions and what a student is allowed to see.
 *
 * Pure functions only: the database hands rows in, and nothing here reads or
 * writes anything, so each rule can be tested on its own.
 */

import { parseTranslation, type QuestionTranslation } from "./translation";
import {
  isAttempted,
  QUESTION_TYPES,
  SCHEME_PRESETS,
  type AnswerKey,
  type MarkableSection,
  type MarkingScheme,
  type MarkRule,
  type QuestionType,
  type ResponseValue,
} from "./marking";

export interface OptionRow {
  id: string;
  text: string;
}

/** A question row as stored, with the Json columns still untyped. */
export interface QuestionRow {
  id: string;
  position: number;
  type: QuestionType;
  stem: string;
  options: unknown;
  answerKey: unknown;
  solution: string | null;
  marksCorrect: number | null;
  marksWrong: number | null;
  bonus: boolean;
  passageId: string | null;
  /** The question in the test's second language, as stored. */
  translation?: unknown;
  /** Internal choice: questions sharing a group count once. */
  choiceGroup?: string | null;
}

export interface SectionRow {
  id: string;
  title: string;
  position: number;
  instructions: string | null;
  attemptLimit: number | null;
  durationMinutes: number | null;
  markingScheme: unknown;
  questions: QuestionRow[];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readRule(raw: unknown, fallback: MarkRule): MarkRule {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    correct: isNum(r.correct) ? r.correct : fallback.correct,
    wrong: isNum(r.wrong) ? r.wrong : fallback.wrong,
  };
}

/**
 * A stored scheme, with anything missing or malformed filled in from the
 * JEE Main preset rather than failing the whole paper.
 */
export function normalizeScheme(raw: unknown): MarkingScheme {
  const base = SCHEME_PRESETS.JEE_MAIN.scheme;
  const r = (raw ?? {}) as Record<string, unknown>;
  const multi = (r.MULTIPLE ?? {}) as Record<string, unknown>;
  return {
    SINGLE: readRule(r.SINGLE, base.SINGLE),
    MULTIPLE: {
      ...readRule(r.MULTIPLE, base.MULTIPLE),
      partial: multi.partial === "PER_OPTION" ? "PER_OPTION" : "NONE",
      partialPerOption: isNum(multi.partialPerOption) ? multi.partialPerOption : 0,
    },
    INTEGER: readRule(r.INTEGER, base.INTEGER),
    DECIMAL: readRule(r.DECIMAL, base.DECIMAL),
    SUBJECTIVE: { ...readRule(r.SUBJECTIVE, base.SUBJECTIVE), wrong: 0 },
    MATRIX: {
      ...readRule(r.MATRIX, base.MATRIX),
      perRow: typeof (r.MATRIX as Record<string, unknown> | undefined)?.perRow === "boolean"
        ? ((r.MATRIX as Record<string, unknown>).perRow as boolean)
        : base.MATRIX.perRow,
    },
  };
}

/** A stored answer key, or null when it is not one this type can use. */
export function parseAnswerKey(type: QuestionType, raw: unknown): AnswerKey | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.type !== type) return null;
  switch (type) {
    case "SINGLE":
    case "MULTIPLE":
      return Array.isArray(r.options) && r.options.length > 0 && r.options.every((o) => typeof o === "string")
        ? { type, options: r.options as string[] }
        : null;
    case "INTEGER":
      return Array.isArray(r.values) && r.values.length > 0 && r.values.every((v) => isNum(v) && Number.isInteger(v))
        ? { type, values: r.values as number[] }
        : null;
    case "DECIMAL":
      return isNum(r.min) && isNum(r.max) && r.min <= r.max ? { type, min: r.min, max: r.max } : null;
    case "SUBJECTIVE":
      return { type };
    case "MATRIX": {
      const rows = r.rows as Record<string, unknown> | undefined;
      if (!rows || typeof rows !== "object" || Array.isArray(rows)) return null;
      const entries = Object.entries(rows);
      if (entries.length === 0) return null;
      const ok = entries.every(
        ([, cols]) => Array.isArray(cols) && cols.length > 0 && cols.every((c) => typeof c === "string")
      );
      return ok ? { type, rows: rows as Record<string, string[]> } : null;
    }
  }
}

/** Column I and Column II of a matrix question. */
export function parseMatrixOptions(raw: unknown): { rows: OptionRow[]; columns: OptionRow[] } {
  const r = (raw ?? {}) as Record<string, unknown>;
  return { rows: parseOptions(r.rows), columns: parseOptions(r.columns) };
}

export function parseOptions(raw: unknown): OptionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is OptionRow =>
      !!o && typeof (o as OptionRow).id === "string" && typeof (o as OptionRow).text === "string"
  );
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * The paper in the marker's shape. A question whose stored key cannot be read
 * is marked as a bonus rather than wrongly: a broken key must never cost a
 * student marks.
 */
export function toMarkableSections(
  sections: SectionRow[],
  testScheme: MarkingScheme,
  /** Written answers: question id -> the marks the tutor gave. */
  manualMarks: Record<string, number | null | undefined> = {}
): MarkableSection[] {
  return [...sections].sort(byPosition).map((section) => ({
    id: section.id,
    attemptLimit: section.attemptLimit,
    scheme: section.markingScheme ? normalizeScheme(section.markingScheme) : testScheme,
    questions: [...section.questions].sort(byPosition).map((q) => {
      const key = parseAnswerKey(q.type, q.answerKey);
      return {
        id: q.id,
        key: key ?? { type: "SINGLE", options: [] },
        rule:
          q.marksCorrect !== null || q.marksWrong !== null
            ? { correct: q.marksCorrect ?? undefined, wrong: q.marksWrong ?? undefined }
            : null,
        bonus: q.bonus || key === null,
        choiceGroup: q.choiceGroup ?? null,
        manualMarks: manualMarks[q.id] ?? null,
      };
    }),
  }));
}

export interface StudentQuestion {
  id: string;
  number: number;
  type: QuestionType;
  stem: string;
  options: OptionRow[];
  passageId: string | null;
  marks: { correct: number; wrong: number };
  /** Matrix questions: Column II. `options` then holds Column I. */
  columns?: OptionRow[];
  /** The question in the paper's second language, when it has one. */
  translation?: QuestionTranslation | null;
  /** Internal choice: the alternatives share this and their number. */
  choiceGroup?: string | null;
  /** The second (third ...) alternative of an internal choice. */
  alternative?: boolean;
}

export interface StudentSection {
  id: string;
  title: string;
  instructions: string | null;
  attemptLimit: number | null;
  /** This section's own minutes, when the paper is timed per section. */
  durationMinutes: number | null;
  questions: StudentQuestion[];
}

/**
 * The paper as a student may see it while writing: no answer keys, no
 * solutions, nothing that would give an answer away. Questions are numbered
 * straight through the paper, as on the real exam.
 */
export function toStudentPaper(sections: SectionRow[], testScheme: MarkingScheme): StudentSection[] {
  let number = 0;
  return [...sections].sort(byPosition).map((section) => {
    const scheme = section.markingScheme ? normalizeScheme(section.markingScheme) : testScheme;
    return {
      id: section.id,
      title: section.title,
      instructions: section.instructions,
      attemptLimit: section.attemptLimit,
      durationMinutes: section.durationMinutes,
      questions: [...section.questions].sort(byPosition).map((q, i, all) => {
        // Alternatives of an internal choice share their number, as printed
        // on board papers: "16 ... OR ...".
        const alternative = !!q.choiceGroup && i > 0 && all[i - 1].choiceGroup === q.choiceGroup;
        return {
        id: q.id,
        number: alternative ? number : ++number,
        choiceGroup: q.choiceGroup ?? null,
        alternative,
        type: q.type,
        stem: q.stem,
        ...(q.type === "MATRIX"
          ? { options: parseMatrixOptions(q.options).rows, columns: parseMatrixOptions(q.options).columns }
          : { options: parseOptions(q.options) }),
        passageId: q.passageId,
        marks: {
          correct: q.marksCorrect ?? scheme[q.type].correct,
          wrong: q.marksWrong ?? scheme[q.type].wrong,
        },
        // The translation's solution is left out: solutions are for results.
        translation: (() => {
          const t = parseTranslation(q.translation);
          return t ? { ...t, solution: null } : null;
        })(),
        };
      }),
    };
  });
}

export type ResponseCheck = { ok: true; value: ResponseValue } | { ok: false; error: string };

/**
 * Checks what the browser sent for one question before it is saved. Only the
 * shape is checked here -- whether it is right is the marker's business, and
 * only after the paper closes.
 */
export function checkResponse(
  type: QuestionType,
  optionIds: string[],
  raw: unknown,
  columnIds: string[] = []
): ResponseCheck {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (!QUESTION_TYPES.includes(type)) return { ok: false, error: "Unknown question type." };

  if (type === "SUBJECTIVE") return { ok: false, error: "Write this answer on paper; it is uploaded as a photo." };

  if (type === "MATRIX") {
    if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Match each row to its columns." };
    const clean: Record<string, string[]> = {};
    for (const [row, cols] of Object.entries(raw as Record<string, unknown>)) {
      if (!optionIds.includes(row) || !Array.isArray(cols) || !cols.every((c) => typeof c === "string" && columnIds.includes(c))) {
        return { ok: false, error: "Match each row to the columns given." };
      }
      const chosen = Array.from(new Set(cols as string[])).sort();
      if (chosen.length) clean[row] = chosen;
    }
    return { ok: true, value: Object.keys(clean).length ? clean : null };
  }

  if (type === "SINGLE") {
    return typeof raw === "string" && optionIds.includes(raw)
      ? { ok: true, value: raw }
      : { ok: false, error: "Choose one of the options." };
  }
  if (type === "MULTIPLE") {
    if (!Array.isArray(raw) || !raw.every((o) => typeof o === "string" && optionIds.includes(o))) {
      return { ok: false, error: "Choose from the options given." };
    }
    const chosen = Array.from(new Set(raw as string[])).sort();
    return { ok: true, value: chosen.length > 0 ? chosen : null };
  }
  // INTEGER / DECIMAL: kept as typed; the marker reads the number.
  if (typeof raw !== "string" || raw.length > 20 || !/^[\d.\-\s]*$/.test(raw)) {
    return { ok: false, error: "Enter a number." };
  }
  const trimmed = raw.trim();
  return { ok: true, value: trimmed === "" ? null : trimmed };
}

/**
 * Whether a student may put an answer to this question in a section with an
 * "attempt any N" limit. Changing an answer they already gave is always fine;
 * a new one is refused once N are answered.
 */
export function withinAttemptLimit(
  attemptLimit: number | null,
  answeredInSection: number,
  alreadyAnswered: boolean
): boolean {
  if (!attemptLimit || attemptLimit <= 0 || alreadyAnswered) return true;
  return answeredInSection < attemptLimit;
}

export { isAttempted };

export interface SectionWindow {
  id: string;
  /** Milliseconds from the start of the attempt. */
  opensAt: number;
  closesAt: number;
}

/**
 * The time windows of a paper with a timer per section, as offsets from the
 * moment the student opened it. Sections run one after another in paper
 * order, each for its own minutes, and a section that has closed stays
 * closed.
 *
 * Only a paper where every section has its own time is timed this way; with
 * any section left without one, there are no windows (null) and the paper
 * runs on the test's single timer.
 */
export function sectionWindows(
  sections: { id: string; position: number; durationMinutes: number | null }[]
): SectionWindow[] | null {
  if (sections.length === 0) return null;
  if (!sections.every((s) => s.durationMinutes && s.durationMinutes > 0)) return null;
  let at = 0;
  return [...sections].sort(byPosition).map((s) => {
    const opensAt = at;
    at += s.durationMinutes! * 60_000;
    return { id: s.id, opensAt, closesAt: at };
  });
}

/** Total minutes of a paper with a timer per section, or null. */
export function sectionalDuration(
  sections: { id: string; position: number; durationMinutes: number | null }[]
): number | null {
  const windows = sectionWindows(sections);
  return windows ? windows[windows.length - 1].closesAt / 60_000 : null;
}

/**
 * Whether an answer to a question in this section may be saved at `elapsedMs`
 * into the attempt. `graceMs` lets an answer sent in the section's last
 * moment still land.
 */
export function sectionOpen(
  windows: SectionWindow[] | null,
  sectionId: string,
  elapsedMs: number,
  graceMs = 0
): boolean {
  if (!windows) return true;
  const w = windows.find((x) => x.id === sectionId);
  if (!w) return false;
  return elapsedMs >= w.opensAt && elapsedMs <= w.closesAt + graceMs;
}
