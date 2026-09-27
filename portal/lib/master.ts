import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { org } from "@/lib/org";
import { SIGNATURE_HEADER, signRequest } from "@/lib/master-signature";
import { parseMasterStatus, type MasterStatus } from "@/lib/master-status";

/**
 * This portal's link to the master (the Proshnopotro super admin app), set by
 * MASTER_URL and MASTER_SYNC_SECRET. Without them the portal runs on its own,
 * exactly as before: never suspended, no billing page data.
 */
export function masterConfig(): { url: string; secret: string } | null {
  const url = process.env.MASTER_URL?.replace(/\/+$/, "");
  const secret = process.env.MASTER_SYNC_SECRET;
  return url && secret ? { url, secret } : null;
}

/** Throws on any failure, so a failure is never cached as an answer. */
async function fetchStatus(url: string): Promise<MasterStatus> {
  const secret = process.env.MASTER_SYNC_SECRET ?? "";
  const path = `/api/portal/${org.slug}/status`;
  const res = await fetch(`${url}${path}`, {
    headers: { [SIGNATURE_HEADER]: signRequest(secret, "GET", path) },
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  if (!res.ok) throw new Error(`the master answered ${res.status}`);
  const status = parseMasterStatus(await res.json());
  if (!status) throw new Error("the master's reply was not understood");
  return status;
}

// Keyed by the master's address and a fingerprint of the secret (never the
// secret itself), so changing either asks afresh instead of reusing an answer.
const cachedStatus = unstable_cache(
  (url: string, _secretFingerprint: string) => fetchStatus(url),
  ["master-status"],
  { revalidate: 300 }
);

/** After a failed check, the next one waits this long: an outage must not slow every page. */
const RETRY_AFTER_MS = 60_000;
let failedAt = 0;

/**
 * The master's word on this portal, asked at most every five minutes and
 * shared by every request in between. If the master cannot be reached the
 * answer is null and the portal stays open: an outage there must never lock
 * students out of an exam here.
 */
export async function masterStatus(): Promise<MasterStatus | null> {
  const config = masterConfig();
  if (!config || Date.now() - failedAt < RETRY_AFTER_MS) return null;
  try {
    return await cachedStatus(config.url, createHash("sha256").update(config.secret).digest("hex").slice(0, 16));
  } catch (err) {
    failedAt = Date.now();
    console.error("[master] status check failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function isSuspended(): Promise<boolean> {
  return (await masterStatus())?.status === "SUSPENDED";
}
