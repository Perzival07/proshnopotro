/**
 * Signed requests between the master and each portal. Both sides hold the
 * organisation's secret (the master's Organisation.syncSecret, the portal's
 * MASTER_SYNC_SECRET); a request carries
 *
 *   x-proshnopotro-signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
 *
 * over "<t>.<METHOD>.<path>.<body>". Requests older than five minutes are
 * refused, so a captured one cannot be replayed later.
 *
 * portal/lib/master-signature.ts is a copy of this file; keep them the same.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-proshnopotro-signature";
export const MAX_AGE_SECONDS = 300;

function digest(secret: string, t: number, method: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(`${t}.${method.toUpperCase()}.${path}.${body}`).digest("hex");
}

export function signRequest(secret: string, method: string, path: string, body = "", now: Date = new Date()): string {
  const t = Math.floor(now.getTime() / 1000);
  return `t=${t},v1=${digest(secret, t, method, path, body)}`;
}

export function verifyRequest(
  secret: string,
  header: string | null,
  method: string,
  path: string,
  body = "",
  now: Date = new Date()
): boolean {
  if (!secret || !header) return false;
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header.trim());
  if (!match) return false;
  const t = Number(match[1]);
  if (Math.abs(now.getTime() / 1000 - t) > MAX_AGE_SECONDS) return false;
  const expected = Buffer.from(digest(secret, t, method, path, body), "hex");
  const given = Buffer.from(match[2], "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
