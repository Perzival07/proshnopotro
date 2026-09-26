/**
 * The numbers students and parents look for after a test: rank and
 * percentile among the tutor's students, accuracy, time, and what negative
 * marking cost. Pure functions of marks already worked out, so they always
 * agree with the score.
 */

import type { PaperMark, QuestionStatus } from "./marking";

export interface AttemptSummary {
  /** Questions answered on screen (written answers are not counted here). */
  attempted: number;
  correct: number;
  partial: number;
  wrong: number;
  unattempted: number;
  /** Right answers out of those attempted, 0-1; null with nothing attempted. */
  accuracy: number | null;
  /** Marks lost to wrong answers, as a positive number. */
  negativeLost: number;
}

const ON_SCREEN: QuestionStatus[] = ["CORRECT", "PARTIAL", "WRONG"];

export function summarizeAttempt(marked: PaperMark): AttemptSummary {
  const s: AttemptSummary = { attempted: 0, correct: 0, partial: 0, wrong: 0, unattempted: 0, accuracy: null, negativeLost: 0 };
  for (const section of marked.sections) {
    for (const m of Object.values(section.questions)) {
      if (ON_SCREEN.includes(m.status)) s.attempted++;
      if (m.status === "CORRECT") s.correct++;
      if (m.status === "PARTIAL") s.partial++;
      if (m.status === "WRONG") s.wrong++;
      if (m.status === "UNATTEMPTED") s.unattempted++;
      if (m.marks < 0) s.negativeLost += -m.marks;
    }
  }
  s.accuracy = s.attempted ? (s.correct + s.partial * 0.5) / s.attempted : null;
  s.negativeLost = Number(s.negativeLost.toFixed(2));
  return s;
}

export interface Standing {
  /** 1 for the top score; students with equal scores share a rank. */
  rank: number;
  of: number;
  /**
   * NTA-style percentile: the share of students who scored the same or
   * less, out of 100. The top scorer is at 100.
   */
  percentile: number;
}

export function standing(allScores: number[], mine: number): Standing | null {
  if (allScores.length === 0) return null;
  const above = allScores.filter((s) => s > mine + 1e-9).length;
  const atOrBelow = allScores.filter((s) => s <= mine + 1e-9).length;
  return {
    rank: above + 1,
    of: allScores.length,
    percentile: Math.round((1000 * atOrBelow) / allScores.length) / 10,
  };
}

/** "1 h 5 m", "4 m 20 s", "35 s". */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h} h ${m} m`;
  if (m) return `${m} m${s ? ` ${s} s` : ""}`;
  return `${s} s`;
}

/** Strong at 75% and above, needs work below 40%. */
export function chapterVerdict(scored: number, max: number): "strong" | "ok" | "weak" | null {
  if (max <= 0) return null;
  const p = scored / max;
  return p >= 0.75 ? "strong" : p < 0.4 ? "weak" : "ok";
}
