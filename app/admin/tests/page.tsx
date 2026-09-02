import React from "react";
import { prisma } from "@/lib/prisma";
import { TestsClient } from "./TestsClient";

export const dynamic = "force-dynamic";

export default async function AdminTestsPage() {
  const tests = await prisma.test.findMany({
    include: {
      _count: {
        select: { assignments: true },
      },
      assignments: {
        select: {
          status: true,
          result: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedTests = tests.map((t) => {
    const submittedCount = t.assignments.filter(
      (a) => a.status === "SUBMITTED" || a.result !== null
    ).length;

    return {
      id: t.id,
      title: t.title,
      subject: t.subject,
      description: t.description,
      iconName: t.iconName,
      format: t.format,
      formUrl: t.formUrl,
      durationMinutes: t.durationMinutes,
      active: t.active,
      createdAt: t.createdAt,
      _count: t._count,
      submittedCount,
    };
  });

  return <TestsClient tests={formattedTests} />;
}
