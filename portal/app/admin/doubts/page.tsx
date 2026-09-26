import React from "react";
import { prisma } from "@/lib/prisma";
import { requireStaff, studentScope } from "@/lib/auth-utils";
import { DoubtsInbox, type InboxDoubt } from "./DoubtsInbox";

export const dynamic = "force-dynamic";

export default async function DoubtsInboxPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await searchParamsPromise;
  const user = await requireStaff();
  // A tutor sees only their classrooms' doubts.
  const scope = await studentScope(user);
  const mine = scope === null ? {} : { studentEmail: { in: scope } };
  const status = searchParams.status === "RESOLVED" || searchParams.status === "ANSWERED" || searchParams.status === "ALL" ? searchParams.status : "OPEN";
  const [rows, counts] = await Promise.all([
    prisma.doubt.findMany({
      where: { ...mine, ...(status === "ALL" ? {} : { status }) },
      orderBy: { updatedAt: status === "OPEN" ? "asc" : "desc" },
      take: 100,
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        question: { select: { stem: true, section: { select: { test: { select: { title: true } } } } } },
      },
    }),
    prisma.doubt.groupBy({ by: ["status"], where: mine, _count: true }),
  ]);
  const users = await prisma.user.findMany({
    where: { email: { in: Array.from(new Set(rows.map((r) => r.studentEmail))) } },
    select: { email: true, name: true },
  });
  const names = new Map(users.map((u) => [u.email, u.name]));
  const doubts: InboxDoubt[] = rows.map((d) => ({
    id: d.id,
    status: d.status,
    student: names.get(d.studentEmail) ?? d.studentEmail,
    email: d.studentEmail,
    paper: d.question.section.test.title,
    question: d.question.stem,
    updatedAt: d.updatedAt.toISOString(),
    messages: d.messages.map((m) => ({ id: m.id, fromTutor: m.fromTutor, body: m.body, at: m.createdAt.toISOString() })),
  }));
  return <DoubtsInbox initial={doubts} status={status} counts={Object.fromEntries(counts.map((c) => [c.status, c._count]))} />;
}
