/**
 * Pairs a paper in a second language (Hindi, usually) with the paper it
 * translates, as NTA papers come in both.
 *
 * The translation is written in the same paste format, question by question
 * in the same order; it needs no answers, because marking always uses the
 * original's key. Pairing goes by position, and each pair must have the same
 * option letters (and, for a matrix question, the same columns), so a
 * student reading either language is choosing between the same answers.
 */

import type { ImportedPaper } from "./question-import";

export interface OptionText {
  id: string;
  text: string;
}

/** One question's text in the second language. */
export interface QuestionTranslation {
  stem: string;
  options: OptionText[];
  columns: OptionText[];
  solution: string | null;
}

export interface OriginalQuestion {
  id: string;
  optionIds: string[];
  columnIds: string[];
  passageId: string | null;
}

export interface MatchedTranslation {
  questions: Map<string, QuestionTranslation>;
  passages: Map<string, string>;
  errors: string[];
}

/** Reads a stored translation, or null when there is none or it is unreadable. */
export function parseTranslation(raw: unknown): QuestionTranslation | null {
  const r = raw as Partial<QuestionTranslation> | null;
  if (!r || typeof r.stem !== "string") return null;
  const list = (v: unknown): OptionText[] =>
    Array.isArray(v) ? v.filter((o): o is OptionText => !!o && typeof o.id === "string" && typeof o.text === "string") : [];
  return {
    stem: r.stem,
    options: list(r.options),
    columns: list(r.columns),
    solution: typeof r.solution === "string" ? r.solution : null,
  };
}

/**
 * @param original the paper's questions, in paper order
 */
export function matchTranslation(original: OriginalQuestion[], translated: ImportedPaper): MatchedTranslation {
  const errors = translated.errors.map((e) => `Line ${e.line}: ${e.message}`);
  const questions = new Map<string, QuestionTranslation>();
  const passages = new Map<string, string>();
  const flat = translated.sections.flatMap((s) => s.questions);

  if (flat.length !== original.length) {
    errors.push(
      `The paper has ${original.length} ${original.length === 1 ? "question" : "questions"}, but the translation has ${flat.length}. Translate every question, in the same order.`
    );
    return { questions, passages, errors };
  }

  original.forEach((q, i) => {
    const t = flat[i];
    const n = i + 1;
    const ids = (list: OptionText[]) => list.map((o) => o.id).join(", ");
    if (q.optionIds.join(",") !== t.options.map((o) => o.id).join(",")) {
      errors.push(
        `Question ${n}: the paper has ${q.optionIds.length ? `options ${q.optionIds.join(", ")}` : "no options"}, the translation has ${t.options.length ? `options ${ids(t.options)}` : "no options"} (line ${t.line}).`
      );
      return;
    }
    if (q.columnIds.join(",") !== t.columns.map((o) => o.id).join(",")) {
      errors.push(`Question ${n}: the matrix columns do not match the paper's (line ${t.line}). Tag it [matrix] and list the same columns.`);
      return;
    }
    if ((q.passageId === null) !== (t.passage === null)) {
      errors.push(
        q.passageId
          ? `Question ${n} belongs to a passage in the paper, but not in the translation (line ${t.line}).`
          : `Question ${n} is under a passage in the translation, but not in the paper (line ${t.line}).`
      );
      return;
    }
    if (q.passageId && t.passage !== null) {
      const text = translated.passages[t.passage];
      const already = passages.get(q.passageId);
      if (already !== undefined && already !== text) {
        errors.push(`Question ${n}: its passage in the translation is not the one the questions before it share (line ${t.line}).`);
        return;
      }
      passages.set(q.passageId, text);
    }
    questions.set(q.id, { stem: t.stem, options: t.options, columns: t.columns, solution: t.solution });
  });

  return { questions, passages, errors };
}
