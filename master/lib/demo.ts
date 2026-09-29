import { prisma } from "./prisma";
import { SIGNATURE_HEADER, signRequest } from "./signature";

/**
 * The demo organisation: an ordinary organisation with the slug "demo"
 * (orgs/demo), whose portal anyone the super admin adds on its People page
 * can try. It is never billed, never listed as having joined, and the home
 * page's "Access demo" button opens it.
 */
export const DEMO_SLUG = "demo";

/** The portal's reset route (portal/app/api/master/demo-reset). */
export const DEMO_RESET_PATH = "/api/master/demo-reset";

/** The demo portal's address while it is active, else null (the button is then hidden). */
export async function demoPortalUrl(): Promise<string | null> {
  try {
    const demo = await prisma.organisation.findUnique({ where: { slug: DEMO_SLUG }, select: { portalUrl: true, status: true } });
    return demo?.status === "ACTIVE" ? demo.portalUrl : null;
  } catch (err) {
    console.error("[demo] could not load the demo organisation:", err);
    return null;
  }
}

/** Asks the demo portal to put its sample content back, over a signed POST. */
export async function resetDemoPortal(
  portalUrl: string,
  secret: string
): Promise<{ ok: true; students: number; tutors: number } | { ok: false; error: string }> {
  const body = "{}";
  let res: Response;
  try {
    res = await fetch(`${portalUrl}${DEMO_RESET_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signRequest(secret, "POST", DEMO_RESET_PATH, body) },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return { ok: false, error: `Could not reach the demo portal (${err instanceof Error ? err.message : "network error"}).` };
  }
  if (res.status === 401) return { ok: false, error: "The portal refused the request: its MASTER_SYNC_SECRET does not match." };
  if (res.status === 503) return { ok: false, error: "The portal has no MASTER_SYNC_SECRET set." };
  if (res.status === 404) return { ok: false, error: "The portal is not running as the demo (ORG=demo), or is on an older version: redeploy it." };
  const reply = (await res.json().catch(() => ({}))) as { error?: unknown; students?: unknown; tutors?: unknown };
  if (!res.ok) return { ok: false, error: typeof reply.error === "string" ? `The portal said: ${reply.error}` : `The portal answered ${res.status}.` };
  return { ok: true, students: Number(reply.students) || 0, tutors: Number(reply.tutors) || 0 };
}
