/**
 * Checks what the super admin typed into the organisation and payment forms.
 * Pure, so the rules are tested; the server actions only save the result.
 */
import { fromDateKey } from "./billing";

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
};

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
  return { data: { slug, name, portalUrl, pricePerStudentInr: price, maxStudents, notes: text(form, "notes").slice(0, 2000) } };
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
