"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { addTutorRecord, removeTutorRecord } from "@/lib/people";

type Result = { success?: true; error?: string };

// Like the marking screens, these return rather than revalidate; the page
// updates its own state.

/**
 * Makes someone a tutor (lib/people.ts has the rules). Owners are added only
 * by Proshnopotro, from the master.
 */
export async function addTutor(rawEmail: string, rawName: string): Promise<Result> {
  await requireAdmin();
  return addTutorRecord(rawEmail, rawName);
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
  return removeTutorRecord(email);
}
