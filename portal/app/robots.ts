import type { MetadataRoute } from "next";

/**
 * A portal is one organisation's private workspace: search engines may list
 * its sign-in, privacy and terms pages (so "<organisation> portal" finds it)
 * and nothing else. A search for Proshnopotro itself should land on the
 * master site, which each portal links to from its footer.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/login", "/privacy", "/terms"], disallow: "/" } };
}
