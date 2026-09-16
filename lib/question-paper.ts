/**
 * A test whose question paper is a PDF the tutor uploaded.
 *
 * The file is compressed in the tutor's browser (compress-pdf.ts), sent
 * straight to Cloudinary as an authenticated raw file under a signature the
 * server issues, and recorded on the Test. Students never get a stored link:
 * each time the paper is opened, the server signs one for that attempt.
 */

import { MAX_PDF_BYTES } from "./pdf-compression";
import { cleanFileName } from "./notes";

/**
 * Where uploaded papers live. One shared folder rather than one per test: the
 * tutor uploads the paper while still creating the test, before it has an id.
 * Only admins are ever issued a signature for it.
 */
export const PAPER_FOLDER = "proshnopotro/papers";

/** What the browser reports back after sending a paper to Cloudinary. */
export interface UploadedPaper {
  publicId: string;
  version: number;
  name: string;
  bytes: number;
}

/** The paper columns on a Test, as written to the database. */
export interface PaperColumns {
  paperPublicId: string | null;
  paperVersion: number | null;
  paperName: string | null;
  paperBytes: number | null;
}

export const NO_PAPER: PaperColumns = {
  paperPublicId: null,
  paperVersion: null,
  paperName: null,
  paperBytes: null,
};

/**
 * Whether a public id sits in the papers folder and names a PDF. The upload
 * signature pins the folder, but saving the test is a separate request, so it
 * is checked again. Raw public ids keep their extension.
 */
export function isPaperPublicId(publicId: string): boolean {
  const prefix = `${PAPER_FOLDER}/`;
  const rest = publicId.slice(prefix.length);
  return (
    publicId.startsWith(prefix) &&
    rest.length > ".pdf".length &&
    !rest.includes("..") &&
    rest.toLowerCase().endsWith(".pdf")
  );
}

/** Error text, or null when the reported upload can be saved on a test. */
export function validateUploadedPaper(paper: UploadedPaper | null | undefined): string | null {
  if (!paper) return "Upload the question paper PDF.";
  if (
    typeof paper.publicId !== "string" ||
    !isPaperPublicId(paper.publicId) ||
    !Number.isInteger(paper.version) ||
    paper.version <= 0
  ) {
    return "The uploaded PDF could not be verified. Please upload it again.";
  }
  if (typeof paper.bytes === "number" && paper.bytes > MAX_PDF_BYTES) {
    return "That PDF is over the 10 MB limit. Please upload a smaller one.";
  }
  return null;
}

export function toPaperColumns(paper: UploadedPaper): PaperColumns {
  return {
    paperPublicId: paper.publicId,
    paperVersion: paper.version,
    paperName: cleanFileName(paper.name || "question-paper.pdf"),
    paperBytes:
      typeof paper.bytes === "number" && Number.isFinite(paper.bytes)
        ? Math.round(paper.bytes)
        : null,
  };
}

/** Enough of a Cloudinary raw file to sign a link to it. */
export function paperFile(test: { paperPublicId: string | null; paperVersion: number | null }) {
  if (!test.paperPublicId || !test.paperVersion) return null;
  return {
    publicId: test.paperPublicId,
    version: test.paperVersion,
    format: "pdf",
    resourceType: "raw",
  };
}
