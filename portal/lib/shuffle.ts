/**
 * A different paper order for each student.
 *
 * With `Test.shuffle` on, every attempt sees the questions (and the choices of
 * a multiple-choice question) in an order of its own, so an answer key passed
 * around the room does not line up. Marking is by question and option id, so
 * none of this touches scoring.
 *
 * The order is a pure function of a seed -- the assignment id -- so a reload,
 * a second device and the student's own result page all show the same paper.
 * Nothing is stored. Pure functions only, so each rule can be tested alone.
 */

import { parseOptions, type OptionRow, type QuestionRow } from "./paper";

/** A 32-bit hash of a string (cyrb53, folded), to seed the generator. */
export function hashSeed(seed: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** mulberry32: a small, fast seeded generator returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates over a copy. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Whether an option's wording points at the other options ("All of the
 * above", "Both A and B", "Neither"), which would make no sense reordered.
 * Erring towards true is safe: a question that is not shuffled is merely
 * shown in the tutor's own order.
 */
export function referencesOtherOptions(options: readonly OptionRow[]): boolean {
  const pattern =
    /\b(all|none|both|neither|any)\b[^.]{0,20}\b(above|these|the following|of them)\b|\bboth\b|\bneither\b|\babove\b|\bbelow\b|\boptions?\s*\(?[a-h]\b|\(\s*[a-h]\s*\)\s*(and|&|,|or)\b|\b[a-h]\s*(and|&)\s*[a-h]\b|\bnone of\b|\ball of\b/i;
  return options.some((o) => pattern.test(o.text));
}

const SHUFFLED_OPTION_TYPES = new Set(["SINGLE", "MULTIPLE"]);

/**
 * The options of one question in this seed's order. Only single- and
 * multiple-choice lists are touched (a matrix's columns and a numeric
 * answer's none stay as written), and never one that refers to the others.
 * Seeded by the question as well, so the order does not depend on where the
 * question landed in the paper.
 */
export function shuffleOptions(
  question: { id: string; type: string; options: unknown },
  seed: string
): unknown {
  // Anything not reordered is handed back exactly as stored -- a matrix keeps
  // its { rows, columns } object.
  if (!SHUFFLED_OPTION_TYPES.has(question.type)) return question.options;
  const options = parseOptions(question.options);
  if (options.length < 2 || referencesOtherOptions(options)) return question.options;
  return shuffled(options, mulberry32(hashSeed(`${seed}:options:${question.id}`)));
}

type Orderable = Pick<QuestionRow, "id" | "position" | "passageId" | "choiceGroup">;

/**
 * One section's questions in this seed's order.
 *
 * Two things must stay together: the alternatives of an internal choice
 * ("Q16 ... OR ...", kept in their own order), and the questions under one
 * passage (the passage is printed once, above the first of them). So the
 * shuffle moves whole blocks -- a passage's questions, or a lone question --
 * and, inside a passage, whole internal-choice groups. Positions are
 * rewritten 0..n-1 in the new order, so anything that sorts by position (the
 * paper's numbering does) sees the shuffled order.
 */
export function shuffleQuestions<Q extends Orderable>(questions: readonly Q[], seed: string): Q[] {
  const sorted = [...questions].sort((a, b) => a.position - b.position);

  // Units: a lone question, or a run of one internal choice.
  const units: Q[][] = [];
  for (const q of sorted) {
    const last = units[units.length - 1];
    if (last && q.choiceGroup && last[last.length - 1].choiceGroup === q.choiceGroup) last.push(q);
    else units.push([q]);
  }

  // Blocks: a run of units under one passage, or a lone unit.
  const blocks: Q[][][] = [];
  for (const unit of units) {
    const last = blocks[blocks.length - 1];
    const passage = unit[0].passageId;
    if (last && passage && last[last.length - 1][0].passageId === passage) last.push(unit);
    else blocks.push([unit]);
  }

  const random = mulberry32(hashSeed(`${seed}:questions`));
  return shuffled(blocks, random)
    .flatMap((block) => shuffled(block, random).flat())
    .map((q, position) => ({ ...q, position }));
}

/**
 * The paper's sections with every question in this seed's order and every
 * choice list reordered. Sections keep their own order -- sections are timed
 * and instructed as a unit. Feed the result to `toStudentPaper`, which then
 * numbers the questions straight through the order shown.
 */
export function shuffleSections<S extends { questions: readonly (Orderable & { type: string; options: unknown })[] }>(
  sections: readonly S[],
  seed: string
): S[] {
  return sections.map((section) => ({
    ...section,
    questions: shuffleQuestions(section.questions, seed).map((q) => ({ ...q, options: shuffleOptions(q, seed) })),
  })) as unknown as S[];
}
