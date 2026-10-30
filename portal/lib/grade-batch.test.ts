import { describe, it, expect } from "vitest";
import { groupByOutcome, mapLimit } from "./grade-batch";

describe("groupByOutcome", () => {
  it("collects questions with the same marks and status", () => {
    const groups = groupByOutcome([
      { questionId: "a", marks: 4, status: "CORRECT" },
      { questionId: "b", marks: -1, status: "WRONG" },
      { questionId: "c", marks: 4, status: "CORRECT" },
      { questionId: "d", marks: 0, status: "UNATTEMPTED" },
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.status === "CORRECT")?.questionIds).toEqual(["a", "c"]);
  });

  it("keeps equal marks with different statuses apart", () => {
    expect(
      groupByOutcome([
        { questionId: "a", marks: 0, status: "WRONG" },
        { questionId: "b", marks: 0, status: "UNATTEMPTED" },
      ])
    ).toHaveLength(2);
  });

  it("returns nothing for no responses", () => {
    expect(groupByOutcome([])).toEqual([]);
  });
});

describe("mapLimit", () => {
  it("never runs more than the limit at once and does every item", async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      done.push(n);
    });
    expect(peak).toBe(3);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("stops starting work after a failure and throws the first error", async () => {
    const started: number[] = [];
    await expect(
      mapLimit([1, 2, 3, 4, 5, 6], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(started).toEqual([1, 2]);
  });

  it("handles an empty list", async () => {
    await expect(mapLimit([], 4, async () => {})).resolves.toBeUndefined();
  });
});
