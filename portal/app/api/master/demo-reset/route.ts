import { NextResponse } from "next/server";
import { org } from "@/lib/org";
import { masterConfig } from "@/lib/master";
import { SIGNATURE_HEADER, verifyRequest } from "@/lib/master-signature";
import { DEMO_SLUG } from "@/lib/demo";
import { resetDemoData } from "@/lib/demo-reset";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The master's "Reset demo data" button. Exists only on the demo portal
 * (ORG=demo): on any other organisation's portal it answers 404, so no
 * signature can ever wipe a real organisation's tests.
 */
export async function POST(request: Request) {
  if (org.slug !== DEMO_SLUG) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const config = masterConfig();
  if (!config) return NextResponse.json({ error: "Not connected to a master" }, { status: 503 });
  const path = new URL(request.url).pathname;
  const body = await request.text();
  if (!verifyRequest(config.secret, request.headers.get(SIGNATURE_HEADER), "POST", path, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const counts = await resetDemoData();
    return NextResponse.json({ success: true, ...counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[master] demo reset failed:", err);
    return NextResponse.json({ error: "The portal could not reset the demo." }, { status: 500 });
  }
}
