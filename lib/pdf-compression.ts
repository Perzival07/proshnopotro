/**
 * The decisions behind shrinking a PDF in the browser before it is uploaded.
 *
 * Two ways of making a PDF smaller are tried (see compress-pdf.ts):
 *
 *   optimized  - the same document re-saved with its objects packed into
 *                compressed streams. Nothing is lost: text stays selectable
 *                and sharp. The gain is modest, and nothing for a PDF that is
 *                already tightly written.
 *   rasterized - every page redrawn as a JPEG. A scanned worksheet is a stack
 *                of oversized photos, and this is where most of its bytes go.
 *                It costs text selection and some crispness, so it is only
 *                kept when it pays for itself.
 *
 * Everything here is a pure function, so the thresholds can be tested without
 * a browser.
 */

import { formatBytes } from "./notes";

/**
 * Largest PDF accepted, in bytes, after compression. Cloudinary's free plan
 * rejects raw files over 10 MB, so this is where the tutor is told why.
 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/**
 * Largest PDF the browser will attempt to compress. Bigger than the upload
 * limit on purpose: a 30 MB scan usually comes out well under 10 MB.
 */
export const MAX_PDF_SOURCE_BYTES = 60 * 1024 * 1024;

/**
 * A page heavier than this is almost certainly a scan or a photo, so redrawing
 * it as a JPEG is worth trying. Typed pages sit far below it.
 */
export const RASTERIZE_BYTES_PER_PAGE = 180 * 1024;

/** Pages beyond this are not redrawn -- it would take minutes on a phone. */
export const MAX_RASTER_PAGES = 150;

/** Resolution pages are redrawn at. Print-readable, a fraction of a scan. */
export const RASTER_DPI = 150;

/** Longest edge of a redrawn page, whatever its paper size. */
export const MAX_RASTER_EDGE = 2000;

export const RASTER_JPEG_QUALITY = 0.72;

/**
 * A redrawn copy must be at most this fraction of the best lossless copy to be
 * kept -- trading selectable text for a 10% saving is a bad deal.
 */
export const RASTER_MIN_SAVING = 0.7;

export type CompressionMethod = "original" | "optimized" | "rasterized";

export interface Candidate {
  method: CompressionMethod;
  bytes: number;
}

/** Whether redrawing pages as images is worth attempting at all. */
export function shouldRasterize(bytes: number, pages: number): boolean {
  if (pages <= 0 || pages > MAX_RASTER_PAGES) return false;
  // Over the limit, anything that might bring it under is worth a try.
  if (bytes > MAX_PDF_BYTES) return true;
  return bytes / pages >= RASTERIZE_BYTES_PER_PAGE;
}

/**
 * The pdf.js scale to draw one page at: RASTER_DPI, capped so the longest
 * edge stays within MAX_RASTER_EDGE. Page sizes are in points (1/72 inch).
 */
export function rasterScale(widthPt: number, heightPt: number): number {
  const longest = Math.max(widthPt, heightPt);
  if (!(longest > 0)) return 1;
  return Math.min(RASTER_DPI / 72, MAX_RASTER_EDGE / longest);
}

/**
 * Which copy to upload.
 *
 * The smallest lossless copy is preferred. A rasterized copy wins only when it
 * saves enough to justify the loss -- or when it is the only copy that fits
 * under the upload limit at all.
 */
export function pickCandidate(candidates: Candidate[]): Candidate {
  if (candidates.length === 0) throw new Error("Nothing to choose from.");

  const smallest = (list: Candidate[]) =>
    list.reduce((best, c) => (c.bytes < best.bytes ? c : best));

  const lossless = candidates.filter((c) => c.method !== "rasterized");
  const raster = candidates.filter((c) => c.method === "rasterized");

  if (lossless.length === 0) return smallest(raster);
  const bestLossless = smallest(lossless);
  if (raster.length === 0) return bestLossless;

  const bestRaster = smallest(raster);
  if (bestRaster.bytes >= bestLossless.bytes) return bestLossless;
  if (bestLossless.bytes > MAX_PDF_BYTES) return bestRaster;
  return bestRaster.bytes <= bestLossless.bytes * RASTER_MIN_SAVING
    ? bestRaster
    : bestLossless;
}

/** True for a file the browser says is a PDF, or that is named like one. */
export function looksLikePdf(file: { name: string; type: string }): boolean {
  return (
    file.type === "application/pdf" ||
    (file.name.split(".").pop() || "").toLowerCase() === "pdf"
  );
}

/** "8.2 MB → 1.3 MB", or just the size when nothing was gained. */
export function describeSaving(originalBytes: number, bytes: number): string {
  if (bytes >= originalBytes) return formatBytes(bytes);
  return `${formatBytes(originalBytes)} → ${formatBytes(bytes)}`;
}
