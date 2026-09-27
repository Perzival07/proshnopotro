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

export const nav = [
  { label: "Platform", href: "#platform" },
  { label: "Proctoring", href: "#proctoring" },
  { label: "Organisations", href: "#organisations" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const demoHref = `mailto:${site.contactEmail}?subject=${encodeURIComponent("Proshnopotro demo")}`;
