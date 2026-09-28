import { prisma } from "@/lib/prisma";
import { destroyAnswerImages } from "@/lib/cloudinary";
import { EMAIL_REGEX, type NormalizedStudent } from "@/lib/students";
import { normalizeEmail } from "@/lib/utils";

/**
 * Adding and removing the people of this organisation: students, tutors and
 * owners. Shared by the owner's screens (app/admin/students, app/admin/team)
 * and by the master's signed requests (app/api/master/people), so both follow
 * the same rules. Callers check who is asking first; nothing here does.
 */

export type PeopleResult = { success: true } | { error: string };

/** Owners named in the server's ADMIN_EMAILS: made owners again at every sign-in, so they cannot be removed here. */
export function envOwnerEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** Test history that turning a student into staff would hide from them. */
async function hasStudentHistory(email: string): Promise<boolean> {
  const [assignments, memberships] = await Promise.all([
    prisma.assignment.count({ where: { studentEmail: email } }),
    prisma.classroomMember.count({ where: { studentEmail: email } }),
  ]);
  return assignments + memberships > 0;
}

export async function addStudentRecord({ name, email, phone, className }: NormalizedStudent): Promise<PeopleResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: `A ${existing.role.toLowerCase()} with the email ${email} already exists.` };
  }
  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      className,
      role: "STUDENT",
      // Added by staff, so the details are already on file: sending them
      // through onboarding to retype what was just entered would be busywork.
      // Google sign-in links to this row on their first login, because the
      // provider is configured to link by verified email.
      profileComplete: true,
    },
  });
  return { success: true };
}

/**
 * Removes someone and everything they did as a student. Their answer photos
 * go first, from Cloudinary: the rows are the only record of where the files
 * are, so deleting those first would leave pictures of a removed student in
 * storage for good. If any file cannot be removed, nothing is deleted and the
 * caller can simply try again.
 */
export async function removePersonRecord(where: { id: string } | { email: string }): Promise<PeopleResult> {
  const user = await prisma.user.findUnique({
    where: "email" in where ? { email: normalizeEmail(where.email) } : where,
    select: { id: true, email: true, role: true },
  });
  if (!user) return { error: "That person is not in this portal." };
  const email = normalizeEmail(user.email);
  if (user.role === "ADMIN" && envOwnerEmails().includes(email)) {
    return { error: `${email} is in the server's ADMIN_EMAILS setting; remove it there first.` };
  }

  const photos = await prisma.answerImage.findMany({
    where: { assignment: { studentEmail: email } },
    select: { publicId: true },
  });
  if (photos.length > 0) {
    const { failed } = await destroyAnswerImages(photos.map((p) => p.publicId));
    if (failed.length > 0) {
      return { error: `Could not delete ${failed.length} of their answer photos from storage. Nothing was removed; try again.` };
    }
  }

  await prisma.$transaction(async (tx) => {
    // Assignments are keyed by email rather than by user id, so deleting the
    // user alone would leave their rows behind: the roster would still list
    // the address, and signing in again with Google would hand the tests
    // straight back. Removing someone has to mean removing their work too.
    await tx.assignment.deleteMany({ where: { studentEmail: email } });
    // Same story for these: they hold the email with no foreign key to the
    // user. DoubtMessage rows go with their Doubt (onDelete: Cascade).
    await tx.classroomMember.deleteMany({ where: { studentEmail: email } });
    await tx.classroomTutor.deleteMany({ where: { tutorEmail: email } });
    await tx.noteStudent.deleteMany({ where: { studentEmail: email } });
    await tx.doubt.deleteMany({ where: { studentEmail: email } });
    await tx.user.delete({ where: { id: user.id } });
  });
  return { success: true };
}

/**
 * Makes someone a tutor. They then sign in with Google as usual and land on
 * their marking queue. Never turns a student who has test history into a
 * tutor: that would take away their own results.
 */
export async function addTutorRecord(rawEmail: string, rawName = ""): Promise<PeopleResult> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_REGEX.test(email)) return { error: "Enter the tutor's email address." };
  if (envOwnerEmails().includes(email)) return { error: "That is an owner already." };

  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing?.role === "ADMIN") return { error: "That is an owner already." };
  if (existing?.role === "TUTOR") return { error: "That person is already a tutor." };
  if (existing?.role === "STUDENT" && (await hasStudentHistory(email))) {
    return { error: "That email belongs to a student with test history. Use a different email for the tutor account." };
  }
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: "TUTOR", profileComplete: true } });
    return { success: true };
  }
  await prisma.user.create({
    data: { email, name: rawName.trim().slice(0, 80) || null, role: "TUTOR", profileComplete: true },
  });
  return { success: true };
}

/** Takes the tutor role away and their classrooms with it. */
export async function removeTutorRecord(rawEmail: string): Promise<PeopleResult> {
  const email = normalizeEmail(rawEmail);
  const tutor = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (tutor?.role !== "TUTOR") return { error: "That person is not a tutor." };
  await prisma.$transaction([
    prisma.classroomTutor.deleteMany({ where: { tutorEmail: email } }),
    // Back to an ordinary account: if they ever sign in as a student they
    // are asked for their details first.
    prisma.user.update({ where: { email }, data: { role: "STUDENT", profileComplete: false } }),
  ]);
  return { success: true };
}

/**
 * Makes someone an owner, who can do everything in this portal. Only the
 * master (the Proshnopotro super admin) does this; owners cannot make owners.
 */
export async function addOwnerRecord(rawEmail: string, rawName = ""): Promise<PeopleResult> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_REGEX.test(email)) return { error: "Enter the owner's email address." };
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing?.role === "ADMIN") return { error: "That person is an owner already." };
  if (existing?.role === "STUDENT" && (await hasStudentHistory(email))) {
    return { error: "That email belongs to a student with test history. Use a different email for the owner." };
  }
  await prisma.$transaction([
    // An owner sees every classroom, so a tutor's own list no longer means anything.
    prisma.classroomTutor.deleteMany({ where: { tutorEmail: email } }),
    prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN", profileComplete: true },
      create: { email, name: rawName.trim().slice(0, 80) || null, role: "ADMIN", profileComplete: true },
    }),
  ]);
  return { success: true };
}

/** Makes an owner an ordinary account again, as removing a tutor does. */
export async function removeOwnerRecord(rawEmail: string): Promise<PeopleResult> {
  const email = normalizeEmail(rawEmail);
  const owner = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (owner?.role !== "ADMIN") return { error: "That person is not an owner." };
  if (envOwnerEmails().includes(email)) {
    return { error: `${email} is in the server's ADMIN_EMAILS setting; remove it there first.` };
  }
  await prisma.user.update({ where: { email }, data: { role: "STUDENT", profileComplete: false } });
  return { success: true };
}

/** An owner who should only mark and answer doubts from now on. */
export async function ownerToTutorRecord(rawEmail: string): Promise<PeopleResult> {
  const email = normalizeEmail(rawEmail);
  const owner = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (owner?.role !== "ADMIN") return { error: "That person is not an owner." };
  if (envOwnerEmails().includes(email)) {
    return { error: `${email} is in the server's ADMIN_EMAILS setting; remove it there first.` };
  }
  await prisma.user.update({ where: { email }, data: { role: "TUTOR" } });
  return { success: true };
}
