import React from "react";
import { prisma } from "@/lib/prisma";
import { TestsClient } from "./TestsClient";
import { requireAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function AdminTestsPage() {
  // Owner only: the layout lets tutors in, so every page says who may see it.
  await requireAdmin();
  const tests = await prisma.test.findMany({
    // Past papers live in the question bank, not among the tests.
    where: { bank: false },
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
      proctored: t.proctored,
      active: t.active,
      resultRelease: t.resultRelease,
      answerSheets: t.answerSheets,
      calculator: t.calculator,
      board: t.board,
      uploadMinutes: t.uploadMinutes,
      kind: t.kind,
      classLevel: t.classLevel,
      createdAt: t.createdAt,
      _count: t._count,
      submittedCount,
    };
  });

  return <TestsClient tests={formattedTests} />;
}
