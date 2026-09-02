import React from "react";
import { prisma } from "@/lib/prisma";
import { StudentsClient, type StudentRow } from "./StudentsClient";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const users = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      className: true,
      profileComplete: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Assignments are keyed by email, not by user id, so the counts are gathered
  // in one grouped query and matched up here rather than with a relation.
  const grouped = await prisma.assignment.groupBy({
    by: ["studentEmail"],
    _count: { _all: true },
  });
  const assignmentCounts = new Map(
    grouped.map((g) => [g.studentEmail.toLowerCase(), g._count._all])
  );

  const students: StudentRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    className: u.className,
    profileComplete: u.profileComplete,
    createdAt: u.createdAt,
    assignmentCount: assignmentCounts.get(u.email.toLowerCase()) ?? 0,
  }));

  return <StudentsClient students={students} />;
}
