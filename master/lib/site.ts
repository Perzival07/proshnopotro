/** Everything on the Proshnopotro site that is not layout: names, links, contacts. */
export const site = {
  name: "Proshnopotro",
  tagline: "The exam portal for tuition organisations",
  // Where "Book a demo" and the footer's contact link go.
  contactEmail: "classesbykoustav@gmail.com",
};

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
 * Organisations running their own Proshnopotro portal, for the "Find your
 * portal" list. Add one here when its portal goes live.
 */
export const organisations = [
  { name: "Classes by Koustav", url: "https://proshnopotro-nine.vercel.app" },
];

/**
 * Shown on every organisation admin's billing page. Payments are made
 * directly to the platform owner, outside the app.
 */
export const paymentInstructions =
  `Pay by bank transfer or UPI, then send the transaction reference to ${site.contactEmail} ` +
  "so the payment can be recorded. Write to the same address for bank details or an invoice.";

export const nav = [
  { label: "Platform", href: "#platform" },
  { label: "Proctoring", href: "#proctoring" },
  { label: "Organisations", href: "#organisations" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const demoHref = `mailto:${site.contactEmail}?subject=${encodeURIComponent("Proshnopotro demo")}`;
