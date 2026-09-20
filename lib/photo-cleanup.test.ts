import { describe, it, expect } from "vitest";
import { classifyDeletion, inBatches } from "./photo-cleanup";

describe("classifyDeletion", () => {
  it("counts deleted and already-missing files as gone, anything else as failed", () => {
    expect(classifyDeletion(["a", "b", "c", "d"], { a: "deleted", b: "not_found", c: "error", d: "deleted" })).toEqual({
      gone: ["a", "b", "d"],
      failed: ["c"],
    });
  });
  it("treats a file with no answer as failed, so its row is kept", () => {
    expect(classifyDeletion(["a"], {})).toEqual({ gone: [], failed: ["a"] });
    expect(classifyDeletion(["a"], null)).toEqual({ gone: [], failed: ["a"] });
  });
});

describe("inBatches", () => {
  it("splits into batches of at most 100", () => {
    const batches = inBatches(Array.from({ length: 250 }, (_, i) => i));
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
  });
  it("gives nothing for nothing", () => expect(inBatches([])).toEqual([]));
});
