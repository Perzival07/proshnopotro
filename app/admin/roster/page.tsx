import React from "react";
import { prisma } from "@/lib/prisma";
import { RosterClient, RosterAssignment } from "./RosterClient";

export const dynamic = "force-dynamic";

interface RosterPageProps {
  searchParams: {
    testId?: string;
  };
}

export default async function AdminRosterPage({ searchParams }: RosterPageProps) {
  const tests = await prisma.test.findMany({
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
