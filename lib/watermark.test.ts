import { describe, it, expect } from "vitest";
import { watermarkBackground, watermarkText } from "./watermark";

describe("watermarkText", () => {
  it("joins name and lower-cased email", () => {
    expect(watermarkText("Asha Rao", "Asha@Example.com")).toBe("Asha Rao · asha@example.com");
  });

  it("copes with a missing name or email", () => {
    expect(watermarkText(null, "a@b.co")).toBe("a@b.co");
    expect(watermarkText("  ", undefined)).toBe("");
  });
});

describe("watermarkBackground", () => {
  it("escapes markup in the text so it cannot break out of the SVG", () => {
    const css = decodeURIComponent(watermarkBackground(`</text><script>"x"&`));
    expect(css).not.toContain("<script>");
    expect(css).toContain("&lt;script&gt;");
    expect(css).toContain("&amp;");
  });

  it("is a url() value with a data SVG", () => {
    expect(watermarkBackground("x")).toMatch(/^url\("data:image\/svg\+xml;utf8,/);
  });
});
