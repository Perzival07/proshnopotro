import { describe, it, expect } from "vitest";
import { parseRichText } from "./rich-text";

describe("parseRichText", () => {
  it("leaves plain text alone", () =>
    expect(parseRichText("Find the force.")).toEqual([{ kind: "text", text: "Find the force." }]));

  it("reads inline and displayed maths", () =>
    expect(parseRichText("If $x^2 = 4$ then $$x = \\pm 2$$ done")).toEqual([
      { kind: "text", text: "If " },
      { kind: "math", tex: "x^2 = 4", display: false },
      { kind: "text", text: " then " },
      { kind: "math", tex: "x = \\pm 2", display: true },
      { kind: "text", text: " done" },
    ]));

  it("reads \\( \\) and \\[ \\] delimiters", () =>
    expect(parseRichText("\\(a\\) and \\[b\\]")).toEqual([
      { kind: "math", tex: "a", display: false },
      { kind: "text", text: " and " },
      { kind: "math", tex: "b", display: true },
    ]));

  it("keeps chemistry inside maths", () =>
    expect(parseRichText("$\\ce{2H2 + O2 -> 2H2O}$")).toEqual([
      { kind: "math", tex: "\\ce{2H2 + O2 -> 2H2O}", display: false },
    ]));

  it("reads an https image", () =>
    expect(parseRichText("See ![circuit](https://res.cloudinary.com/x/a.png) above")).toEqual([
      { kind: "text", text: "See " },
      { kind: "image", alt: "circuit", url: "https://res.cloudinary.com/x/a.png" },
      { kind: "text", text: " above" },
    ]));

  it("ignores images that are not https", () =>
    expect(parseRichText("![x](http://a.com/i.png)")).toEqual([
      { kind: "text", text: "![x](http://a.com/i.png)" },
    ]));

  it("treats an escaped or unmatched dollar as text", () => {
    expect(parseRichText("costs \\$5")).toEqual([{ kind: "text", text: "costs $5" }]);
    expect(parseRichText("costs $5")).toEqual([{ kind: "text", text: "costs $5" }]);
  });

  it("does not let inline maths run across a blank line", () =>
    expect(parseRichText("a $b\n\nc$ d")).toEqual([{ kind: "text", text: "a $b\n\nc$ d" }]));
});
