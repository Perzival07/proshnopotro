/**
 * Who may do what in the admin area.
 *
 * Two roles:
 *   ADMIN (the owner) - everything. Owners are the emails in ADMIN_EMAILS.
 *   TUTOR             - added by the owner on the Team page. Marks answer
 *                       sheets and answers doubts, only for students in the
 *                       classrooms they are assigned to.
 *
 * Everything not listed for a tutor is owner-only by default: an admin page
 * or action that does not say otherwise refuses a tutor. The two lists below
 * are what the Team page tells the owner, so what is written and what is
 * enforced are kept together.
 */

export type StaffRole = "ADMIN" | "TUTOR";

export const TUTOR_CAN = [
  "See the answer sheets of students in their classrooms, and mark them: draw on the pages, give marks, comment and return the copy.",
  "Answer doubts from students in their classrooms.",
] as const;

export const TUTOR_CANNOT = [
  "Create, edit, assign or delete tests, or change a paper's questions and answer keys. (They do see the questions and model answers of the sheets they mark.)",
  "See the student list, contacts or results outside their classrooms.",
  "Manage classrooms, notes, the syllabus, the question bank or test series.",
  "Add or remove other tutors.",
] as const;

/** Where each role lands after signing in. */
export function homeFor(role: "STUDENT" | "ADMIN" | "TUTOR"): string {
  if (role === "ADMIN") return "/admin/tests";
  if (role === "TUTOR") return "/admin/marking";
  return "/";
}

/**
 * Whether a staff member may act on this student. A scope of null means no
 * limit (the owner); otherwise it is the list of emails the tutor covers.
 */
export function canAccessStudent(scope: string[] | null, studentEmail: string): boolean {
  if (scope === null) return true;
  const e = studentEmail.trim().toLowerCase();
  return scope.some((s) => s.toLowerCase() === e);
}
