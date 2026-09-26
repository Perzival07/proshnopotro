import { describe, it, expect } from "vitest";
import { findChapter, ncertPreset, parseChapterList, NCERT_CHAPTERS } from "./syllabus";

describe("ncertPreset", () => {
  it("finds a class and subject, with common subject names", () => {
    expect(ncertPreset("12", "Physics")?.[0]).toBe("Electric Charges and Fields");
    expect(ncertPreset("10", "Maths")?.length).toBe(14);
    expect(ncertPreset("9", "General Science")?.[0]).toBe("Matter in Our Surroundings");
  });
  it("has nothing for a subject it does not know", () => expect(ncertPreset("12", "History")).toBeNull());
  it("has no repeated chapters in any list", () => {
    for (const subjects of Object.values(NCERT_CHAPTERS)) {
      for (const list of Object.values(subjects)) expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe("parseChapterList", () => {
  it("drops numbering, bullets and repeats", () =>
    expect(parseChapterList("Chapter 1: Force\n2. Pressure\n• Light\n\n(4) Sound\nforce\n  ")).toEqual([
      "Force",
      "Pressure",
      "Light",
      "Sound",
    ]));
});

describe("findChapter", () => {
  const chapters = ["Units and Measurements", "Motion in a Straight Line", "Laws of Motion"].map((name) => ({ name }));
  it("matches by name, ignoring case and punctuation", () =>
    expect(findChapter(chapters, "laws of motion")?.name).toBe("Laws of Motion"));
  it("matches by number", () => {
    expect(findChapter(chapters, "2")?.name).toBe("Motion in a Straight Line");
    expect(findChapter(chapters, "Ch 3")?.name).toBe("Laws of Motion");
  });
  it("finds nothing for an unknown chapter", () => expect(findChapter(chapters, "Optics")).toBeNull());
});
