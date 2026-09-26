import { describe, it, expect } from "vitest";
import { NO_PAPER, paperFile } from "./question-paper";

describe("paperFile", () => {
  it("names an old uploaded paper so it can be deleted", () => {
    expect(
      paperFile({ paperPublicId: "proshnopotro/papers/unit3_ab12.pdf", paperVersion: 17 })
    ).toEqual({
      publicId: "proshnopotro/papers/unit3_ab12.pdf",
      version: 17,
      format: "pdf",
      resourceType: "raw",
    });
  });

  it("has nothing to delete for a test without one", () => {
    expect(paperFile(NO_PAPER)).toBeNull();
    expect(paperFile({ paperPublicId: "x.pdf", paperVersion: null })).toBeNull();
  });
});
