import { describe, it, expect } from "vitest";
import {
  PAPER_FOLDER,
  isPaperPublicId,
  paperFile,
  toPaperColumns,
  validateUploadedPaper,
} from "./question-paper";

const good = {
  publicId: `${PAPER_FOLDER}/kinematics_ab12cd.pdf`,
  version: 1726480000,
  name: "Kinematics unit test.pdf",
  bytes: 820_000,
};

describe("isPaperPublicId", () => {
  it("accepts a PDF in the papers folder", () => {
    expect(isPaperPublicId(good.publicId)).toBe(true);
    expect(isPaperPublicId(`${PAPER_FOLDER}/Paper.PDF`)).toBe(true);
  });

  it("rejects other folders, other file types and path tricks", () => {
    expect(isPaperPublicId("proshnopotro/answers/abc/page.pdf")).toBe(false);
    expect(isPaperPublicId(`${PAPER_FOLDER}/photo.jpg`)).toBe(false);
    expect(isPaperPublicId(`${PAPER_FOLDER}/.pdf`)).toBe(false);
    expect(isPaperPublicId(`${PAPER_FOLDER}/../notes/x.pdf`)).toBe(false);
    expect(isPaperPublicId(`${PAPER_FOLDER}x/evil.pdf`)).toBe(false);
  });
});

describe("validateUploadedPaper", () => {
  it("passes a real upload", () => {
    expect(validateUploadedPaper(good)).toBeNull();
  });

  it("asks for a paper when there is none", () => {
    expect(validateUploadedPaper(null)).toMatch(/Upload/);
  });

  it("refuses an upload it cannot tie to the papers folder", () => {
    expect(validateUploadedPaper({ ...good, publicId: "elsewhere/x.pdf" })).toMatch(/verified/);
    expect(validateUploadedPaper({ ...good, version: 0 })).toMatch(/verified/);
  });

  it("refuses a file over the size limit", () => {
    expect(validateUploadedPaper({ ...good, bytes: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });
});

describe("toPaperColumns / paperFile", () => {
  it("round-trips into a signable raw file", () => {
    const columns = toPaperColumns({ ...good, name: "../../etc/Unit 3.pdf" });
    expect(columns.paperName).toBe("Unit 3.pdf");
    expect(paperFile(columns)).toEqual({
      publicId: good.publicId,
      version: good.version,
      format: "pdf",
      resourceType: "raw",
    });
  });

  it("has nothing to sign for a test without a paper", () => {
    expect(paperFile({ paperPublicId: null, paperVersion: null })).toBeNull();
  });
});
