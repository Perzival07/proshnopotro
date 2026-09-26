import { describe, it, expect } from "vitest";
import { assessTiming, FAST_ANSWER_MS, MIN_ANSWERED_FOR_TIMING } from "./answer-timing";

const many = (n: number, ms: number, answered = true) =>
  Array.from({ length: n }, () => ({ answered, timeSpentMs: ms }));

describe("assessTiming", () => {
  it("flags a paper clicked through in seconds a question", () => {
    const r = assessTiming(many(20, 1500));
    expect(r).toEqual({ answered: 20, fast: 20, flagged: true });
  });

  it("does not flag an attempt that took a normal time", () => {
    expect(assessTiming(many(20, 45_000)).flagged).toBe(false);
  });

  it("needs enough answers to mean anything", () => {
    expect(assessTiming(many(MIN_ANSWERED_FOR_TIMING - 1, 500)).flagged).toBe(false);
  });

  it("ignores questions that were only viewed", () => {
    const r = assessTiming([...many(20, 500, false), ...many(10, 60_000)]);
    expect(r.answered).toBe(10);
    expect(r.flagged).toBe(false);
  });

  it("does not flag when only a minority were quick", () => {
    expect(assessTiming([...many(5, FAST_ANSWER_MS - 1), ...many(10, 30_000)]).flagged).toBe(false);
  });
});
