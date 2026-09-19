"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { EMAIL_REGEX } from "@/lib/students";

type Result = { success?: true; error?: string };

// Like the marking screens, these return rather than revalidate; the page
// updates its own state.

const ownerEmails = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/**
 * Makes someone a tutor. They then sign in with Google as usual and land on
 * their marking queue. Never turns an owner, or a student who has test
 * history, into a tutor: that would take away their own results.
 */
export async function addTutor(rawEmail: string, rawName: string): Promise<Result> {
  await requireAdmin();
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) return { error: "Enter the tutor's email address." };
  if (ownerEmails().includes(email)) return { error: "That is an owner already." };

  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing?.role === "ADMIN") return { error: "That is an owner already." };
  if (existing?.role === "TUTOR") return { error: "That person is already a tutor." };
  if (existing) {
    const [assignments, memberships] = await Promise.all([
      prisma.assignment.count({ where: { studentEmail: email } }),
      prisma.classroomMember.count({ where: { studentEmail: email } }),
    ]);
    if (assignments + memberships > 0) {
      return { error: "That email belongs to a student with test history. Use a different email for the tutor account." };
    }
    await prisma.user.update({ where: { email }, data: { role: "TUTOR", profileComplete: true } });
    return { success: true };
  }
  await prisma.user.create({
    data: { email, name: rawName.trim().slice(0, 80) || null, role: "TUTOR", profileComplete: true },
  });
  return { success: true };
}

/** Replaces the classrooms a tutor is responsible for. */
export async function setTutorClassrooms(email: string, classroomIds: string[]): Promise<Result> {
  await requireAdmin();
  const tutor = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { role: true } });
  if (tutor?.role !== "TUTOR") return { error: "That person is not a tutor." };
  const valid = await prisma.classroom.findMany({ where: { id: { in: classroomIds } }, select: { id: true } });
  await prisma.$transaction([
    prisma.classroomTutor.deleteMany({ where: { tutorEmail: email.toLowerCase() } }),
    prisma.classroomTutor.createMany({
      data: valid.map((c) => ({ classroomId: c.id, tutorEmail: email.toLowerCase() })),
      skipDuplicates: true,
    }),
  ]);
  return { success: true };
}

/** Takes the tutor role away and their classrooms with it. */
export async function removeTutor(email: string): Promise<Result> {
  await requireAdmin();
  const e = email.toLowerCase();
  const tutor = await prisma.user.findUnique({ where: { email: e }, select: { role: true } });
  if (tutor?.role !== "TUTOR") return { error: "That person is not a tutor." };
  await prisma.$transaction([
    prisma.classroomTutor.deleteMany({ where: { tutorEmail: e } }),
    // Back to an ordinary account: if they ever sign in as a student they
    // are asked for their details first.
    prisma.user.update({ where: { email: e }, data: { role: "STUDENT", profileComplete: false } }),
  ]);
  return { success: true };
}
