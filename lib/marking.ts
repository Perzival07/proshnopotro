/**
 * Marking for tests whose questions live in the portal.
 *
 * Everything here is a pure function of the answer key, the student's
 * responses and the marking scheme, so the server (which records the score)
 * and the result page (which explains it) can never disagree.
 *
 * Question types:
 *   SINGLE   - one option is right. The key may list more than one when an
 *              answer key is revised to accept either, as NTA sometimes does.
 *   MULTIPLE - one or more options are right (JEE Advanced "one or more").
 *   INTEGER  - a whole number typed in. The key may accept several values.
 *   DECIMAL  - a number typed in, right when it falls inside [min, max], which
 *              is how "correct to two decimal places" is marked.
 *
 * Paragraph and assertion-reason questions are SINGLE (or MULTIPLE) questions
 * with a shared passage or fixed options; list-match questions in the current
 * JEE Advanced pattern are SINGLE too. None of them needs its own rule.
 */

export type QuestionType = "SINGLE" | "MULTIPLE" | "INTEGER" | "DECIMAL";

export const QUESTION_TYPES: readonly QuestionType[] = ["SINGLE", "MULTIPLE", "INTEGER", "DECIMAL"];

export type AnswerKey =
  | { type: "SINGLE"; options: string[] }
  | { type: "MULTIPLE"; options: string[] }
  | { type: "INTEGER"; values: number[] }
  | { type: "DECIMAL"; min: number; max: number };

/**
 * What the student entered. Option ids for the choice types; the typed text
 * for the numeric ones, kept as typed so "2.50" is shown back as "2.50".
 */
export type ResponseValue = string | string[] | null;

export interface MarkRule {
  correct: number;
  /** Usually zero or negative: -1 for JEE Main and NEET. */
  wrong: number;
}

/**
 * How a MULTIPLE question is marked when the student picks some of the right
 * options and none of the wrong ones.
 *   NONE       - it counts as wrong.
 *   PER_OPTION - each right option picked earns `partialPerOption`. With 1,
 *                this is JEE Advanced's scheme: 3 of 4 right earns +3,
 *                2 of 3 or more earns +2, 1 of 2 or more earns +1.
 * Picking any wrong option is always wrong.
 */
export type PartialMode = "NONE" | "PER_OPTION";

export interface MarkingScheme {
  SINGLE: MarkRule;
  MULTIPLE: MarkRule & { partial: PartialMode; partialPerOption: number };
  INTEGER: MarkRule;
  DECIMAL: MarkRule;
}

export type SchemePreset = "JEE_MAIN" | "NEET" | "JEE_ADVANCED" | "NO_NEGATIVE";

/**
 * Starting points a tutor picks from and can then edit. JEE Advanced changes
 * its scheme from year to year, so its preset is only the most common recent
 * one; the tutor should check it against the paper.
 */
export const SCHEME_PRESETS: Record<SchemePreset, { label: string; scheme: MarkingScheme }> = {
  JEE_MAIN: {
    label: "JEE Main (+4 / −1)",
    scheme: {
      SINGLE: { correct: 4, wrong: -1 },
      MULTIPLE: { correct: 4, wrong: -1, partial: "NONE", partialPerOption: 0 },
      INTEGER: { correct: 4, wrong: -1 },
      DECIMAL: { correct: 4, wrong: -1 },
    },
  },
  NEET: {
    label: "NEET (+4 / −1)",
    scheme: {
      SINGLE: { correct: 4, wrong: -1 },
      MULTIPLE: { correct: 4, wrong: -1, partial: "NONE", partialPerOption: 0 },
      INTEGER: { correct: 4, wrong: -1 },
      DECIMAL: { correct: 4, wrong: -1 },
    },
  },
  JEE_ADVANCED: {
    label: "JEE Advanced (partial marking)",
    scheme: {
      SINGLE: { correct: 3, wrong: -1 },
      MULTIPLE: { correct: 4, wrong: -2, partial: "PER_OPTION", partialPerOption: 1 },
      INTEGER: { correct: 4, wrong: 0 },
      DECIMAL: { correct: 4, wrong: 0 },
    },
  },
  NO_NEGATIVE: {
    label: "No negative marking (boards)",
    scheme: {
      SINGLE: { correct: 1, wrong: 0 },
      MULTIPLE: { correct: 1, wrong: 0, partial: "NONE", partialPerOption: 0 },
      INTEGER: { correct: 1, wrong: 0 },
      DECIMAL: { correct: 1, wrong: 0 },
    },
  },
};

export type QuestionStatus = "CORRECT" | "PARTIAL" | "WRONG" | "UNATTEMPTED" | "NOT_COUNTED";

export interface QuestionMark {
  status: QuestionStatus;
  marks: number;
}

/** A question as the marker needs it: its key and, optionally, its own rule. */
export interface MarkableQuestion {
  id: string;
  key: AnswerKey;
  /** Overrides the scheme's rule for this one question. */
  rule?: Partial<MarkRule> | null;
  /** Dropped from the paper (a wrong question): full marks to everyone who attempted it. */
  bonus?: boolean;
}

