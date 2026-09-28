import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { masterConfig } from "@/lib/master";
import { SIGNATURE_HEADER, verifyRequest } from "@/lib/master-signature";

export const dynamic = "force-dynamic";

/**
 * The master asks here who belongs to this organisation: its students, for
 * billing and for the hub, and its owners and tutors, so the hub can show them
 * where they work too. It gets email addresses and staff roles, nothing else.
 * Only a request signed with MASTER_SYNC_SECRET is answered.
 */
export async function GET(request: Request) {
  const config = masterConfig();
  if (!config) return NextResponse.json({ error: "Not connected to a master" }, { status: 503 });
  const path = new URL(request.url).pathname;
  if (!verifyRequest(config.secret, request.headers.get(SIGNATURE_HEADER), "GET", path)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const users = await prisma.user.findMany({ select: { email: true, role: true }, orderBy: { email: "asc" } });
  // Owners named in ADMIN_EMAILS count even before their first sign-in.
  const owners = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const staff = new Map<string, "ADMIN" | "TUTOR">(owners.map((email) => [email, "ADMIN"]));
  for (const u of users) if (u.role !== "STUDENT" && !staff.has(u.email)) staff.set(u.email, u.role);
  return NextResponse.json(
    {
      students: users.filter((u) => u.role === "STUDENT" && !staff.has(u.email)).map((u) => u.email),
      staff: Array.from(staff, ([email, role]) => ({ email, role })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
