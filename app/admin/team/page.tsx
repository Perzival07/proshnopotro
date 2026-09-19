import React from "react";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TeamClient } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireAdmin();
  const [tutors, classrooms] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TUTOR" },
      orderBy: { createdAt: "asc" },
      select: { email: true, name: true, image: true },
    }),
    prisma.classroom.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
  ]);
  const links = await prisma.classroomTutor.findMany({ select: { classroomId: true, tutorEmail: true } });
  const owners = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  return (
    <TeamClient
      owners={owners}
      classrooms={classrooms.map((c) => ({ id: c.id, name: c.name, students: c._count.members }))}
      initial={tutors.map((t) => ({
        email: t.email,
        name: t.name,
        classroomIds: links.filter((l) => l.tutorEmail === t.email).map((l) => l.classroomId),
      }))}
    />
  );
}
