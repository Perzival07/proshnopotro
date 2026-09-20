"use server";

import { requireCompleteStudent, requireStaff, studentScope, type SessionUser } from "@/lib/auth-utils";
import { canAccessStudent } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { checkDoubtBody, MAX_MESSAGES_PER_THREAD, statusAfterMessage } from "@/lib/doubts";
import { resultsVisible } from "@/lib/results-visibility";

export interface ThreadMessage {
  id: string;
  fromTutor: boolean;
  body: string;
  at: string;
}
export interface ThreadState {
  id: string;
  status: "OPEN" | "ANSWERED" | "RESOLVED";
  messages: ThreadMessage[];
}
type Result = { error?: string; thread?: ThreadState };

async function threadState(id: string): Promise<ThreadState> {
  const d = await prisma.doubt.findUniqueOrThrow({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return {
    id: d.id,
    status: d.status,
    messages: d.messages.map((m) => ({ id: m.id, fromTutor: m.fromTutor, body: m.body, at: m.createdAt.toISOString() })),
  };
}

/** A tutor answers only their own students' doubts; the owner answers anyone's. */
async function notYourDoubt(user: SessionUser, studentEmail: string): Promise<string | null> {
  const scope = await studentScope(user);
  return canAccessStudent(scope, studentEmail) ? null : "That student is not in your classrooms.";
}

// No revalidation, like the marking screen: the caller updates its own state,
// so the page under the loading boundary keeps its place.

/**
 * A student asks about a question, or follows up. Only their own attempt,
 * only a question of that paper, and only once they may see the result --
 * so a doubt cannot be used to look at a paper still being sat.
 */
export async function askDoubt(assignmentId: string, questionId: string, raw: string): Promise<Result> {
  const user = await requireCompleteStudent();
  const checked = checkDoubtBody(raw);
  if ("error" in checked) return { error: checked.error };

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      studentEmail: true,
      status: true,
      dueAt: true,
      test: { select: { id: true, resultRelease: true, resultsReleasedAt: true } },
    },
  });
  if (!assignment || assignment.studentEmail.toLowerCase() !== user.email.toLowerCase()) return { error: "Unauthorized." };
  if (assignment.status !== "SUBMITTED" || !resultsVisible(assignment.test, assignment)) {
    return { error: "You can ask about a question once your result is shown." };
  }
  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { section: { select: { testId: true } } } });
  if (!question || question.section.testId !== assignment.test.id) return { error: "That question is not in this paper." };

  const email = user.email.toLowerCase();
  const doubt = await prisma.doubt.upsert({
    where: { questionId_studentEmail: { questionId, studentEmail: email } },
    create: { questionId, studentEmail: email },
    update: {},
    select: { id: true, _count: { select: { messages: true } } },
  });
  if (doubt._count.messages >= MAX_MESSAGES_PER_THREAD) return { error: "This thread is full. Ask your tutor in person." };

  await prisma.$transaction([
    prisma.doubtMessage.create({ data: { doubtId: doubt.id, authorEmail: email, fromTutor: false, body: checked.body } }),
    prisma.doubt.update({ where: { id: doubt.id }, data: { status: statusAfterMessage(false), updatedAt: new Date(), studentUnread: false } }),
  ]);
  return { thread: await threadState(doubt.id) };
}

/** The student has opened a thread with a new reply in it. */
export async function markDoubtSeen(doubtId: string): Promise<{ success?: true }> {
  const user = await requireCompleteStudent();
  await prisma.doubt.updateMany({
    where: { id: doubtId, studentEmail: user.email.toLowerCase(), studentUnread: true },
    data: { studentUnread: false },
  });
  return { success: true };
}

/** How many doubts have a reply the student has not seen: for the nav badge. */
export async function getUnreadDoubtCount(): Promise<number> {
  const user = await requireCompleteStudent();
  return prisma.doubt.count({ where: { studentEmail: user.email.toLowerCase(), studentUnread: true } });
}

/** A student marks their own thread resolved (or reopens it). */
export async function setDoubtResolved(doubtId: string, resolved: boolean): Promise<Result> {
  const user = await requireCompleteStudent();
  const d = await prisma.doubt.findUnique({ where: { id: doubtId }, select: { studentEmail: true, messages: { where: { fromTutor: true }, take: 1, select: { id: true } } } });
  if (!d || d.studentEmail.toLowerCase() !== user.email.toLowerCase()) return { error: "Unauthorized." };
  await prisma.doubt.update({
    where: { id: doubtId },
    data: { status: resolved ? "RESOLVED" : d.messages.length ? "ANSWERED" : "OPEN" },
  });
  return { thread: await threadState(doubtId) };
}

/** A tutor's reply. */
export async function replyToDoubt(doubtId: string, raw: string): Promise<Result> {
  const admin = await requireStaff();
  const checked = checkDoubtBody(raw);
  if ("error" in checked) return { error: checked.error };
  const d = await prisma.doubt.findUnique({ where: { id: doubtId }, select: { id: true, studentEmail: true, _count: { select: { messages: true } } } });
  if (!d) return { error: "That doubt no longer exists." };
  const denied = await notYourDoubt(admin, d.studentEmail);
  if (denied) return { error: denied };
  if (d._count.messages >= MAX_MESSAGES_PER_THREAD) return { error: "This thread is full." };
  await prisma.$transaction([
    prisma.doubtMessage.create({ data: { doubtId, authorEmail: admin.email.toLowerCase(), fromTutor: true, body: checked.body } }),
    prisma.doubt.update({ where: { id: doubtId }, data: { status: statusAfterMessage(true), updatedAt: new Date(), studentUnread: true } }),
  ]);
  return { thread: await threadState(doubtId) };
}

export async function setDoubtStatus(doubtId: string, status: "OPEN" | "RESOLVED"): Promise<Result> {
  const user = await requireStaff();
  const d = await prisma.doubt.findUnique({ where: { id: doubtId }, select: { studentEmail: true } });
  if (!d) return { error: "That doubt no longer exists." };
  const denied = await notYourDoubt(user, d.studentEmail);
  if (denied) return { error: denied };
  await prisma.doubt.update({ where: { id: doubtId }, data: { status } });
  return { thread: await threadState(doubtId) };
}
