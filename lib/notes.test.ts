import { describe, it, expect } from "vitest";
import {
  cleanFileName,
  formatBytes,
  isAllowedNoteFormat,
  isInNoteFolder,
  isNoteVisible,
  isValidNoteLink,
  noteFolder,
  noteState,
  publishBlocker,
  resourceTypeFor,
  validateNote,
} from "./notes";

const NOW = new Date("2026-09-16T10:00:00Z");

describe("isAllowedNoteFormat", () => {
  it("accepts photos and PDFs, however the extension is written", () => {
    expect(isAllowedNoteFormat("jpg")).toBe(true);
    expect(isAllowedNoteFormat(".PNG")).toBe(true);
    expect(isAllowedNoteFormat("pdf")).toBe(true);
    expect(isAllowedNoteFormat("HEIC")).toBe(true);
  });

  it("rejects anything a student's phone could not open", () => {
    expect(isAllowedNoteFormat("exe")).toBe(false);
    expect(isAllowedNoteFormat("zip")).toBe(false);
    expect(isAllowedNoteFormat("")).toBe(false);
  });
});

describe("resourceTypeFor", () => {
  it("stores PDFs as raw so account-level PDF blocking cannot hide them", () => {
    expect(resourceTypeFor("pdf")).toBe("raw");
    expect(resourceTypeFor(".PDF")).toBe("raw");
  });

  it("stores photos as images, which can be thumbnailed", () => {
    expect(resourceTypeFor("jpg")).toBe("image");
    expect(resourceTypeFor("png")).toBe("image");
  });
});

describe("isInNoteFolder", () => {
  const noteId = "note123";

  it("accepts a public id inside this note's own folder", () => {
    expect(isInNoteFolder(`${noteFolder(noteId)}/page-1`, noteId)).toBe(true);
  });

  it("refuses another note's folder, the bare folder and traversal", () => {
    expect(isInNoteFolder(`${noteFolder("other")}/page-1`, noteId)).toBe(false);
    expect(isInNoteFolder(noteFolder(noteId), noteId)).toBe(false);
    expect(isInNoteFolder(`${noteFolder(noteId)}/../other/page-1`, noteId)).toBe(false);
  });
});

describe("noteState", () => {
  it("is a draft with no publish time", () => {
    expect(noteState({ publishedAt: null }, NOW)).toBe("DRAFT");
  });

  it("is scheduled while the publish time is still ahead", () => {
    expect(noteState({ publishedAt: "2026-09-16T18:00:00Z" }, NOW)).toBe("SCHEDULED");
    expect(isNoteVisible({ publishedAt: "2026-09-16T18:00:00Z" }, NOW)).toBe(false);
  });

  it("is published from the instant it is due, for everyone at once", () => {
    expect(noteState({ publishedAt: "2026-09-16T10:00:00Z" }, NOW)).toBe("PUBLISHED");
    expect(isNoteVisible({ publishedAt: "2026-09-16T09:59:59Z" }, NOW)).toBe(true);
  });
});

describe("isValidNoteLink", () => {
  it("accepts ordinary https links", () => {
    expect(isValidNoteLink("https://drive.google.com/file/d/abc/view")).toBe(true);
    expect(isValidNoteLink("  https://youtu.be/xyz  ")).toBe(true);
  });

  it("rejects anything that is not a plain https address", () => {
    expect(isValidNoteLink("http://drive.google.com/x")).toBe(false);
    expect(isValidNoteLink("javascript:alert(1)")).toBe(false);
    expect(isValidNoteLink("drive.google.com/x")).toBe(false);
    expect(isValidNoteLink("https://localhost/x")).toBe(false);
  });
});

describe("validateNote", () => {
  it("normalizes the fields and defaults the icon", () => {
    const res = validateNote({ title: "  Ch 7  ", subject: " Physics " });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({
      title: "Ch 7",
      subject: "Physics",
      description: null,
      iconName: "FileText",
      linkUrl: null,
    });
  });

  it("requires a title and a subject", () => {
    expect(validateNote({ title: "", subject: "Physics" }).ok).toBe(false);
    expect(validateNote({ title: "Ch 7", subject: "  " }).ok).toBe(false);
  });

  it("rejects a link that is not https", () => {
    const res = validateNote({ title: "Ch 7", subject: "Physics", linkUrl: "www.x.com" });
    expect(res.ok).toBe(false);
  });
});

describe("publishBlocker", () => {
  const shared = { classroomCount: 1, studentCount: 0 };

  it("passes a note with a file and an audience", () => {
    expect(publishBlocker({ fileCount: 2, ...shared })).toBeNull();
  });

  it("passes a link-only note", () => {
    expect(publishBlocker({ fileCount: 0, linkUrl: "https://x.com/a", ...shared })).toBeNull();
  });

  it("refuses an empty note", () => {
    expect(publishBlocker({ fileCount: 0, ...shared })).toMatch(/file or a link/);
  });

  it("refuses a note nobody would receive", () => {
    expect(
      publishBlocker({ fileCount: 1, classroomCount: 0, studentCount: 0 })
    ).toMatch(/classroom or student/);
  });
});

describe("formatBytes", () => {
  it("scales the unit and hides a missing size", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(null)).toBe("");
    expect(formatBytes(0)).toBe("");
  });
});

describe("cleanFileName", () => {
  it("keeps the base name and drops a path", () => {
    expect(cleanFileName("C:\\scans\\ch7.pdf")).toBe("ch7.pdf");
    expect(cleanFileName("/tmp/board work.jpg")).toBe("board work.jpg");
  });

  it("falls back rather than storing an empty name", () => {
    expect(cleanFileName("")).toBe("file");
    expect(cleanFileName("   ")).toBe("file");
  });
});
