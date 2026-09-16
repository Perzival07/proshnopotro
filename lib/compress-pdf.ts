import { PDFDocument } from "pdf-lib";
import { loadPdfJs } from "./pdfjs";
import {
  MAX_PDF_BYTES,
  MAX_PDF_SOURCE_BYTES,
  RASTER_JPEG_QUALITY,
  pickCandidate,
  rasterScale,
  shouldRasterize,
  type CompressionMethod,
} from "./pdf-compression";
import { formatBytes } from "./notes";

/**
 * Shrinks a PDF in the browser before it is uploaded, the way shrink-image.ts
 * does for photos. The rules for what counts as worth it live in
 * pdf-compression.ts; this file does the work.
 *
 * Every copy produced is opened again with pdf.js and its pages counted
 * before it may be chosen, so a re-save that quietly broke a document is
 * dropped in favour of the file the tutor chose.
 */

export interface CompressedPdf {
  blob: Blob;
  bytes: number;
  originalBytes: number;
  pages: number;
  method: CompressionMethod;
}

export type CompressProgress =
  | { stage: "reading" }
  | { stage: "optimizing" }
  | { stage: "redrawing"; page: number; pages: number };

export async function compressPdf(
  file: File,
  onProgress?: (progress: CompressProgress) => void
): Promise<CompressedPdf> {
  if (file.size > MAX_PDF_SOURCE_BYTES) {
    throw new Error(
      `${file.name} is ${formatBytes(file.size)}; PDFs over ${formatBytes(
        MAX_PDF_SOURCE_BYTES
      )} cannot be uploaded.`
    );
  }

  onProgress?.({ stage: "reading" });
  const original = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfJs();

  const pages = await countPages(pdfjs, original).catch((err: unknown) => {
    const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
    throw new Error(
      name === "PasswordException"
        ? `${file.name} is password-protected. Remove the password and try again.`
        : `${file.name} could not be opened as a PDF.`
    );
  });

  const copies: { method: CompressionMethod; data: Uint8Array }[] = [
    { method: "original", data: original },
  ];

  onProgress?.({ stage: "optimizing" });
  const optimized = await optimizePdf(original);
  if (optimized && (await hasPages(pdfjs, optimized, pages))) {
    copies.push({ method: "optimized", data: optimized });
  }

  const bestSoFar = Math.min(...copies.map((c) => c.data.byteLength));
  if (shouldRasterize(bestSoFar, pages)) {
    const rasterized = await rasterizePdf(pdfjs, original, (page) =>
      onProgress?.({ stage: "redrawing", page, pages })
    ).catch((err) => {
      // A page pdf.js cannot draw should not cost the tutor the upload.
      console.warn("Could not redraw this PDF as images:", err);
      return null;
    });
    if (rasterized && (await hasPages(pdfjs, rasterized, pages))) {
      copies.push({ method: "rasterized", data: rasterized });
    }
  }

  const choice = pickCandidate(
    copies.map((c) => ({ method: c.method, bytes: c.data.byteLength }))
  );
  const chosen = copies.find((c) => c.method === choice.method)!;

  if (chosen.data.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `${file.name} is still ${formatBytes(chosen.data.byteLength)} after compression; PDFs must be under ${formatBytes(
        MAX_PDF_BYTES
      )}. Try splitting it into parts.`
    );
  }

  return {
    blob: new Blob([chosen.data as BlobPart], { type: "application/pdf" }),
    bytes: chosen.data.byteLength,
    originalBytes: file.size,
    pages,
    method: chosen.method,
  };
}

/**
 * Re-saves the document with its objects packed into compressed object
 * streams and unused objects left behind. Lossless. Null when pdf-lib cannot
 * read the file (encrypted, or malformed in a way pdf.js tolerates).
 */
export async function optimizePdf(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    return await doc.save({ useObjectStreams: true, addDefaultPage: false });
  } catch {
    return null;
  }
}

type PdfJs = Awaited<ReturnType<typeof loadPdfJs>>;

async function countPages(pdfjs: PdfJs, data: Uint8Array): Promise<number> {
  // pdf.js takes ownership of the buffer it is given, so it gets a copy.
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}

async function hasPages(pdfjs: PdfJs, data: Uint8Array, expected: number) {
  try {
    return (await countPages(pdfjs, data)) === expected;
  } catch {
    return false;
  }
}

/**
 * Redraws every page as a JPEG and builds a new PDF from them, each image on
 * a page the size the original was, so the paper prints and zooms the same.
 */
async function rasterizePdf(
  pdfjs: PdfJs,
  data: Uint8Array,
  onPage: (page: number) => void
): Promise<Uint8Array> {
  const source = await pdfjs.getDocument({ data: data.slice() }).promise;
  const out = await PDFDocument.create();
  const canvas = document.createElement("canvas");

  try {
    for (let n = 1; n <= source.numPages; n++) {
      onPage(n);
      const page = await source.getPage(n);
      // Viewports account for /Rotate, so a landscape page stays landscape.
      const size = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: rasterScale(size.width, size.height) });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot draw PDF pages.");
      // JPEG has no transparency; paint white so blank areas are not black.
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", RASTER_JPEG_QUALITY)
      );
      if (!jpeg) throw new Error("A page could not be compressed.");

      const image = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      const target = out.addPage([size.width, size.height]);
      target.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    }
    return await out.save({ useObjectStreams: true });
  } finally {
    // Release the pixel buffer now rather than whenever GC gets to it --
    // phones run out of canvas memory quickly.
    canvas.width = 0;
    canvas.height = 0;
    await source.destroy();
  }
}
