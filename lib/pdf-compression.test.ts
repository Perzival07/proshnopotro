import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  MAX_PDF_BYTES,
  MAX_RASTER_PAGES,
  RASTER_DPI,
  describeSaving,
  looksLikePdf,
  pickCandidate,
  rasterScale,
  shouldRasterize,
} from "./pdf-compression";
import { optimizePdf } from "./compress-pdf";

const KB = 1024;
const MB = 1024 * 1024;

describe("shouldRasterize", () => {
  it("leaves typed papers alone", () => {
    // 6 pages of text at ~40 KB a page.
    expect(shouldRasterize(240 * KB, 6)).toBe(false);
  });

  it("tries it for scans, which run to megabytes a page", () => {
    expect(shouldRasterize(12 * MB, 4)).toBe(true);
    expect(shouldRasterize(2 * MB, 2)).toBe(true);
  });

  it("tries anything that is over the upload limit", () => {
    expect(shouldRasterize(MAX_PDF_BYTES + 1, 140)).toBe(true);
  });

  it("does not attempt huge documents or empty ones", () => {
    expect(shouldRasterize(50 * MB, MAX_RASTER_PAGES + 1)).toBe(false);
    expect(shouldRasterize(1 * MB, 0)).toBe(false);
  });
});

describe("rasterScale", () => {
  it("draws an A4 page at the target DPI", () => {
    // A4 is 595 x 842 pt; 842 * 150/72 = 1754px, inside the cap.
    expect(rasterScale(595, 842)).toBeCloseTo(RASTER_DPI / 72);
  });

  it("caps a poster-sized page at the longest edge", () => {
    const scale = rasterScale(2384, 3370); // A0
    expect(Math.round(3370 * scale)).toBe(2000);
  });

  it("does not divide by zero on a broken page box", () => {
    expect(rasterScale(0, 0)).toBe(1);
  });
});

describe("pickCandidate", () => {
  it("keeps the original when nothing beats it", () => {
    expect(
      pickCandidate([
        { method: "original", bytes: 300 * KB },
        { method: "optimized", bytes: 310 * KB },
      ]).method
    ).toBe("original");
  });

  it("prefers a lossless saving", () => {
    expect(
      pickCandidate([
        { method: "original", bytes: 300 * KB },
        { method: "optimized", bytes: 200 * KB },
      ]).method
    ).toBe("optimized");
  });

  it("takes redrawn pages when they save a lot", () => {
    expect(
      pickCandidate([
        { method: "original", bytes: 8 * MB },
        { method: "optimized", bytes: 7.8 * MB },
        { method: "rasterized", bytes: 1.5 * MB },
      ]).method
    ).toBe("rasterized");
  });

  it("does not give up sharp text for a small saving", () => {
    expect(
      pickCandidate([
        { method: "original", bytes: 2 * MB },
        { method: "rasterized", bytes: 1.8 * MB },
      ]).method
    ).toBe("original");
  });

  it("takes any redrawn copy that brings the file under the limit", () => {
    expect(
      pickCandidate([
        { method: "original", bytes: 11 * MB },
        { method: "rasterized", bytes: 9.5 * MB },
      ]).method
    ).toBe("rasterized");
  });
});

describe("looksLikePdf", () => {
  it("goes by type or by name", () => {
    expect(looksLikePdf({ name: "paper", type: "application/pdf" })).toBe(true);
    expect(looksLikePdf({ name: "Paper.PDF", type: "" })).toBe(true);
    expect(looksLikePdf({ name: "paper.jpg", type: "image/jpeg" })).toBe(false);
  });
});

describe("describeSaving", () => {
  it("shows before and after only when it shrank", () => {
    expect(describeSaving(8 * MB, 2 * MB)).toBe("8.0 MB → 2.0 MB");
    expect(describeSaving(300 * KB, 300 * KB)).toBe("300 KB");
  });
});

describe("optimizePdf", () => {
  it("re-saves a loosely written PDF smaller, with every page intact", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let p = 0; p < 20; p++) {
      const page = doc.addPage();
      for (let line = 0; line < 40; line++) {
        page.drawText(`Q${line + 1}. Find the acceleration of the block on page ${p + 1}.`, {
          x: 40,
          y: 800 - line * 18,
          size: 10,
          font,
        });
      }
    }
    const loose = await doc.save({ useObjectStreams: false });

    const optimized = await optimizePdf(loose);
    expect(optimized).not.toBeNull();
    expect(optimized!.byteLength).toBeLessThan(loose.byteLength);
    expect((await PDFDocument.load(optimized!)).getPageCount()).toBe(20);
  });

  it("returns null for something that is not a PDF", async () => {
    expect(await optimizePdf(new TextEncoder().encode("not a pdf"))).toBeNull();
  });
});
