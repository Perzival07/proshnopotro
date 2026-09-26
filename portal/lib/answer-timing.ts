/**
 * Whether an attempt was answered too fast to have been read.
 *
 * Every question on a paper written in the portal records how long it was on
 * screen (`QuestionResponse.timeSpentMs`). Someone copying from an answer key
 * clicks through in a few seconds a question, well under what a person needs
 * to read one. This is a hint for the tutor, never a verdict, so it only
 * flags a clear pattern: enough answered questions, and most of them near-instant.
 */

/** Answered questions needed before a pattern means anything. */
export const MIN_ANSWERED_FOR_TIMING = 8;
/** A question answered in under this was not read, in ms. */
export const FAST_ANSWER_MS = 4000;
/** The share of answered questions that must be that fast to flag the attempt. */
export const FAST_SHARE_TO_FLAG = 0.6;

export interface TimedAnswer {
  /** Whether the student gave an answer (as opposed to only viewing it). */
  answered: boolean;
  timeSpentMs: number;
}

export interface TimingAssessment {
  answered: number;
  /** Answered questions that were on screen for under FAST_ANSWER_MS. */
  fast: number;
  flagged: boolean;
}

export function assessTiming(answers: TimedAnswer[]): TimingAssessment {
  const answered = answers.filter((a) => a.answered);
  const fast = answered.filter((a) => a.timeSpentMs < FAST_ANSWER_MS).length;
  const flagged =
    answered.length >= MIN_ANSWERED_FOR_TIMING && fast / answered.length >= FAST_SHARE_TO_FLAG;
  return { answered: answered.length, fast, flagged };
}
