import { describe, it, expect } from "vitest";
import {
  isGoogleFormUrl, isGoogleDocUrl, isValidResourceUrl, toEmbedUrl,
} from "./test-resource";

const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSc/viewform";
const DOC  = "https://docs.google.com/document/d/1AbCdEf/edit";

describe("isGoogleFormUrl", () => {
  it("accepts a real form URL", () => expect(isGoogleFormUrl(FORM)).toBe(true));
  it("accepts a forms.gle shortlink", () =>
    expect(isGoogleFormUrl("https://forms.gle/abc123")).toBe(true));
  it("rejects a Doc URL", () => expect(isGoogleFormUrl(DOC)).toBe(false));
  it.each(["", "not a url", "http://docs.google.com/forms/d/e/x/viewform", "https://evil.com/forms/d/e/x"])(
    "rejects %j", (u) => expect(isGoogleFormUrl(u)).toBe(false));
});

describe("isGoogleDocUrl", () => {
  it("accepts a doc", () => expect(isGoogleDocUrl(DOC)).toBe(true));
  it("accepts slides and sheets", () => {
    expect(isGoogleDocUrl("https://docs.google.com/presentation/d/x/edit")).toBe(true);
    expect(isGoogleDocUrl("https://docs.google.com/spreadsheets/d/x/edit")).toBe(true);
  });
  it("rejects a form", () => expect(isGoogleDocUrl(FORM)).toBe(false));
  it("rejects a lookalike host", () =>
    expect(isGoogleDocUrl("https://docs.google.com.evil.com/document/d/x/edit")).toBe(false));
});

describe("isValidResourceUrl", () => {
  it("pairs the url with the declared format", () => {
    expect(isValidResourceUrl(FORM, "GOOGLE_FORM")).toBe(true);
    expect(isValidResourceUrl(DOC, "GOOGLE_DOC")).toBe(true);
    // A doc pasted into a form-typed test must not slip through.
    expect(isValidResourceUrl(DOC, "GOOGLE_FORM")).toBe(false);
    expect(isValidResourceUrl(FORM, "GOOGLE_DOC")).toBe(false);
  });
});

describe("toEmbedUrl", () => {
  it("adds embedded=true to a form", () => {
    expect(toEmbedUrl(FORM, "GOOGLE_FORM")).toBe(
      "https://docs.google.com/forms/d/e/1FAIpQLSc/viewform?embedded=true");
  });
  it("does not duplicate embedded=true", () => {
    const once = toEmbedUrl(FORM + "?embedded=true", "GOOGLE_FORM")!;
    expect(once.match(/embedded=true/g)).toHaveLength(1);
  });
  it("preserves existing query params such as prefill", () => {
    const out = toEmbedUrl(FORM + "?usp=pp_url&entry.1=a@b.com", "GOOGLE_FORM")!;
    expect(out).toContain("entry.1=a%40b.com");
    expect(out).toContain("embedded=true");
  });
  it("returns null for a forms.gle shortlink, which cannot be framed", () => {
    expect(toEmbedUrl("https://forms.gle/abc123", "GOOGLE_FORM")).toBeNull();
  });
  it("rewrites a doc /edit to /preview", () => {
    expect(toEmbedUrl(DOC, "GOOGLE_DOC")).toBe(
      "https://docs.google.com/document/d/1AbCdEf/preview");
  });
  it("rewrites /view to /preview and drops query and hash", () => {
    expect(toEmbedUrl("https://docs.google.com/document/d/1AbCdEf/view?usp=sharing#heading=h.1", "GOOGLE_DOC"))
      .toBe("https://docs.google.com/document/d/1AbCdEf/preview");
  });
  it("appends /preview when the URL has no trailing verb", () => {
    expect(toEmbedUrl("https://docs.google.com/document/d/1AbCdEf", "GOOGLE_DOC"))
      .toBe("https://docs.google.com/document/d/1AbCdEf/preview");
  });
  it("is idempotent on an already-preview URL", () => {
    const p = "https://docs.google.com/document/d/1AbCdEf/preview";
    expect(toEmbedUrl(p, "GOOGLE_DOC")).toBe(p);
  });
  it("returns null on garbage or a mismatched format", () => {
    expect(toEmbedUrl("nonsense", "GOOGLE_DOC")).toBeNull();
    expect(toEmbedUrl(DOC, "GOOGLE_FORM")).toBeNull();
  });
});
