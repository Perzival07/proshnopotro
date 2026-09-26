import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils";

/**
 * Who may see which notes.
 *
 * A student sees a note when it has been published (its publish time has
 * arrived) AND it is shared either with them by name or with a classroom they
 * belong to. That rule is written once, here, because it is enforced in three
 * places -- the notes list, a single note's page, and the action that mints
 * signed file links -- and three copies of it would be three chances for one
 * of them to drift into showing a draft.
 *
 * Membership is matched on the lower-cased email, the same key assignments
 * use, so a student who signs in with "Rahul@Gmail.com" is the same person the
 * tutor added as "rahul@gmail.com".
 */

/** The shape every note surface needs: what it is, and where it came from. */
const noteForStudent = {
  files: { orderBy: { position: "asc" } },
  classrooms: {
    include: { classroom: { select: { id: true, name: true, subject: true } } },
  },
} as const;

/** The `where` that decides whether one student may see a note. */
function visibleToStudent(email: string, now: Date) {
  return {
    publishedAt: { not: null, lte: now },
    OR: [
      { students: { some: { studentEmail: email } } },
      // An archived classroom still shows the notes it was already given:
      // ending a batch should not delete what its students were taught.
      { classrooms: { some: { classroom: { members: { some: { studentEmail: email } } } } } },
    ],
  };
}

/** Every note this student can currently open, newest publication first. */
export async function getVisibleNotes(email: string, now: Date = new Date()) {
  return prisma.note.findMany({
    where: visibleToStudent(normalizeEmail(email), now),
    include: noteForStudent,
    orderBy: { publishedAt: "desc" },
  });
}

/** One note, or null when it is not this student's to read. */
export async function getVisibleNote(
  email: string,
  noteId: string,
  now: Date = new Date()
) {
  return prisma.note.findFirst({
    where: { id: noteId, ...visibleToStudent(normalizeEmail(email), now) },
    include: noteForStudent,
  });
}

/**
 * The classrooms a student belongs to.
 *
 * Archived classrooms are left out: they are batches that have finished, and
 * listing them on the dashboard would suggest lessons that are still running.
 */
export async function getStudentClassrooms(email: string) {
  const memberships = await prisma.classroomMember.findMany({
    where: { studentEmail: normalizeEmail(email), classroom: { active: true } },
    include: {
      classroom: {
        select: { id: true, name: true, subject: true, description: true, iconName: true },
      },
    },
    orderBy: { classroom: { name: "asc" } },
  });
  return memberships.map((m) => m.classroom);
}

/** How many notes are waiting for this student, for the dashboard chip. */
export async function countVisibleNotes(email: string, now: Date = new Date()) {
  return prisma.note.count({ where: visibleToStudent(normalizeEmail(email), now) });
}
