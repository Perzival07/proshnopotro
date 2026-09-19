import { describe, it, expect } from "vitest";
import { hitTest, sanitizeAnnotations, strokePath, MAX_ANNOTATIONS } from "./annotations";

const page = { width: 1000, height: 1400 };

describe("sanitizeAnnotations", () => {
  it("keeps well-formed marks", () => {
    const marks = [
      { kind: "pen", color: "red", width: 4, points: [[10, 10], [20, 25]] },
      { kind: "tick", color: "green", x: 100, y: 200, size: 60 },
      { kind: "cross", color: "red", x: 300, y: 400, size: 60 },
      { kind: "text", color: "blue", x: 50, y: 700, size: 32, text: "  Units missing  " },
    ];
    expect(sanitizeAnnotations(marks, page)).toEqual([
      marks[0],
      marks[1],
      marks[2],
      { ...marks[3], text: "Units missing" },
    ]);
  });

  it("keeps points on the page and sizes in range", () => {
    const [pen, tick] = sanitizeAnnotations(
      [
        { kind: "pen", color: "red", width: 999, points: [[-5, 10], [2000, 1500]] },
        { kind: "tick", color: "red", x: 5, y: 5, size: 1 },
      ],
      page
    )!;
    expect(pen).toMatchObject({ points: [[0, 10], [1000, 1400]], width: 70 });
    expect(tick).toMatchObject({ size: 8 });
  });

  it("drops anything malformed rather than storing it", () => {
    expect(
      sanitizeAnnotations(
        [
          { kind: "pen", color: "purple", width: 2, points: [[0, 0], [1, 1]] },
          { kind: "pen", color: "red", width: 2, points: [[0, 0]] },
          { kind: "text", color: "red", x: 1, y: 1, size: 20, text: "   " },
          { kind: "circle", color: "red" },
          { kind: "tick", color: "red", x: "1", y: 1, size: 20 },
          null,
        ],
        page
      )
    ).toEqual([]);
  });

  it("refuses something that is not a list, or far too long", () => {
    expect(sanitizeAnnotations({}, page)).toBeNull();
    expect(sanitizeAnnotations(new Array(MAX_ANNOTATIONS + 1).fill(null), page)).toBeNull();
  });
});

describe("strokePath and hitTest", () => {
  it("draws a path through the points", () => expect(strokePath([[1, 2], [3, 4]])).toBe("M1 2 L3 4"));
  it("finds the mark under a point", () => {
    expect(hitTest({ kind: "tick", color: "red", x: 100, y: 100, size: 40 }, 110, 110, 5)).toBe(true);
    expect(hitTest({ kind: "tick", color: "red", x: 100, y: 100, size: 40 }, 200, 200, 5)).toBe(false);
    expect(hitTest({ kind: "pen", color: "red", width: 4, points: [[0, 0], [50, 50]] }, 51, 49, 5)).toBe(true);
    expect(hitTest({ kind: "text", color: "red", x: 10, y: 50, size: 20, text: "Good" }, 20, 40, 2)).toBe(true);
  });
});
