import { describe, it, expect } from "vitest";
import { effectiveFeatures, type OrgFeatures } from "./org-features";

const allOn: OrgFeatures = {
  proctoring: true,
  cameraProctoring: true,
  calculator: true,
  secondLanguage: true,
  answerSheetUpload: true,
};

const everything = { proctored: true, calculator: true, secondLanguage: "हिन्दी", answerSheets: true };

describe("effectiveFeatures", () => {
  it("leaves each test as set when every switch is on", () => {
    expect(effectiveFeatures(everything, allOn)).toEqual({
      proctored: true,
      camera: true,
      calculator: true,
      secondLanguage: "हिन्दी",
      answerSheets: true,
    });
    expect(effectiveFeatures({ proctored: false, calculator: false, secondLanguage: null, answerSheets: false }, allOn)).toEqual({
      proctored: false,
      camera: false,
      calculator: false,
      secondLanguage: null,
      answerSheets: false,
    });
  });

  it("turns off proctoring, and the camera with it", () => {
    const f = effectiveFeatures(everything, { ...allOn, proctoring: false });
    expect(f.proctored).toBe(false);
    expect(f.camera).toBe(false);
  });

  it("keeps the tab guard when only the camera is off", () => {
    const f = effectiveFeatures(everything, { ...allOn, cameraProctoring: false });
    expect(f.proctored).toBe(true);
    expect(f.camera).toBe(false);
  });

  it("switches off the calculator, second language and answer sheets one by one", () => {
    expect(effectiveFeatures(everything, { ...allOn, calculator: false }).calculator).toBe(false);
    expect(effectiveFeatures(everything, { ...allOn, secondLanguage: false }).secondLanguage).toBeNull();
    expect(effectiveFeatures(everything, { ...allOn, answerSheetUpload: false }).answerSheets).toBe(false);
  });

  it("treats missing test settings as off", () => {
    expect(effectiveFeatures({}, allOn)).toEqual({
      proctored: false,
      camera: false,
      calculator: false,
      secondLanguage: null,
      answerSheets: false,
    });
  });
});
