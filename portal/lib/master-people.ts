/**
 * What the master (the Proshnopotro super admin) may ask this portal to do to
 * its people, over the signed POST /api/master/people. Pure, so the parsing is
 * tested; the route carries it out with lib/people.ts.
 *
 * master/lib/portal-people.ts builds these; keep the two in step.
 */
import { EMAIL_REGEX, isValidClass } from "@/lib/students";

export type PersonRole = "STUDENT" | "TUTOR" | "ADMIN";

export type PeopleCommand =
  | { action: "add"; role: PersonRole; email: string; name: string; phone: string | null; className: string | null }
  | { action: "remove"; email: string }
  | { action: "setRole"; email: string; role: PersonRole };

const ROLES: readonly string[] = ["STUDENT", "TUTOR", "ADMIN"];

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parsePeopleCommand(body: unknown): PeopleCommand | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = str(b.email, 320).toLowerCase();
  if (!EMAIL_REGEX.test(email)) return { error: "Not an email address." };
  const role = b.role;

  switch (b.action) {
    case "add": {
      if (typeof role !== "string" || !ROLES.includes(role)) return { error: "Unknown role." };
      const name = str(b.name, 80);
      const phone = str(b.phone, 20) || null;
      const className = str(b.className, 60) || null;
      if (role === "STUDENT" && !name) return { error: "A student needs a name." };
      if (className && !isValidClass(className)) return { error: "Not one of the portal's classes." };
      return { action: "add", role: role as PersonRole, email, name, phone, className };
    }
    case "remove":
      return { action: "remove", email };
    case "setRole":
      if (typeof role !== "string" || !ROLES.includes(role)) return { error: "Unknown role." };
      return { action: "setRole", email, role: role as PersonRole };
    default:
      return { error: "Unknown action." };
  }
}