/**
 * Parses what a student typed into a numeric answer. Accepts "5", "-3",
 * "2.5", ".5" and "2.50"; refuses anything else, including "1e3" and "5,5",
 * rather than guessing what was meant.
 */
export function parseNumericAnswer(raw: string): number | null {
  const s = raw.trim();
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Whether a response counts as attempted at all. */
export function isAttempted(value: ResponseValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim() !== "";
}

function ruleFor(scheme: MarkingScheme, question: MarkableQuestion): MarkRule {
  const base = scheme[question.key.type];
  return {
    correct: question.rule?.correct ?? base.correct,
    wrong: question.rule?.wrong ?? base.wrong,
  };
}

/** Marks one question. An unattempted question is always 0. */
export function markQuestion(
  question: MarkableQuestion,
  value: ResponseValue | undefined,
  scheme: MarkingScheme
): QuestionMark {
  if (!isAttempted(value)) return { status: "UNATTEMPTED", marks: 0 };

  const rule = ruleFor(scheme, question);
  if (question.bonus) return { status: "CORRECT", marks: rule.correct };

  const right: QuestionMark = { status: "CORRECT", marks: rule.correct };
  const wrong: QuestionMark = { status: "WRONG", marks: rule.wrong };
  const key = question.key;

  switch (key.type) {
    case "SINGLE": {
      const chosen = Array.isArray(value) ? value : [value as string];
      if (chosen.length !== 1) return wrong;
      return key.options.includes(chosen[0]) ? right : wrong;
    }

    case "MULTIPLE": {
      const chosen = new Set(Array.isArray(value) ? value : [value as string]);
      const correct = new Set(key.options);
      if (Array.from(chosen).some((option) => !correct.has(option))) return wrong;
      if (chosen.size === correct.size) return right;
      // Some right options and no wrong ones.
      const partial = scheme.MULTIPLE;
      if (partial.partial === "PER_OPTION" && partial.partialPerOption > 0) {
        return { status: "PARTIAL", marks: chosen.size * partial.partialPerOption };
      }
      return wrong;
    }

    case "INTEGER": {
      if (Array.isArray(value)) return wrong;
      const n = parseNumericAnswer(value as string);
      if (n === null || !Number.isInteger(n)) return wrong;
      return key.values.includes(n) ? right : wrong;
    }

    case "DECIMAL": {
      if (Array.isArray(value)) return wrong;
      const n = parseNumericAnswer(value as string);
      if (n === null) return wrong;
      return n >= key.min && n <= key.max ? right : wrong;
    }
  }
}

/** The most a question can score. */
export function maxMarksFor(question: MarkableQuestion, scheme: MarkingScheme): number {
  return ruleFor(scheme, question).correct;
}

export interface MarkableSection {
  id: string;
  /** In paper order. */
  questions: MarkableQuestion[];
  /**
   * "Attempt any N": only the first N attempted questions, in paper order,
   * are marked; later ones are NOT_COUNTED. null means all of them count.
   */
  attemptLimit?: number | null;
  /** Overrides the test's scheme for this section. */
  scheme?: MarkingScheme | null;
}

export interface SectionMark {
  id: string;
  score: number;
  maxScore: number;
  attempted: number;
  questions: Record<string, QuestionMark>;
}

export interface PaperMark {
  score: number;
  maxScore: number;
  sections: SectionMark[];
}

/**
 * Marks a whole paper.
 *
 * With an attempt limit, the section's maximum is the N best-scoring
 * questions, since that is the most anyone could earn there.
 */
export function markPaper(
  sections: MarkableSection[],
  responses: Record<string, ResponseValue | undefined>,
  testScheme: MarkingScheme
): PaperMark {
  const marked = sections.map((section): SectionMark => {
    const scheme = section.scheme ?? testScheme;
    const limit =
      section.attemptLimit && section.attemptLimit > 0 ? section.attemptLimit : null;

    const questions: Record<string, QuestionMark> = {};
    let score = 0;
    let attempted = 0;

    for (const question of section.questions) {
      const value = responses[question.id];
      if (limit !== null && isAttempted(value) && attempted >= limit) {
        questions[question.id] = { status: "NOT_COUNTED", marks: 0 };
        continue;
      }
      const mark = markQuestion(question, value, scheme);
      if (mark.status !== "UNATTEMPTED") attempted++;
      questions[question.id] = mark;
      score += mark.marks;
    }

    const maxima = section.questions
      .map((q) => maxMarksFor(q, scheme))
      .sort((a, b) => b - a);
    const maxScore = (limit !== null ? maxima.slice(0, limit) : maxima).reduce(
      (sum, m) => sum + m,
      0
    );

    return { id: section.id, score, maxScore, attempted, questions };
  });

  return {
    score: marked.reduce((sum, s) => sum + s.score, 0),
    maxScore: marked.reduce((sum, s) => sum + s.maxScore, 0),
    sections: marked,
  };
}
