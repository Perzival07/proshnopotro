import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** SUPER_ADMIN_EMAILS, lower-cased. Read on every call, so removing an address takes effect at once. */
function superAdmins(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  return Boolean(email) && superAdmins().includes(email!.toLowerCase());
}

/** The signed-in email, or a trip to the login page. */
export async function requireSignedIn(next: string): Promise<string> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect(`/login?next=${encodeURIComponent(next)}`);
  return email;
}

/**
 * Every super admin page and server action starts here. A signed-in account
 * that is not a super admin gets the hub instead of an error, since that is
 * almost always a student who followed the wrong link.
 */
export async function requireSuperAdmin(): Promise<string> {
  const email = await requireSignedIn("/admin");
  if (!isSuperAdmin(email)) redirect("/hub");
  return email;
}
