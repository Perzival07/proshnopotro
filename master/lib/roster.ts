/** What a portal's roster reply may contain. Pure, so it is tested. */

/** More than any tuition organisation has; a reply beyond this is refused, not truncated. */
export const MAX_ROSTER = 50_000;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The student emails in a portal's reply, lower-cased and de-duplicated, or an error. */
export function parseRoster(body: unknown): { emails: string[] } | { error: string } {
  const students = (body as { students?: unknown } | null)?.students;
  if (!Array.isArray(students)) return { error: "The portal's reply has no student list." };
  if (students.length > MAX_ROSTER) return { error: `The portal sent ${students.length} students, more than ${MAX_ROSTER}.` };
  const emails = new Set<string>();
  for (const s of students) {
    if (typeof s !== "string" || !EMAIL.test(s.trim()) || s.length > 320) {
      return { error: "The portal's student list has something that is not an email address." };
    }
    emails.add(s.trim().toLowerCase());
  }
  return { emails: Array.from(emails).sort() };
}
