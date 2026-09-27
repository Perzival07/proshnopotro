/**
 * The organisation this deployment serves: name, logo text, contact numbers,
 * colours and feature switches from orgs/<ORG>/org.json.
 *
 * next.config.mjs reads that file at build time and inlines it here as
 * ORG_BRANDING, so this works the same in server and client components.
 */
export type OrgBranding = {
  slug: string;
  name: string;
  shortName: string;
  logo: { prefix: string; main: string };
  tagline: string;
  support: { phone: string; phoneDisplay: string; whatsapp: string };
  colors: {
    navy: string;
    blue: string;
    tint: string;
    page: string;
    ink: string;
    border: string;
    /** A light accent that reads on navy and other dark backgrounds. */
    onDark: string;
  };
  features: {
    proctoring: boolean;
    cameraProctoring: boolean;
    calculator: boolean;
    secondLanguage: boolean;
    answerSheetUpload: boolean;
  };
};

/** The product every organisation's portal is built on. */
export const PRODUCT_NAME = "Proshnopotro";

function readOrg(): OrgBranding {
  // Written out in full (not process.env[name]) so Next can inline it.
  const raw = process.env.ORG_BRANDING;
  if (!raw) {
    throw new Error("ORG_BRANDING is not set; it is filled in by next.config.mjs from orgs/<ORG>/org.json");
  }
  return JSON.parse(raw) as OrgBranding;
}

export const org: OrgBranding = readOrg();
