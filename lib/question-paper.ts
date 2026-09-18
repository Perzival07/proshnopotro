/**
 * Question papers that were uploaded as PDFs.
 *
 * Papers are links now -- a Google Form, a Google Doc, or a PDF on Google
 * Drive (see test-resource.ts) -- and nothing is uploaded any more. Tests
 * saved before that change may still name a file in Cloudinary through the
 * paper* columns; these helpers exist only so that file can be deleted when
 * the tutor gives the test a link.
 */

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

/** Enough of a stored Cloudinary raw file to delete it, or null for none. */
export function paperFile(test: { paperPublicId: string | null; paperVersion: number | null }) {
  if (!test.paperPublicId || !test.paperVersion) return null;
  return {
    publicId: test.paperPublicId,
    version: test.paperVersion,
    format: "pdf",
    resourceType: "raw",
  };
}
