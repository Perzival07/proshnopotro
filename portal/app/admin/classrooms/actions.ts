"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  diffMembers,
  parseMemberEmails,
  validateClassroom,
  type ClassroomInput,
} from "@/lib/classrooms";

/** Every surface that shows classrooms or is driven by them. */
function revalidateClassroomViews() {
  revalidatePath("/admin/classrooms");
  revalidatePath("/admin/notes");
  revalidatePath("/admin/assign");
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function createClassroom(data: ClassroomInput) {
  await requireAdmin();

  const parsed = validateClassroom(data);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.classroom.findUnique({
    where: { name: parsed.value.name },
    select: { id: true },
  });
  if (existing) {
    return { error: `A classroom called "${parsed.value.name}" already exists.` };
  }

  try {
    const classroom = await prisma.classroom.create({ data: parsed.value });
    revalidateClassroomViews();
    return { success: true, classroomId: classroom.id };
  } catch (error) {
    console.error("Error creating classroom:", error);
    return { error: "Failed to create the classroom." };
  }
}

export async function updateClassroom(id: string, data: ClassroomInput) {
  await requireAdmin();

  const parsed = validateClassroom(data);
  if (!parsed.ok) return { error: parsed.error };

  const clash = await prisma.classroom.findUnique({
    where: { name: parsed.value.name },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    return { error: `A classroom called "${parsed.value.name}" already exists.` };
  }

  try {
    await prisma.classroom.update({ where: { id }, data: parsed.value });
    revalidateClassroomViews();
    return { success: true };
  } catch (error) {
    console.error("Error updating classroom:", error);
    return { error: "Failed to save the changes." };
  }
}

export async function toggleClassroomActive(id: string, active: boolean) {
  await requireAdmin();

  try {
    await prisma.classroom.update({ where: { id }, data: { active } });
    revalidateClassroomViews();
    return { success: true };
  } catch (error) {
    console.error("Error archiving classroom:", error);
    return { error: "Failed to change the classroom's status." };
  }
}

/**
 * Replaces the member list with exactly the emails given.
 *
 * Written as a diff rather than a delete-and-reinsert so that adding one
 * student does not reset when everyone else joined, and so the unique
 * (classroom, email) pair is never momentarily empty while a request is in
 * flight.
 */
export async function setClassroomMembers(id: string, emails: string[]) {
  await requireAdmin();

  const classroom = await prisma.classroom.findUnique({
    where: { id },
    select: { id: true, members: { select: { studentEmail: true } } },
  });
  if (!classroom) return { error: "That classroom no longer exists." };

  const parsed = parseMemberEmails(emails);
  if (parsed.invalid.length > 0) {
    return {
      error: `These are not valid email addresses: ${parsed.invalid.slice(0, 3).join(", ")}${
        parsed.invalid.length > 3 ? "…" : ""
      }`,
    };
  }

  const { toAdd, toRemove } = diffMembers(
    classroom.members.map((m) => m.studentEmail),
    parsed.valid
  );

  if (toAdd.length === 0 && toRemove.length === 0) {
    return { success: true, added: 0, removed: 0 };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.classroomMember.deleteMany({
          where: { classroomId: id, studentEmail: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.classroomMember.createMany({
          data: toAdd.map((studentEmail) => ({ classroomId: id, studentEmail })),
          skipDuplicates: true,
        });
      }
    });

    revalidateClassroomViews();
    return { success: true, added: toAdd.length, removed: toRemove.length };
  } catch (error) {
    console.error("Error saving classroom members:", error);
    return { error: "Failed to save the student list." };
  }
}

export interface ClassroomFootprint {
  members: number;
  notes: number;
  /** Notes that would be left with no audience at all once this batch goes. */
  orphanedNotes: number;
}

/**
 * What deleting this classroom would take with it, so the confirmation can
 * state it in numbers rather than asking the tutor to take it on trust.
 */
export async function getClassroomFootprint(
  id: string
): Promise<ClassroomFootprint | { error: string }> {
  await requireAdmin();

  const classroom = await prisma.classroom.findUnique({
    where: { id },
    select: { id: true, _count: { select: { members: true, notes: true } } },
  });
  if (!classroom) return { error: "That classroom no longer exists." };

  // A note shared only with this classroom becomes unreachable: it keeps its
  // files but nobody is left who can open it.
  const orphanedNotes = await prisma.note.count({
    where: {
      classrooms: { some: { classroomId: id }, every: { classroomId: id } },
      students: { none: {} },
    },
  });

  return {
    members: classroom._count.members,
    notes: classroom._count.notes,
    orphanedNotes,
  };
}

export async function deleteClassroom(id: string) {
  await requireAdmin();

  const classroom = await prisma.classroom.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!classroom) return { error: "That classroom no longer exists." };

  try {
    // Membership rows and note shares cascade with the classroom; the notes
    // themselves are deliberately left alone, so material the tutor wrote is
    // never destroyed by tidying up a batch.
    await prisma.classroom.delete({ where: { id } });
    revalidateClassroomViews();
    return { success: true };
  } catch (error) {
    console.error("Error deleting classroom:", error);
    return { error: "Failed to remove the classroom." };
  }
}
