/**
 * Checks what the super admin typed into the organisation and payment forms.
 * Pure, so the rules are tested; the server actions only save the result.
 */
import { fromDateKey } from "./billing";
import { CLASS_OPTIONS, type PeopleCommand, type PersonRole } from "./portal-people";

type Fields = { get(name: string): FormDataEntryValue | null };
type Parsed<T> = { data: T } | { error: string };

function text(form: Fields, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function wholeNumber(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

export type OrgInput = {
  slug: string;
  name: string;
  portalUrl: string;
  pricePerStudentInr: number;
  maxStudents: number | null;
  notes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A portal address: https, or http on localhost for development. Stored as
 * its origin only ("https://x.in"), since paths are added to it.
 */
export function normalisePortalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  return url.origin;
}

export function parseOrgForm(form: Fields): Parsed<OrgInput> {
  const slug = text(form, "slug").toLowerCase();
  const name = text(form, "name");
  const portalUrl = normalisePortalUrl(text(form, "portalUrl"));
  const price = wholeNumber(text(form, "pricePerStudentInr") || "0");
  const maxRaw = text(form, "maxStudents");
  const maxStudents = maxRaw ? wholeNumber(maxRaw) : null;

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    return { error: "The slug is the organisation's folder name in orgs/: lower-case letters, digits and hyphens." };
  }
  if (!name || name.length > 120) return { error: "Give the organisation a name (up to 120 characters)." };
  if (!portalUrl) return { error: "The portal address must start with https://" };
  if (price === null) return { error: "The price per student is a whole number of rupees." };
  if (maxRaw && (maxStudents === null || maxStudents === 0)) {
    return { error: "The student limit is a whole number above zero, or empty for no limit." };
  }
  const contactEmail = text(form, "contactEmail").toLowerCase();
  if (contactEmail && (!EMAIL.test(contactEmail) || contactEmail.length > 320)) {
    return { error: "The organisation's email is not a valid email address." };
  }
  return {
    data: {
      slug,
      name,
      portalUrl,
      pricePerStudentInr: price,
      maxStudents,
      notes: text(form, "notes").slice(0, 2000),
      contactName: text(form, "contactName").slice(0, 120),
      contactEmail,
      contactPhone: text(form, "contactPhone").slice(0, 30),
      address: text(form, "address").slice(0, 500),
    },
  };
}

export type PaymentInput = {
  amountInr: number;
  receivedOn: string;
  reference: string;
  note: string;
  /** Moves the organisation's paid-up-to date, when given. */
  paidUpTo: string | null;
};

function dateField(raw: string): string | null {
  try {
    fromDateKey(raw);
    return raw;
  } catch {
    return null;
  }
}

export function parsePaymentForm(form: Fields, today: string): Parsed<PaymentInput> {
  const amount = wholeNumber(text(form, "amountInr"));
  const receivedOn = dateField(text(form, "receivedOn"));
  const paidUpToRaw = text(form, "paidUpTo");
  const paidUpTo = paidUpToRaw ? dateField(paidUpToRaw) : null;

  if (!amount) return { error: "Enter the amount received, in whole rupees." };
  if (!receivedOn) return { error: "Enter the date the payment was received." };
  if (receivedOn > today) return { error: "The payment date cannot be in the future." };
  if (paidUpToRaw && !paidUpTo) return { error: "The paid-up-to date is not a valid date." };
  return {
    data: {
      amountInr: amount,
      receivedOn,
      reference: text(form, "reference").slice(0, 200),
      note: text(form, "note").slice(0, 1000),
      paidUpTo,
    },
  };
}

const ROLES: readonly string[] = ["STUDENT", "TUTOR", "ADMIN"];

/** The super admin's "Add a person" form, as the command sent to the portal. */
export function parsePersonForm(form: Fields): Parsed<Extract<PeopleCommand, { action: "add" }>> {
  const role = text(form, "role");
  const email = text(form, "email").toLowerCase();
  const name = text(form, "name").slice(0, 80);
  const phone = text(form, "phone").slice(0, 20) || null;
  const className = text(form, "className") || null;
  if (!ROLES.includes(role)) return { error: "Choose student, tutor or owner." };
  if (!EMAIL.test(email) || email.length > 320) return { error: "Enter a valid email address." };
  if (role === "STUDENT" && !name) return { error: "A student needs a name." };
  if (className && !(CLASS_OPTIONS as readonly string[]).includes(className)) return { error: "Choose a class from the list." };
  return { data: { action: "add", role: role as PersonRole, email, name, phone, className } };
}

export function parseRole(raw: string): PersonRole | null {
  return ROLES.includes(raw) ? (raw as PersonRole) : null;
}

export function parseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL.test(email) && email.length <= 320 ? email : null;
}

export type SettingsInput = { defaultPricePerStudentInr: number; paymentInstructions: string };

export function parseSettingsForm(form: Fields): Parsed<SettingsInput> {
  const price = wholeNumber(text(form, "defaultPricePerStudentInr") || "0");
  if (price === null) return { error: "The default price is a whole number of rupees." };
  return { data: { defaultPricePerStudentInr: price, paymentInstructions: text(form, "paymentInstructions").slice(0, 2000) } };
}
