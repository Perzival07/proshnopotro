import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/permissions";

export interface SessionUser {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  role: "STUDENT" | "ADMIN" | "TUTOR";
  profileComplete: boolean;
  phone?: string | null;
  className?: string | null;
}

/**
 * Server-side session validator.
 * Re-reads and strictly verifies session identity against DB.
 */
export async function getVerifiedSession(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }

  const normalizedEmail = session.user.email.trim().toLowerCase();

  // Fresh server query to guarantee no stale JWT tampering
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      profileComplete: true,
      phone: true,
      className: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    image: dbUser.image,
    role: dbUser.role as "STUDENT" | "ADMIN" | "TUTOR",
    profileComplete: dbUser.profileComplete,
    phone: dbUser.phone,
    className: dbUser.className,
  };
}

/**
 * Requires a valid logged-in user. Redirects to /login if unauthenticated.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getVerifiedSession();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Requires complete profile. Redirects to /onboarding if profile is incomplete.
 */
export async function requireCompleteStudent(): Promise<SessionUser> {
  const user = await requireAuth();

  // A tutor has no student dashboard: theirs is the marking queue.
  if (user.role === "TUTOR") redirect(homeFor("TUTOR"));

  // If student profile is incomplete and not admin, redirect to onboarding
  if (!user.profileComplete && user.role !== "ADMIN") {
    redirect("/onboarding");
  }

  return user;
}

/**
 * Enforces admin access strictly on the server side.
 * Never trust client role headers.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();

  if (user.role !== "ADMIN") {
    // A tutor who wanders onto an owner-only page goes back to their own work.
    redirect(homeFor(user.role));
  }

  return user;
}

/**
 * The owner or a tutor: for the few places tutors share (marking, doubts).
 * What a tutor may see there is limited by `studentScope`.
 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "TUTOR") redirect("/");
  return user;
}

/**
 * The students this staff member may act on: null for the owner (all of
 * them), otherwise the members of the classrooms they are a tutor of.
 */
export async function studentScope(user: SessionUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;
  const rows = await prisma.classroomMember.findMany({
    where: { classroom: { tutors: { some: { tutorEmail: user.email.toLowerCase() } } } },
    select: { studentEmail: true },
    distinct: ["studentEmail"],
  });
  return rows.map((r) => r.studentEmail.toLowerCase());
}
