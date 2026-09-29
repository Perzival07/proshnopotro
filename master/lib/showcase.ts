import { prisma } from "./prisma";
import { DEMO_SLUG } from "./demo";

/** An organisation as the home page's "joined us" section shows it. */
export type ShowcaseOrg = {
  slug: string;
  name: string;
  portalUrl: string;
  /** Its logo at /api/orgs/<slug>/logo, or null: then its initial is shown. */
  logoUrl: string | null;
  color: string;
};

/**
 * Every active organisation the super admin has left on the website, oldest
 * first. An organisation added in /admin appears here by itself. If the
 * database cannot be reached the section is simply empty: the rest of the
 * home page must still render.
 */
export async function showcaseOrgs(): Promise<ShowcaseOrg[]> {
  try {
    const orgs = await prisma.organisation.findMany({
      where: { status: "ACTIVE", showOnWebsite: true, slug: { not: DEMO_SLUG } },
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        name: true,
        portalUrl: true,
        branding: true,
        websiteLogoType: true,
        websiteLogoSavedAt: true,
        logoType: true,
        brandingSavedAt: true,
      },
    });
    return orgs.map((o) => {
      const colors = (o.branding as { colors?: { blue?: string } } | null)?.colors;
      // The saved-at time is in the address, so a new logo is never served from an old cache.
      const version = o.websiteLogoType ? o.websiteLogoSavedAt?.getTime() : o.logoType ? o.brandingSavedAt?.getTime() : null;
      return {
        slug: o.slug,
        name: o.name,
        portalUrl: o.portalUrl,
        logoUrl: o.websiteLogoType || o.logoType ? `/api/orgs/${o.slug}/logo?v=${version ?? 0}` : null,
        color: colors?.blue && /^#[0-9a-f]{6}$/i.test(colors.blue) ? colors.blue : "#585df9",
      };
    });
  } catch (err) {
    console.error("[showcase] could not load organisations:", err);
    return [];
  }
}
