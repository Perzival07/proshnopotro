import { normalizeEmail } from "@/lib/utils";

/**
 * The classes a student can be in.
 *
 * One list, used by the registration form and by the tutor's student editor,
 * so a class picked in one place is always a class the other recognises.
 * Free text would let "class 12", "Class XII" and "Class 12 " all coexist and
 * quietly split the roster into groups that look identical on screen.
 */
export const CLASS_OPTIONS = [
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

export type ClassOption = (typeof CLASS_OPTIONS)[number];

export function isValidClass(value: string): boolean {
  return (CLASS_OPTIONS as readonly string[]).includes(value);
}

/** Deliberately permissive: enough to catch a typo, not to police addresses. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export interface StudentInput {
  name: string;
  email: string;
  phone?: string | null;
  className?: string | null;
}

export interface NormalizedStudent {
  name: string;
  email: string;
  phone: string | null;
  className: string | null;
}

export type StudentValidation =
  | { ok: true; value: NormalizedStudent }
  | { ok: false; error: string };

/**
 * Validates and normalizes what the tutor typed.
 *
 * The email is lower-cased here because assignments are matched to students by
 * email string, not by user id -- a student stored as "Rahul@Gmail.com" would
 * simply never see a test assigned to "rahul@gmail.com".
 */
export function validateStudent(input: StudentInput): StudentValidation {
  const name = input.name.trim();
  const email = normalizeEmail(input.email || "");
  const phone = (input.phone || "").trim();
  const className = (input.className || "").trim();

  if (!name) return { ok: false, error: "The student's name is required." };
  if (!email) return { ok: false, error: "An email address is required." };
  if (!isValidEmail(email)) {
    return { ok: false, error: `"${input.email.trim()}" is not a valid email address.` };
  }
  if (className && !isValidClass(className)) {
    return { ok: false, error: "Choose a class from the list." };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      // Empty is stored as null rather than "", so "no phone recorded" is one
      // value everywhere instead of two that render differently.
      phone: phone || null,
      className: className || null,
    },
  };
}
