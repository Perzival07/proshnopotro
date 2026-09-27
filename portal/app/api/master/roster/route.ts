import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { masterConfig } from "@/lib/master";
import { SIGNATURE_HEADER, verifyRequest } from "@/lib/master-signature";

export const dynamic = "force-dynamic";

/**
 * The master asks here for this organisation's enrolled students, for
 * billing and for its student hub. It gets their email addresses and nothing
 * else. Only a request signed with MASTER_SYNC_SECRET is answered.
 */
export async function GET(request: Request) {
  const config = masterConfig();
  if (!config) return NextResponse.json({ error: "Not connected to a master" }, { status: 503 });
  const path = new URL(request.url).pathname;
  if (!verifyRequest(config.secret, request.headers.get(SIGNATURE_HEADER), "GET", path)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const students = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { email: true }, orderBy: { email: "asc" } });
  return NextResponse.json({ students: students.map((s) => s.email) }, { headers: { "Cache-Control": "no-store" } });
}
