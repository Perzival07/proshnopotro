import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoster } from "@/lib/sync";

/**
 * Refreshes every active organisation's roster once a day (vercel.json
 * crons), so student counts and the hub stay current without anyone pressing
 * "Sync now". Vercel sends CRON_SECRET as a bearer token.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgs = await prisma.organisation.findMany({ where: { status: "ACTIVE" }, select: { id: true, slug: true } });
  const results: Record<string, string> = {};
  for (const org of orgs) {
    const r = await syncRoster(org.id);
    results[org.slug] = r.ok ? `${r.count} students` : r.error;
  }
  return NextResponse.json({ results });
}
