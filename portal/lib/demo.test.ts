import { describe, expect, it } from "vitest";
import { DEMO_ACCESS_EMAIL, DEMO_SECTIONS, requestAccessHref } from "./demo";
import { markQuestion, SCHEME_PRESETS } from "./marking";

describe("demo sample paper", () => {
  const questions = DEMO_SECTIONS.flatMap((s) => s.questions);

  it("keys every question with its own type", () => {
    for (const q of questions) expect(q.key.type).toBe(q.type);
  });

  it("keys choice questions with options that exist", () => {
    for (const q of questions) {
      if (q.key.type !== "SINGLE" && q.key.type !== "MULTIPLE") continue;
      const ids = q.options.map((o) => o.id);
      expect(q.key.options.every((id) => ids.includes(id))).toBe(true);
    }
  });

  it("gives full marks to the right answers", () => {
    const scheme = SCHEME_PRESETS.JEE_MAIN.scheme;
    const right = ["B", ["A", "C"], "6", "3.14"];
    questions.slice(0, 4).forEach((q, i) => {
      const mark = markQuestion({ id: String(i), key: q.key }, right[i], scheme);
      expect(mark.marks).toBe(4);
    });
  });
});

describe("requestAccessHref", () => {
  it("writes to the demo address with the visitor's email", () => {
    const href = requestAccessHref("a@b.in");
    expect(href.startsWith(`mailto:${DEMO_ACCESS_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain("a@b.in");
  });
});
