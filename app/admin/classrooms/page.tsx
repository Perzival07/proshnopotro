import React from "react";
import { prisma } from "@/lib/prisma";
import { ClassroomsClient, type ClassroomRow } from "./ClassroomsClient";

export const dynamic = "force-dynamic";

export default async function AdminClassroomsPage() {
  const [classrooms, students] = await Promise.all([
    prisma.classroom.findMany({
      include: {
        members: { select: { studentEmail: true }, orderBy: { addedAt: "asc" } },
        _count: { select: { notes: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, className: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: ClassroomRow[] = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    description: c.description,
    iconName: c.iconName,
    active: c.active,
    createdAt: c.createdAt,
    memberEmails: c.members.map((m) => m.studentEmail),
    noteCount: c._count.notes,
  }));

  return <ClassroomsClient classrooms={rows} students={students} />;
}
