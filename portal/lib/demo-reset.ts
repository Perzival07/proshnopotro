/**
 * Puts the demo portal back to its starting content: every test, attempt,
 * class, note, doubt and series goes, then one class, one sample paper and
 * one note are written from lib/demo.ts. People stay, so everyone the super
 * admin approved can still sign in, and each student is given the paper again.
 *
 * Only ever called when this portal is the demo (the route checks org.slug).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { destroyAnswerImages, destroyNoteFile } from "@/lib/cloudinary";
import { DEMO_CLASSROOM, DEMO_NOTE, DEMO_SECTIONS, DEMO_TEST } from "@/lib/demo";

export async function resetDemoData(): Promise<{ students: number; tutors: number }> {
  // Stored files first, best effort: a demo reset must not stall on storage.
  const photos = await prisma.answerImage.findMany({ select: { publicId: true } });
  if (photos.length > 0) await destroyAnswerImages(photos.map((p) => p.publicId));
  for (const file of await prisma.noteFile.findMany()) await destroyNoteFile(file);

  await prisma.$transaction(async (tx) => {
    // Tests take their assignments, answers, results, photos rows, sections,
    // questions and doubts with them; notes and classes take their links.
    await tx.test.deleteMany({});
    await tx.doubt.deleteMany({});
    await tx.testSeries.deleteMany({});
    await tx.chapter.deleteMany({});
    await tx.note.deleteMany({});
    await tx.classroom.deleteMany({});
    await tx.user.updateMany({ where: { parentToken: { not: null } }, data: { parentToken: null } });

    const classroom = await tx.classroom.create({ data: DEMO_CLASSROOM, select: { id: true } });
    const test = await tx.test.create({
      data: {
        title: DEMO_TEST.title,
        subject: DEMO_TEST.subject,
        description: DEMO_TEST.description,
        format: "QUESTIONS",
        formUrl: "",
        durationMinutes: DEMO_TEST.durationMinutes,
        proctored: true,
        calculator: true,
        answerSheets: true,
        uploadMinutes: 10,
        resultRelease: "INSTANT",
        markingScheme: DEMO_TEST.markingScheme as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    for (const [position, section] of DEMO_SECTIONS.entries()) {
      const { id: sectionId } = await tx.testSection.create({
        data: { testId: test.id, title: section.title, position },
        select: { id: true },
      });
      await tx.question.createMany({
        data: section.questions.map((q, i) => ({
          sectionId,
          position: i,
          type: q.type,
          stem: q.stem,
          options: q.options,
          answerKey: q.key as unknown as Prisma.InputJsonValue,
          solution: q.solution,
        })),
      });
    }
    const note = await tx.note.create({
      data: { ...DEMO_NOTE, publishedAt: new Date() },
      select: { id: true },
    });
    await tx.noteClassroom.create({ data: { noteId: note.id, classroomId: classroom.id } });
  });

  const people = await prisma.user.findMany({ where: { role: { in: ["STUDENT", "TUTOR"] } }, select: { email: true, role: true } });
  for (const p of people) await enrolInDemo(p.email);
  return {
    students: people.filter((p) => p.role === "STUDENT").length,
    tutors: people.filter((p) => p.role === "TUTOR").length,
  };
}

/**
 * Puts someone just approved for the demo into the demo class: a student is
 * also given the sample paper, open for DEMO_TEST.openDays; a tutor can then
 * mark that class's sheets. Does nothing for owners, or when the sample
 * content has been deleted.
 */
export async function enrolInDemo(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  const classroom = await prisma.classroom.findUnique({ where: { name: DEMO_CLASSROOM.name }, select: { id: true } });
  if (!user || !classroom) return;
  if (user.role === "TUTOR") {
    await prisma.classroomTutor.upsert({
      where: { classroomId_tutorEmail: { classroomId: classroom.id, tutorEmail: email } },
      update: {},
      create: { classroomId: classroom.id, tutorEmail: email },
    });
    return;
  }
  if (user.role !== "STUDENT") return;
  await prisma.classroomMember.upsert({
    where: { classroomId_studentEmail: { classroomId: classroom.id, studentEmail: email } },
    update: {},
    create: { classroomId: classroom.id, studentEmail: email },
  });
  const test = await prisma.test.findFirst({ where: { title: DEMO_TEST.title, format: "QUESTIONS" }, select: { id: true } });
  if (!test) return;
  await prisma.assignment.upsert({
    where: { testId_studentEmail: { testId: test.id, studentEmail: email } },
    update: {},
    create: { testId: test.id, studentEmail: email, dueAt: new Date(Date.now() + DEMO_TEST.openDays * 86_400_000) },
  });
}
