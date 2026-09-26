import React from "react";
import { prisma } from "@/lib/prisma";
import { NotesClient, type ClassroomOption, type NoteRow } from "./NotesClient";
import { requireAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function AdminNotesPage() {
  // Owner only: the layout lets tutors in, so every page says who may see it.
  await requireAdmin();
  const [notes, classrooms, students] = await Promise.all([
    prisma.note.findMany({
      include: {
        _count: { select: { files: true } },
        classrooms: {
          include: {
            classroom: {
              select: {
                id: true,
                name: true,
                members: { select: { studentEmail: true } },
              },
            },
          },
        },
        students: { select: { studentEmail: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.classroom.findMany({
      select: { id: true, name: true, active: true, _count: { select: { members: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, className: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: NoteRow[] = notes.map((n) => {
    // One student in two of a note's classrooms is still one student, so the
    // headline count is over the union rather than the sum.
    const recipients = new Set<string>(n.students.map((s) => s.studentEmail));
    n.classrooms.forEach((link) =>
      link.classroom.members.forEach((m) => recipients.add(m.studentEmail))
    );

    return {
      id: n.id,
      title: n.title,
      subject: n.subject,
      description: n.description,
      iconName: n.iconName,
      linkUrl: n.linkUrl,
      publishedAt: n.publishedAt,
      createdAt: n.createdAt,
      fileCount: n._count.files,
      classroomIds: n.classrooms.map((link) => link.classroom.id),
      classroomNames: n.classrooms.map((link) => link.classroom.name),
      studentEmails: n.students.map((s) => s.studentEmail),
      recipientCount: recipients.size,
    };
  });

  const classroomOptions: ClassroomOption[] = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    active: c.active,
    memberCount: c._count.members,
  }));

  return <NotesClient notes={rows} classrooms={classroomOptions} students={students} />;
}
