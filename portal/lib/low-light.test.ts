import { describe, expect, it } from "vitest";
import { brightenIfDark, lowLightTable } from "@/lib/low-light";

/** An RGBA frame whose grey pixels cycle through `values`. */
function frame(values: number[], pixels = 4000): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels * 4);
  for (let p = 0; p < pixels; p++) {
    const v = values[p % values.length];
    data.set([v, v, v, 255], p * 4);
  }
  return data;
}

function mean(data: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i];
  return sum / (data.length / 4);
}

describe("lowLightTable", () => {
  it("leaves a well-lit frame alone", () => {
    expect(lowLightTable(frame([60, 120, 200]))).toBeNull();
  });

  it("brightens a dark frame towards the target", () => {
    const data = frame([5, 10, 15, 20, 25, 30]);
    expect(brightenIfDark(data)).toBe(true);
    expect(mean(data)).toBeGreaterThan(90);
  });

  it("keeps the order of brightness, so the face keeps its shape", () => {
    const table = lowLightTable(frame([4, 8, 12, 16, 20, 40]))!;
    for (let v = 1; v < 256; v++) expect(table[v]).toBeGreaterThanOrEqual(table[v - 1]);
    expect(table[4]).toBeLessThan(table[20]);
  });

  it("leaves a black frame black rather than amplifying its noise", () => {
    // A covered lens: a flicker of 1-2 levels.
    expect(lowLightTable(frame([0, 1, 2, 1]))).toBeNull();
  });

  it("does not stretch a faint picture all the way to white", () => {
    const table = lowLightTable(frame([0, 2, 4, 6, 8]))!;
    expect(table[8]).toBeLessThan(200);
  });

  it("leaves the alpha channel alone", () => {
    const data = frame([10, 20]);
    brightenIfDark(data);
    expect(data[3]).toBe(255);
  });
});
