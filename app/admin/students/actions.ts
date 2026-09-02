"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { validateStudent, type StudentInput } from "@/lib/students";
import { normalizeEmail } from "@/lib/utils";

/** Every surface that shows students or their work. */
function revalidateStudentViews() {
  revalidatePath("/admin/students");
  revalidatePath("/admin/assign");
  revalidatePath("/admin/roster");
  revalidatePath("/");
}

export async function createStudent(data: StudentInput) {
  await requireAdmin();

  const parsed = validateStudent(data);
  if (!parsed.ok) return { error: parsed.error };
  const { name, email, phone, className } = parsed.value;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: `A ${existing.role.toLowerCase()} with the email ${email} already exists.` };
  }

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        className,
        role: "STUDENT",
        // Added by the tutor, so the details are already on file: sending them
        // through onboarding to retype what was just entered would be busywork.
        // Google sign-in links to this row on their first login, because the
        // provider is configured to link by verified email.
        profileComplete: true,
      },
    });

    revalidateStudentViews();
    return { success: true };
  } catch (error) {
    console.error("Error creating student:", error);
    return { error: "Failed to add the student." };
  }
}

export async function updateStudent(id: string, data: StudentInput) {
  await requireAdmin();

  const parsed = validateStudent(data);
  if (!parsed.ok) return { error: parsed.error };
  const { name, email, phone, className } = parsed.value;

  const current = await prisma.user.findUnique({
    where: { id },
    select: { email: true, role: true },
  });
  if (!current) return { error: "That student no longer exists." };

  const emailChanged = current.email.toLowerCase() !== email;

  if (emailChanged) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash) return { error: `${email} is already registered to another account.` };
  }

  try {
    // An assignment points at a student by email string, so changing the email
    // without moving the assignments would silently strip the student of every
    // test they have been set. Both move together or neither does.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { name, email, phone, className, profileComplete: true },
      });

      if (emailChanged) {
        await tx.assignment.updateMany({
          where: { studentEmail: current.email.toLowerCase() },
          data: { studentEmail: email },
        });
      }
    });

    revalidateStudentViews();
    return { success: true, emailChanged };
  } catch (error) {
    console.error("Error updating student:", error);
    return { error: "Failed to save the changes." };
  }
}

export interface StudentFootprint {
  assignments: number;
  results: number;
}

/**
 * What would be destroyed along with this student, so the confirmation can say
 * so in plain numbers rather than asking the tutor to take it on trust.
 */
export async function getStudentFootprint(id: string): Promise<StudentFootprint | { error: string }> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!user) return { error: "That student no longer exists." };

  const email = normalizeEmail(user.email);
  const assignments = await prisma.assignment.count({ where: { studentEmail: email } });
  const results = await prisma.result.count({
    where: { assignment: { studentEmail: email } },
  });

  return { assignments, results };
}

export async function deleteStudent(id: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, role: true },
  });
  if (!user) return { error: "That student no longer exists." };

  // Removing the last admin would lock everyone out of this console for good.
  if (user.role === "ADMIN") {
    return { error: "Admin accounts cannot be deleted here." };
  }

  const email = normalizeEmail(user.email);

  try {
    await prisma.$transaction(async (tx) => {
      // Assignments are keyed by email rather than by user id, so deleting the
      // user alone would leave their rows behind: the roster would still list
      // the address, and signing in again with Google would hand the tests
      // straight back. Removing a student has to mean removing their work too.
      await tx.assignment.deleteMany({ where: { studentEmail: email } });
      await tx.user.delete({ where: { id } });
    });

    revalidateStudentViews();
    return { success: true };
  } catch (error) {
    console.error("Error deleting student:", error);
    return { error: "Failed to remove the student." };
  }
}
