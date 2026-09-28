import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SIGNATURE_HEADER, verifyRequest } from "@/lib/signature";

/**
 * What a portal's build asks for: its branding, in the shape of an
 * orgs/<slug>/org.json, plus the uploaded logo. 404 when none is saved here,
 * so the portal uses its orgs/ folder. Signed like the status endpoint.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = new URL(request.url).pathname;
  const org = await prisma.organisation.findUnique({
    where: { slug },
    select: { slug: true, name: true, syncSecret: true, branding: true, logoImage: true, logoType: true },
  });
  if (!org || !verifyRequest(org.syncSecret, request.headers.get(SIGNATURE_HEADER), "GET", path)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!org.branding) return NextResponse.json({ error: "No branding saved" }, { status: 404 });

  return NextResponse.json(
    {
      ...(org.branding as object),
      slug: org.slug,
      name: org.name,
      logoImage: org.logoImage ? { type: org.logoType, base64: Buffer.from(org.logoImage).toString("base64") } : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
