/** What a portal's roster reply may contain. Pure, so it is tested. */

/** More than any tuition organisation has; a reply beyond this is refused, not truncated. */
export const MAX_ROSTER = 50_000;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type StaffRole = "ADMIN" | "TUTOR";
export type Roster = { students: string[]; staff: { email: string; role: StaffRole }[] };

function email(value: unknown): string | null {
  return typeof value === "string" && value.length <= 320 && EMAIL.test(value.trim()) ? value.trim().toLowerCase() : null;
}

/**
 * The people in a portal's reply: its students (billed) and its owners and
 * tutors (shown in the hub only), lower-cased and de-duplicated. Someone
 * listed as both counts as staff. `staff` is optional, for a portal that
 * predates it.
 */
export function parseRoster(body: unknown): Roster | { error: string } {
  const reply = body as { students?: unknown; staff?: unknown } | null;
  const students = reply?.students;
  const staffIn = reply?.staff ?? [];
  if (!Array.isArray(students)) return { error: "The portal's reply has no student list." };
  if (!Array.isArray(staffIn)) return { error: "The portal's staff list is not a list." };
  if (students.length + staffIn.length > MAX_ROSTER) {
    return { error: `The portal sent ${students.length + staffIn.length} people, more than ${MAX_ROSTER}.` };
  }
  const staff = new Map<string, StaffRole>();
  for (const s of staffIn) {
    const e = email((s as { email?: unknown })?.email);
    const role = (s as { role?: unknown })?.role;
    if (!e || (role !== "ADMIN" && role !== "TUTOR")) return { error: "The portal's staff list has an entry that is not an email and role." };
    if (staff.get(e) !== "ADMIN") staff.set(e, role);
  }
  const studentSet = new Set<string>();
  for (const s of students) {
    const e = email(s);
    if (!e) return { error: "The portal's student list has something that is not an email address." };
    if (!staff.has(e)) studentSet.add(e);
  }
  return {
    students: Array.from(studentSet).sort(),
    staff: Array.from(staff, ([e, role]) => ({ email: e, role })).sort((a, b) => a.email.localeCompare(b.email)),
  };
}
