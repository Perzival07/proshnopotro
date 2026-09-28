import { SIGNATURE_HEADER, signRequest } from "./signature";

/**
 * Changes an organisation's people in its own portal: the super admin adds,
 * removes and changes the role of students, tutors and owners. Sent as a
 * signed POST to the portal's /api/master/people, whose parser
 * (portal/lib/master-people.ts) must accept every command built here.
 */

export const PEOPLE_PATH = "/api/master/people";

export type PersonRole = "STUDENT" | "TUTOR" | "ADMIN";

export const ROLE_LABEL: Record<string, string> = { STUDENT: "Student", TUTOR: "Tutor", ADMIN: "Owner" };

/** The portal's classes (portal/lib/students.ts CLASS_OPTIONS); keep the two the same. */
export const CLASS_OPTIONS = [
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 11 - Science",
  "Class 12",
  "Class 12 - Science",
  "NEET / JEE Repeater",
  "Foundation Batch",
] as const;

export type PeopleCommand =
  | { action: "add"; role: PersonRole; email: string; name: string; phone: string | null; className: string | null }
  | { action: "remove"; email: string }
  | { action: "setRole"; email: string; role: PersonRole };

export async function sendPeopleCommand(
  portalUrl: string,
  secret: string,
  command: PeopleCommand
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = JSON.stringify(command);
  let res: Response;
  try {
    res = await fetch(`${portalUrl}${PEOPLE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signRequest(secret, "POST", PEOPLE_PATH, body) },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return { ok: false, error: `Could not reach the portal (${err instanceof Error ? err.message : "network error"}).` };
  }
  if (res.status === 401) return { ok: false, error: "The portal refused the request: its MASTER_SYNC_SECRET does not match." };
  if (res.status === 503) return { ok: false, error: "The portal has no MASTER_SYNC_SECRET set." };
  if (res.status === 404) return { ok: false, error: "The portal is on an older version without this feature: redeploy it." };
  let reply: { error?: unknown } = {};
  try {
    reply = await res.json();
  } catch {
    // An answer without JSON is judged by its status alone.
  }
  if (!res.ok) {
    return { ok: false, error: typeof reply.error === "string" ? `The portal said: ${reply.error}` : `The portal answered ${res.status}.` };
  }
  return { ok: true };
}
