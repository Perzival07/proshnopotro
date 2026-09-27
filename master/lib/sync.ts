import { prisma } from "./prisma";
import { parseRoster } from "./roster";
import { SIGNATURE_HEADER, signRequest } from "./signature";

/** Where each portal answers the master with its student emails. */
export const ROSTER_PATH = "/api/master/roster";

/**
 * Asks an organisation's portal for its enrolled student emails and replaces
 * the master's copy with them. A failure keeps the last good copy and records
 * why, so the dashboard can say the count is stale.
 */
export async function syncRoster(orgId: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } });
  const result = await fetchRoster(org.portalUrl, org.syncSecret);
  if ("error" in result) {
    await prisma.organisation.update({ where: { id: orgId }, data: { lastSyncError: result.error } });
    return { ok: false, error: result.error };
  }
  const { emails } = result;
  await prisma.$transaction([
    prisma.enrolment.deleteMany({ where: { orgId } }),
    prisma.enrolment.createMany({ data: emails.map((email) => ({ orgId, email })) }),
    prisma.organisation.update({
      where: { id: orgId },
      data: { studentCount: emails.length, lastSyncAt: new Date(), lastSyncError: null },
    }),
  ]);
  return { ok: true, count: emails.length };
}

async function fetchRoster(portalUrl: string, secret: string): Promise<{ emails: string[] } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(`${portalUrl}${ROSTER_PATH}`, {
      headers: { [SIGNATURE_HEADER]: signRequest(secret, "GET", ROSTER_PATH) },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return { error: `Could not reach the portal (${err instanceof Error ? err.message : "network error"}).` };
  }
  if (res.status === 401) return { error: "The portal refused the request: its MASTER_SYNC_SECRET does not match." };
  if (res.status === 503) return { error: "The portal has no MASTER_SYNC_SECRET set." };
  if (!res.ok) return { error: `The portal answered ${res.status}.` };
  try {
    return parseRoster(await res.json());
  } catch {
    return { error: "The portal's reply was not JSON." };
  }
}
