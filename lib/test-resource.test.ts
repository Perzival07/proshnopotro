import { describe, it, expect } from "vitest";
import {
  detectTestFormat, driveFileId, isGoogleFormUrl, isGoogleDocUrl, isValidResourceUrl, toEmbedUrl,
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

describe("Google Drive PDF links", () => {
  const ID = "1AbCdEfGhIjKlMnOpQrStUv";
  const SHARE = `https://drive.google.com/file/d/${ID}/view?usp=sharing`;

  it("reads the file id from the links Drive hands out", () => {
    expect(driveFileId(SHARE)).toBe(ID);
    expect(driveFileId(`https://drive.google.com/file/d/${ID}`)).toBe(ID);
    expect(driveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
    expect(driveFileId(`https://drive.google.com/uc?id=${ID}&export=download`)).toBe(ID);
  });

  it.each([
    "",
    "not a url",
    `http://drive.google.com/file/d/${ID}/view`,
    `https://evil.com/file/d/${ID}/view`,
    `https://drive.google.com.evil.com/file/d/${ID}/view`,
    "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp",
    "https://drive.google.com/file/d/short/view",
  ])("rejects %j", (u) => expect(driveFileId(u)).toBeNull());

  it("is the only link a PDF test accepts", () => {
    expect(isValidResourceUrl(SHARE, "PDF")).toBe(true);
    expect(isValidResourceUrl(DOC, "PDF")).toBe(false);
    expect(isValidResourceUrl(SHARE, "GOOGLE_DOC")).toBe(false);
  });

  it("embeds through Drive's preview viewer, dropping the sharing query", () => {
    expect(toEmbedUrl(SHARE, "PDF")).toBe(`https://drive.google.com/file/d/${ID}/preview`);
    expect(toEmbedUrl(DOC, "PDF")).toBeNull();
  });
});

describe("detectTestFormat", () => {
  it("reads a form link as a Google Form", () => {
    expect(detectTestFormat(FORM)).toBe("GOOGLE_FORM");
    expect(detectTestFormat("https://forms.gle/abc123")).toBe("GOOGLE_FORM");
  });
  it("reads docs, slides and sheets as a Google Doc", () => {
    expect(detectTestFormat(DOC)).toBe("GOOGLE_DOC");
    expect(detectTestFormat("https://docs.google.com/presentation/d/x/edit")).toBe("GOOGLE_DOC");
  });
  it("reads a Drive file link as a PDF", () => {
    expect(detectTestFormat("https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing")).toBe("PDF");
    expect(detectTestFormat("https://drive.google.com/open?id=1AbCdEfGhIjK")).toBe("PDF");
  });
  it.each([
    "",
    "not a url",
    "https://example.com/paper.pdf",
    "https://drive.google.com/drive/folders/1AbCdEfGhIjK",
    "http://docs.google.com/document/d/x/edit",
    "https://docs.google.com.evil.com/forms/d/e/x/viewform",
  ])("recognises nothing in %j", (u) => expect(detectTestFormat(u)).toBeNull());
});
