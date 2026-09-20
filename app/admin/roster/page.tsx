import React from "react";
import { prisma } from "@/lib/prisma";
import { RosterClient, RosterAssignment } from "./RosterClient";
import { requireAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

interface RosterPageProps {
  searchParams: Promise<{
    testId?: string;
  }>;
}

export default async function AdminRosterPage({ searchParams: searchParamsPromise }: RosterPageProps) {
  const searchParams = await searchParamsPromise;
  // Owner only: the layout lets tutors in, so every page says who may see it.
  await requireAdmin();
  const tests = await prisma.test.findMany({
    where: { bank: false },
    select: {
      id: true,
      title: true,
      subject: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const selectedTestId = searchParams.testId || tests[0]?.id || "";

  let assignments: RosterAssignment[] = [];

  if (selectedTestId) {
    const rawAssignments = await prisma.assignment.findMany({
      where: { testId: selectedTestId },
      include: {
        _count: { select: { answerImages: true } },
        result: {
          select: {
            id: true,
            score: true,
            maxScore: true,
            submittedAt: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    const emails = rawAssignments.map((a) => a.studentEmail.toLowerCase());
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        name: true,
        email: true,
        className: true,
        phone: true,
        profileComplete: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u]));

    assignments = rawAssignments.map((a) => ({
      id: a.id,
      studentEmail: a.studentEmail,
      assignedAt: a.assignedAt,
      dueAt: a.dueAt,
      startedAt: a.startedAt,
      status: a.status,
      autoSubmitted: a.autoSubmitted,
      tabSwitches: a.tabSwitches,
      answersUploadedAt: a.answersUploadedAt,
      answerPageCount: a._count.answerImages,
      user: userMap.get(a.studentEmail.toLowerCase()) || null,
      result: a.result,
    }));
  }

  return (
    <RosterClient
      tests={tests}
      selectedTestId={selectedTestId}
      assignments={assignments}
    />
  );
}
