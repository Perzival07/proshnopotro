import React, { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { AssignClient } from "./AssignClient";

export const dynamic = "force-dynamic";

export default async function AdminAssignPage() {
  // Archived batches are left out of the classroom list: assigning a test to
  // a group that has finished is never the intention, and they would only
  // crowd the picker.
  const [tests, students, classrooms] = await Promise.all([
    prisma.test.findMany({
      where: { bank: false },
      select: {
        id: true,
        title: true,
        subject: true,
        active: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: {
        id: true,
        name: true,
        email: true,
        className: true,
        phone: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.classroom.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        subject: true,
        members: { select: { studentEmail: true }, orderBy: { addedAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <Suspense fallback={null}>
      <AssignClient
        tests={tests}
        students={students}
        classrooms={classrooms.map((c) => ({
          id: c.id,
          name: c.name,
          subject: c.subject,
          memberEmails: c.members.map((m) => m.studentEmail),
        }))}
      />
    </Suspense>
  );
}
