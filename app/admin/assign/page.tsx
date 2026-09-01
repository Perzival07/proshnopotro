import React from "react";
import { prisma } from "@/lib/prisma";
import { AssignClient } from "./AssignClient";

export const dynamic = "force-dynamic";

export default async function AdminAssignPage() {
  const tests = await prisma.test.findMany({
    select: {
      id: true,
      title: true,
      subject: true,
      active: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      name: true,
      email: true,
      className: true,
      phone: true,
    },
    orderBy: { name: "asc" },
  });

  return <AssignClient tests={tests} students={students} />;
}
