import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** The public pages are for search engines; sign-in, the hub and /admin are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/hub", "/login", "/api/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
