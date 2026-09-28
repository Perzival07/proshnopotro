import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** SUPER_ADMIN_EMAILS, lower-cased. Read on every call, so removing an address takes effect at once. */
export function envSuperAdmins(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * A super admin is listed in SUPER_ADMIN_EMAILS (fixed, set in Vercel) or was
 * added in the workspace's Settings (the SuperAdmin table). Checked on every
 * request, so removing someone takes effect at once.
 */
export async function isSuperAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase();
  if (envSuperAdmins().includes(e)) return true;
  return (await prisma.superAdmin.count({ where: { email: e } })) > 0;
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
  if (!(await isSuperAdmin(email))) redirect("/hub");
  return email;
}
