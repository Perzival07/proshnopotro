import { prisma } from "@/lib/prisma";

/**
 * An organisation's logo for the public website: its website logo, else its
 * branding logo. Only for organisations the website lists, so a hidden or
 * suspended one's logo is not served.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await prisma.organisation.findUnique({
    where: { slug },
    select: { status: true, showOnWebsite: true, websiteLogo: true, websiteLogoType: true, logoImage: true, logoType: true },
  });
  const image = org?.websiteLogo ?? org?.logoImage;
  const type = org?.websiteLogo ? org.websiteLogoType : org?.logoType;
  if (!org || org.status !== "ACTIVE" || !org.showOnWebsite || !image || !type) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": type,
      // The address carries a version, so it can be cached for long.
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
