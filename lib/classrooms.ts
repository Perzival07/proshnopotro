import { normalizeEmail } from "@/lib/utils";
import { EMAIL_REGEX } from "@/lib/students";

/**
 * Classrooms: the batches the tutor actually teaches.
 *
 * A classroom is a named group of students who are given the same notes and
 * the same tests. It is not the same thing as `User.className` -- that records
 * the year a student is in, which is a fact about the student, whereas a
 * classroom is a decision the tutor makes about who learns together. A student
 * has one class and any number of classrooms.
 *
 * Membership is held by email, exactly as assignments are, so a student can be
 * put in a batch before they have ever signed in.
 */

/** Longest a classroom name may be, so it fits a card and a nav chip. */
export const MAX_CLASSROOM_NAME = 60;

/** Longest description, so the classroom card stays a card. */
export const MAX_CLASSROOM_DESCRIPTION = 500;

export interface ClassroomInput {
  name: string;
  subject?: string | null;
  description?: string | null;
  iconName?: string | null;
  active?: boolean;
}

export interface NormalizedClassroom {
  name: string;
  subject: string | null;
  description: string | null;
  iconName: string;
  active: boolean;
}

export type ClassroomValidation =
  | { ok: true; value: NormalizedClassroom }
  | { ok: false; error: string };

export function validateClassroom(input: ClassroomInput): ClassroomValidation {
  const name = (input.name || "").trim();
  const subject = (input.subject || "").trim();
  const description = (input.description || "").trim();

  if (!name) return { ok: false, error: "Give the classroom a name." };
  if (name.length > MAX_CLASSROOM_NAME) {
    return { ok: false, error: `The name must be ${MAX_CLASSROOM_NAME} characters or fewer.` };
  }
  if (description.length > MAX_CLASSROOM_DESCRIPTION) {
    return {
      ok: false,
      error: `The description must be ${MAX_CLASSROOM_DESCRIPTION} characters or fewer.`,
    };
  }

  return {
    ok: true,
    value: {
      name,
      subject: subject || null,
      description: description || null,
      iconName: (input.iconName || "").trim() || "GraduationCap",
      active: input.active ?? true,
    },
  };
}

export interface MemberEmails {
  /** Lower-cased, de-duplicated, in the order they were first seen. */
  valid: string[];
  /** Anything that did not look like an address, kept so it can be reported. */
  invalid: string[];
}

/**
 * Cleans a list of member emails.
 *
 * Membership rows are unique on (classroom, email), so two spellings of the
 * same address would either clash on write or silently create a duplicate
 * member. Both are avoided by normalizing before anything reaches the database.
 */
export function parseMemberEmails(raw: readonly string[]): MemberEmails {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const entry of raw) {
    const email = normalizeEmail(entry || "");
    if (!email) continue;
    if (!EMAIL_REGEX.test(email)) {
      invalid.push(email);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }

  return { valid, invalid };
}

/**
 * Which members to add and which to drop to make the stored list match the
 * requested one.
 *
 * Returned as a diff rather than "delete everything and re-insert" so that
 * `addedAt` survives an edit that only adds one student -- the tutor should
 * not lose when each member joined because they used the member editor.
 */
export function diffMembers(
  current: readonly string[],
  next: readonly string[]
): { toAdd: string[]; toRemove: string[] } {
  const currentSet = new Set(current.map((e) => normalizeEmail(e)));
  const nextSet = new Set(next.map((e) => normalizeEmail(e)));

  return {
    toAdd: Array.from(nextSet).filter((e) => !currentSet.has(e)),
    toRemove: Array.from(currentSet).filter((e) => !nextSet.has(e)),
  };
}

/** "3 students", "1 student", "No students yet" -- for cards and rows. */
export function memberCountLabel(count: number): string {
  if (count <= 0) return "No students yet";
  return `${count} student${count === 1 ? "" : "s"}`;
}
