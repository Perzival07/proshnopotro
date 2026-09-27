/** Everything on the Proshnopotro site that is not layout: names, links, contacts. */
export const site = {
  name: "Proshnopotro",
  tagline: "The exam portal for tuition organisations",
  // Where "Book a demo" and the footer's contact link go.
  contactEmail: "classesbykoustav@gmail.com",
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
