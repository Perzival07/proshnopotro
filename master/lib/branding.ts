/**
 * An organisation's branding as the super admin edits it: what its portal
 * shows (name, logo text, tagline, phone, colours), which features it has,
 * and who its privacy notice and terms name. The portal fetches it at build
 * time (app/api/portal/[slug]/branding) in the same shape as an
 * orgs/<slug>/org.json, and portal/org-loader.mjs checks it the same way.
 * Pure, so the rules are tested.
 */

export const COLOR_KEYS = ["navy", "blue", "tint", "page", "ink", "border", "onDark"] as const;
export const FEATURE_KEYS = ["proctoring", "cameraProctoring", "calculator", "secondLanguage", "answerSheetUpload"] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
type FeatureKey = (typeof FEATURE_KEYS)[number];

export type Branding = {
  shortName: string;
  logo: { prefix: string; main: string };
  tagline: string;
  support: { phone: string; phoneDisplay: string; whatsapp: string };
  colors: Record<ColorKey, string>;
  features: Record<FeatureKey, boolean>;
  legal: {
    entityName: string | null;
    address: string | null;
    city: string | null;
    grievanceOfficer: { name: string | null; email: string | null };
    effectiveDate: string | null;
  };
};

export const COLOR_LABELS: Record<ColorKey, string> = {
  navy: "Main (headings, buttons)",
  blue: "Accent (links, highlights)",
  tint: "Light background",
  page: "Page background",
  ink: "Body text",
  border: "Borders",
  onDark: "Accent on dark bars",
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  proctoring: "Proctoring (tab and full-screen guard, copy and screenshot block)",
  cameraProctoring: "Camera check during proctored tests",
  calculator: "On-screen calculator",
  secondLanguage: "Second language (e.g. Hindi) translations",
  answerSheetUpload: "Answer-sheet photo upload after built-in papers",
};

/** A starting point for an organisation with no branding saved yet. */
export function defaultBranding(name: string): Branding {
  return {
    shortName: name.split(/\s+/).slice(-1)[0] || name,
    logo: { prefix: "", main: name.toUpperCase() },
    tagline: "Learn. Practise. Succeed.",
    support: { phone: "", phoneDisplay: "", whatsapp: "" },
    colors: { navy: "#0A4B8C", blue: "#2E9CD8", tint: "#E8F3FB", page: "#F7F8FA", ink: "#1A2230", border: "#DCE4EC", onDark: "#87CEEB" },
    features: { proctoring: true, cameraProctoring: true, calculator: true, secondLanguage: true, answerSheetUpload: true },
    legal: { entityName: null, address: null, city: null, grievanceOfficer: { name: null, email: null }, effectiveDate: null },
  };
}

/**
 * "+91 91239 24645", "09123924645" or "9123924645" -> the forms the portal
 * uses. Ten digits on their own are taken as an Indian mobile number.
 */
export function normalisePhone(raw: string): { phone: string; phoneDisplay: string; whatsapp: string } | null {
  let digits = raw.replace(/[^\d]/g, "");
  if (!raw.trim().startsWith("+")) {
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10) digits = `91${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  const display =
    digits.startsWith("91") && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
  return { phone: `+${digits}`, phoneDisplay: display, whatsapp: digits };
}

type Fields = { get(name: string): FormDataEntryValue | null };

function text(form: Fields, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}
const orNull = (v: string) => v || null;

export function parseBrandingForm(form: Fields): { data: Branding } | { error: string } {
  const shortName = text(form, "shortName");
  const logoMain = text(form, "logoMain");
  const tagline = text(form, "tagline");
  if (!shortName || shortName.length > 30) return { error: "Give a short name of up to 30 characters (the installed app's name)." };
  if (!logoMain || logoMain.length > 30) return { error: "The logo's main word is needed (up to 30 characters)." };
  if (text(form, "logoPrefix").length > 30) return { error: "The logo's first line can be up to 30 characters." };
  if (!tagline || tagline.length > 60) return { error: "Give a tagline of up to 60 characters." };

  const phone = normalisePhone(text(form, "phone"));
  if (!phone) return { error: "The phone number needs 10 digits, or a + and the country code." };
  const whatsappRaw = text(form, "whatsapp");
  const whatsapp = whatsappRaw ? normalisePhone(whatsappRaw) : phone;
  if (!whatsapp) return { error: "The WhatsApp number needs 10 digits, or a + and the country code." };

  const colors = {} as Record<ColorKey, string>;
  for (const key of COLOR_KEYS) {
    const value = text(form, `color_${key}`).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(value)) return { error: `"${COLOR_LABELS[key]}" must be a colour like #0A4B8C.` };
    colors[key] = value;
  }
  const features = {} as Record<FeatureKey, boolean>;
  for (const key of FEATURE_KEYS) features[key] = form.get(`feature_${key}`) === "on";

  const email = text(form, "grievanceEmail");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "The grievance officer's email is not a valid address." };
  const effectiveDate = text(form, "effectiveDate");
  if (effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return { error: "The effective date is not a valid date." };

  return {
    data: {
      shortName,
      logo: { prefix: text(form, "logoPrefix"), main: logoMain },
      tagline,
      support: { phone: phone.phone, phoneDisplay: phone.phoneDisplay, whatsapp: whatsapp.whatsapp },
      colors,
      features,
      legal: {
        entityName: orNull(text(form, "entityName").slice(0, 200)),
        address: orNull(text(form, "address").slice(0, 300)),
        city: orNull(text(form, "city").slice(0, 80)),
        grievanceOfficer: { name: orNull(text(form, "grievanceName").slice(0, 120)), email: orNull(email) },
        effectiveDate: orNull(effectiveDate),
      },
    },
  };
}

/** Accepted logo files, recognised by their first bytes rather than their name. */
export const MAX_LOGO_BYTES = 1024 * 1024;

export function logoType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") {
    return "image/webp";
  }
  return null;
}

/** A Vercel deploy hook: the only kind of address the master will call to rebuild a portal. */
export function isDeployHook(url: string): boolean {
  return /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[\w-]+\/[\w-]+$/.test(url);
}
