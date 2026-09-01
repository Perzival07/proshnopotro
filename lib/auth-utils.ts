import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export interface SessionUser {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  role: "STUDENT" | "ADMIN";
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
    role: dbUser.role as "STUDENT" | "ADMIN",
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
    redirect("/");
  }

  return user;
}
