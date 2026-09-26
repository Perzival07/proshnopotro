import type { OrgBranding } from "./org";

/**
 * An organisation's feature switches (orgs/<ORG>/org.json "features") over
 * one test's own settings.
 *
 * A switch that is off overrides every test; one that is on leaves each test
 * as its tutor set it. The stored test settings are never rewritten, so
 * turning a feature back on restores each test's own choice.
 */
export type OrgFeatures = OrgBranding["features"];

type TestSettings = {
  proctored?: boolean | null;
  calculator?: boolean | null;
  secondLanguage?: string | null;
  answerSheets?: boolean | null;
};

export type EffectiveFeatures = {
  /** Tab and full-screen guard, copy/screenshot block, watermark. */
  proctored: boolean;
  /** Camera, face scan and face/phone detection; only on a proctored test. */
  camera: boolean;
  calculator: boolean;
  /** The second language's name, or null when the paper has one language. */
  secondLanguage: string | null;
  /**
   * Built-in question papers: photograph written answers after the paper.
   * Written papers (Google Doc, PDF, Google Form) are answered on paper, so
   * their upload step is not switched off by this.
   */
  answerSheets: boolean;
};

export function effectiveFeatures(test: TestSettings, features: OrgFeatures): EffectiveFeatures {
  const proctored = test.proctored === true && features.proctoring;
  return {
    proctored,
    camera: proctored && features.cameraProctoring,
    calculator: test.calculator === true && features.calculator,
    secondLanguage: features.secondLanguage ? test.secondLanguage ?? null : null,
    answerSheets: test.answerSheets === true && features.answerSheetUpload,
  };
}
