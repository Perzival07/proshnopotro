import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * The admin layout lets tutors in, so it cannot keep them out of the owner's
 * pages: each page and each server action has to. This walks the source and
 * fails when one forgets, or when a tutor is let in anywhere but the marking
 * and doubts code.
 */

const ROOT = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(ROOT, p).split("\\").join("/");

/** Pages tutors may open (and so must call requireStaff, not requireAdmin). */
const TUTOR_PAGES = new Set([
  "app/admin/marking/page.tsx",
  "app/admin/mark/[assignmentId]/page.tsx",
  "app/admin/tests/[testId]/marking/page.tsx",
  "app/admin/doubts/page.tsx",
]);

/** Server actions tutors may call: [file, function]. */
const TUTOR_ACTIONS = new Set([
  "app/admin/mark/actions.ts:saveAnnotations",
  "app/admin/mark/actions.ts:saveWrittenMark",
  "app/admin/mark/actions.ts:saveTotalMarks",
  "app/admin/mark/actions.ts:saveOverallFeedback",
  "app/admin/mark/actions.ts:setReturned",
  "app/doubts/actions.ts:replyToDoubt",
  "app/doubts/actions.ts:setDoubtStatus",
]);

/** Actions for a signed-in student, guarded as such. */
const STUDENT_ACTIONS = new Set(["app/doubts/actions.ts:askDoubt", "app/doubts/actions.ts:setDoubtResolved"]);

const GUARD = /\b(requireAdmin|requireStaff|requireCompleteStudent)\(/;

describe("admin pages", () => {
  const pages = walk(join(ROOT, "app/admin")).filter((p) => p.endsWith("/page.tsx"));

  it("finds the pages", () => expect(pages.length).toBeGreaterThan(10));

  for (const page of pages) {
    const name = rel(page);
    const src = readFileSync(page, "utf8");
    if (TUTOR_PAGES.has(name)) {
      it(`${name} is for tutors too, and says so`, () => {
        expect(src).toMatch(/requireStaff\(/);
        expect(src).not.toMatch(/requireAdmin\(/);
      });
    } else {
      it(`${name} is owner-only`, () => {
        expect(src).toMatch(/requireAdmin\(/);
        expect(src).not.toMatch(/requireStaff\(/);
      });
    }
  }
});

describe("server actions", () => {
  const files = [...walk(join(ROOT, "app/admin")).filter((p) => p.endsWith("/actions.ts")), join(ROOT, "app/doubts/actions.ts")];

  for (const file of files) {
    const name = rel(file);
    const src = readFileSync(file, "utf8");
    const parts = src.split(/^export async function (\w+)/m);
    // parts: [preamble, name1, body1, name2, body2, ...]
    for (let i = 1; i < parts.length; i += 2) {
      const fn = parts[i];
      const body = parts[i + 1];
      const key = `${name}:${fn}`;
      it(`${key} checks who is calling before touching data`, () => {
        const guard = body.match(GUARD);
        expect(guard, "no requireAdmin / requireStaff / requireCompleteStudent call").not.toBeNull();
        const firstData = body.search(/\bprisma\./);
        if (firstData !== -1) expect(guard!.index!).toBeLessThan(firstData);
        if (STUDENT_ACTIONS.has(key)) expect(guard![1]).toBe("requireCompleteStudent");
        else if (TUTOR_ACTIONS.has(key)) expect(guard![1]).toBe("requireStaff");
        else expect(guard![1], "only marking and doubts may let a tutor in").toBe("requireAdmin");
      });
    }
  }
});
