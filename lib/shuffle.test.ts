import { describe, it, expect } from "vitest";
import {
  hashSeed,
  mulberry32,
  referencesOtherOptions,
  shuffleOptions,
  shuffleQuestions,
  shuffleSections,
} from "./shuffle";

type Q = { id: string; position: number; passageId: string | null; choiceGroup: string | null };

const q = (id: string, position: number, passageId: string | null = null, choiceGroup: string | null = null): Q => ({
  id,
  position,
  passageId,
  choiceGroup,
});

const plain = Array.from({ length: 12 }, (_, i) => q(`q${i}`, i));
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("mulberry32 / hashSeed", () => {
  it("is deterministic and stays inside [0, 1)", () => {
    const a = mulberry32(hashSeed("abc"));
    const b = mulberry32(hashSeed("abc"));
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("gives different seeds different streams", () => {
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });
});

describe("shuffleQuestions", () => {
  it("gives the same order for the same seed", () => {
    expect(ids(shuffleQuestions(plain, "s1"))).toEqual(ids(shuffleQuestions(plain, "s1")));
  });

  it("gives different orders for different seeds", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 40; i++) orders.add(ids(shuffleQuestions(plain, `seed-${i}`)).join());
    expect(orders.size).toBeGreaterThan(30);
  });

  it("is a permutation: nothing lost or duplicated, positions rewritten 0..n-1", () => {
    const out = shuffleQuestions(plain, "x");
    expect([...ids(out)].sort()).toEqual([...ids(plain)].sort());
    expect(out.map((o) => o.position)).toEqual(plain.map((_, i) => i));
  });

  it("does not depend on the order the rows arrive in", () => {
    const reversed = [...plain].reverse();
    expect(ids(shuffleQuestions(reversed, "s"))).toEqual(ids(shuffleQuestions(plain, "s")));
  });

  it("keeps the questions under one passage together", () => {
    const paper = [
      q("a", 0),
      q("p1", 1, "P"),
      q("p2", 2, "P"),
      q("p3", 3, "P"),
      q("b", 4),
      q("c", 5),
      q("r1", 6, "R"),
      q("r2", 7, "R"),
    ];
    for (let i = 0; i < 60; i++) {
      const order = ids(shuffleQuestions(paper, `seed-${i}`));
      for (const group of [["p1", "p2", "p3"], ["r1", "r2"]]) {
        const at = group.map((id) => order.indexOf(id)).sort((x, y) => x - y);
        expect(at[at.length - 1] - at[0]).toBe(group.length - 1);
      }
    }
  });

  it("keeps the alternatives of an internal choice together and in their own order", () => {
    const paper = [q("a", 0), q("x1", 1, null, "G"), q("x2", 2, null, "G"), q("b", 3), q("c", 4), q("d", 5)];
    for (let i = 0; i < 60; i++) {
      const order = ids(shuffleQuestions(paper, `seed-${i}`));
      expect(order.indexOf("x2")).toBe(order.indexOf("x1") + 1);
    }
  });

  it("keeps an internal choice inside a passage together, within the passage", () => {
    const paper = [q("p1", 0, "P"), q("g1", 1, "P", "G"), q("g2", 2, "P", "G"), q("z", 3), q("y", 4)];
    for (let i = 0; i < 60; i++) {
      const order = ids(shuffleQuestions(paper, `seed-${i}`));
      expect(order.indexOf("g2")).toBe(order.indexOf("g1") + 1);
      const at = ["p1", "g1", "g2"].map((id) => order.indexOf(id)).sort((x, y) => x - y);
      expect(at[2] - at[0]).toBe(2);
    }
  });
});

describe("shuffleOptions", () => {
  const options = ["A", "B", "C", "D"].map((id) => ({ id, text: `value ${id}` }));

  it("is deterministic per seed and question, and a permutation of the same options", () => {
    const one = shuffleOptions({ id: "q1", type: "SINGLE", options }, "s") as typeof options;
    expect(shuffleOptions({ id: "q1", type: "SINGLE", options }, "s")).toEqual(one);
    expect(one.map((o) => o.id).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("reorders for at least some seeds", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 30; i++) {
      orders.add((shuffleOptions({ id: "q1", type: "MULTIPLE", options }, `s${i}`) as typeof options).map((o) => o.id).join());
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it("leaves a matrix question's options exactly as stored", () => {
    const matrix = { rows: [{ id: "P", text: "p" }, { id: "Q", text: "q" }], columns: [{ id: "1", text: "one" }] };
    expect(shuffleOptions({ id: "m", type: "MATRIX", options: matrix }, "s")).toBe(matrix);
  });

  it("leaves numeric and written questions alone", () => {
    expect(shuffleOptions({ id: "n", type: "INTEGER", options: [] }, "s")).toEqual([]);
    expect(shuffleOptions({ id: "w", type: "SUBJECTIVE", options: [] }, "s")).toEqual([]);
  });

  it("leaves a list that refers to its own options as written", () => {
    const risky = [
      { id: "A", text: "Only 1" },
      { id: "B", text: "Only 2" },
      { id: "C", text: "Both A and B" },
      { id: "D", text: "None of the above" },
    ];
    for (let i = 0; i < 20; i++) {
      expect(shuffleOptions({ id: "q", type: "SINGLE", options: risky }, `s${i}`)).toBe(risky);
    }
  });
});

describe("referencesOtherOptions", () => {
  it("spots the usual give-aways", () => {
    for (const text of ["All of the above", "none of the above", "Both (a) and (b)", "Neither", "A and B", "Option C"]) {
      expect(referencesOtherOptions([{ id: "A", text }])).toBe(true);
    }
  });

  it("passes ordinary answers", () => {
    expect(referencesOtherOptions([{ id: "A", text: "9.8 m/s^2" }, { id: "B", text: "Newton" }])).toBe(false);
  });
});

describe("shuffleSections", () => {
  const section = (id: string, questions: object[]) => ({ id, title: id, questions });
  const sections = [
    section("s1", [
      { id: "a", position: 0, type: "SINGLE", passageId: null, choiceGroup: null, options: [{ id: "A", text: "1" }, { id: "B", text: "2" }] },
      { id: "b", position: 1, type: "MATRIX", passageId: null, choiceGroup: null, options: { rows: [], columns: [] } },
      { id: "c", position: 2, type: "INTEGER", passageId: null, choiceGroup: null, options: [] },
    ]),
    section("s2", [{ id: "d", position: 0, type: "SINGLE", passageId: null, choiceGroup: null, options: [{ id: "A", text: "1" }, { id: "B", text: "2" }] }]),
  ];

  it("keeps sections in order and every question in its own section", () => {
    const out = shuffleSections(sections as never, "seed") as unknown as { id: string; questions: { id: string }[] }[];
    expect(out.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(ids(out[0].questions).sort()).toEqual(["a", "b", "c"]);
    expect(ids(out[1].questions)).toEqual(["d"]);
  });

  it("does not mutate its input", () => {
    const before = JSON.stringify(sections);
    shuffleSections(sections as never, "seed");
    expect(JSON.stringify(sections)).toBe(before);
  });
});
