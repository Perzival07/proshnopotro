import { describe, expect, it } from "vitest";
import { defaultBranding, isDeployHook, logoType, normalisePhone, parseBrandingForm } from "./branding";

const form = (fields: Record<string, string>) => ({ get: (k: string) => fields[k] ?? null });

function fieldsFor(overrides: Record<string, string> = {}) {
  const b = defaultBranding("Classes by Koustav");
  const fields: Record<string, string> = {
    shortName: "Koustav",
    logoPrefix: "classes by",
    logoMain: "KOUSTAV",
    tagline: "Learn. Succeed. Shine.",
    phone: "+91 91239 24645",
    feature_proctoring: "on",
    feature_calculator: "on",
  };
  for (const [k, v] of Object.entries(b.colors)) fields[`color_${k}`] = v;
  return { ...fields, ...overrides };
}

describe("normalisePhone", () => {
  it("reads Indian numbers however they are typed", () => {
    for (const raw of ["+91 91239 24645", "9123924645", "09123924645", "91239-24645"]) {
      expect(normalisePhone(raw)).toEqual({ phone: "+919123924645", phoneDisplay: "+91 91239 24645", whatsapp: "919123924645" });
    }
  });
  it("keeps other countries as typed and refuses short numbers", () => {
    expect(normalisePhone("+44 20 7946 0958")).toEqual({ phone: "+442079460958", phoneDisplay: "+442079460958", whatsapp: "442079460958" });
    expect(normalisePhone("12345")).toBeNull();
  });
});

describe("parseBrandingForm", () => {
  it("builds the portal's branding, with unticked features off and WhatsApp defaulting to the phone", () => {
    const r = parseBrandingForm(form(fieldsFor({ color_navy: "#0a4b8c" })));
    expect(r).toMatchObject({
      data: {
        logo: { prefix: "classes by", main: "KOUSTAV" },
        support: { phone: "+919123924645", whatsapp: "919123924645" },
        colors: { navy: "#0A4B8C" },
        features: { proctoring: true, calculator: true, cameraProctoring: false, secondLanguage: false },
        legal: { entityName: null, grievanceOfficer: { email: null } },
      },
    });
  });
  it("uses a separate WhatsApp number when one is given", () => {
    expect(parseBrandingForm(form(fieldsFor({ whatsapp: "9000000001" })))).toMatchObject({ data: { support: { whatsapp: "919000000001" } } });
  });
  it("refuses a bad colour, a missing phone or a bad email", () => {
    expect(parseBrandingForm(form(fieldsFor({ color_blue: "blue" })))).toHaveProperty("error");
    expect(parseBrandingForm(form(fieldsFor({ phone: "" })))).toHaveProperty("error");
    expect(parseBrandingForm(form(fieldsFor({ grievanceEmail: "nope" })))).toHaveProperty("error");
    expect(parseBrandingForm(form(fieldsFor({ logoMain: "" })))).toHaveProperty("error");
  });
});

describe("logoType and isDeployHook", () => {
  it("recognises images by their bytes", () => {
    expect(logoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(logoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(logoType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(logoType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("accepts only Vercel deploy hooks", () => {
    expect(isDeployHook("https://api.vercel.com/v1/integrations/deploy/prj_abc123/Xy9_kL")).toBe(true);
    expect(isDeployHook("https://evil.example.com/v1/integrations/deploy/prj/x")).toBe(false);
    expect(isDeployHook("http://api.vercel.com/v1/integrations/deploy/prj/x")).toBe(false);
  });
});
