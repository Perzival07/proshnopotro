/** Everything on the Proshnopotro site that is not layout: names, links, contacts. */
export const site = {
  name: "Proshnopotro",
  // প্রশ্নপত্র, "question paper": the name as people may type it in Bengali.
  nameBengali: "প্রশ্নপত্র",
  tagline: "The exam portal for tuition organisations",
  // Where "Book a demo" and the footer's contact link go.
  contactEmail: "classesbykoustav@gmail.com",
};

/**
 * This site's public address, for search engines (canonical links, the
 * sitemap). SITE_URL on Vercel; AUTH_URL is the same address, so it is the
 * fallback.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL || process.env.AUTH_URL || "http://localhost:3001").replace(/\/+$/, "");
}

/**
 * Who runs Proshnopotro, for the privacy policy and terms. null until filled
 * in: the pages show the gap, and a draft banner until effectiveDate is set
 * ("YYYY-MM-DD"). Have a lawyer review both documents before setting it.
 */
export const legal: {
  operatorName: string | null;
  address: string | null;
  city: string | null;
  grievanceOfficer: { name: string | null; email: string | null };
  effectiveDate: string | null;
} = {
  operatorName: null,
  address: null,
  city: null,
  grievanceOfficer: { name: null, email: null },
  effectiveDate: null,
};

/**
 * Shown on every organisation admin's billing page. Payments are made
 * directly to the platform owner, outside the app.
 */
export const paymentInstructions =
  `Pay by bank transfer or UPI, then send the transaction reference to ${site.contactEmail} ` +
  "so the payment can be recorded. Write to the same address for bank details or an invoice.";

/**
 * The header's links, in the order their sections come down the page, so
 * moving along the bar moves steadily down it (components/Header.tsx follows
 * the reader with a sliding highlight). `fallback` is used when the first
 * section is not on the page (no organisation is listed yet).
 */
export const nav: { label: string; href: string; fallback?: string }[] = [
  { label: "Organisations", href: "#joined", fallback: "#organisations" },
  { label: "Platform", href: "#platform" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Proctoring", href: "#proctoring" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const demoHref = `mailto:${site.contactEmail}?subject=${encodeURIComponent("Proshnopotro demo")}`;
