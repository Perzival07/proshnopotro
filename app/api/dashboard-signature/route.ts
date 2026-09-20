import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { dashboardSignature } from "@/lib/dashboard-signature";
import { resultsVisible } from "@/lib/results-visibility";

export const dynamic = "force-dynamic";

/**
 * A fingerprint of the signed-in student's dashboard, so an open page can tell
 * when something changed (a test assigned, opened, turned off, marked) and
 * redraw itself. Own data only, and nothing but a hash-sized string leaves.
 */
export async function GET() {
  const user = await getVerifiedSession();
  if (!user || user.role !== "STUDENT") {
    return NextResponse.json({ signature: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const email = user.email.toLowerCase();

  const [assignments, unread, notes] = await Promise.all([
    prisma.assignment.findMany({
      where: { studentEmail: email },
      select: {
        id: true,
        status: true,
        dueAt: true,
        opensAt: true,
        returnedAt: true,
        result: { select: { id: true } },
        test: { select: { active: true, format: true, resultRelease: true, resultsReleasedAt: true } },
      },
    }),
    prisma.doubt.count({ where: { studentEmail: email, studentUnread: true } }),
    prisma.classroomMember.count({ where: { studentEmail: email } }),
  ]);

  const signature = dashboardSignature(
    assignments.map((a) => ({
      id: a.id,
      status: a.status,
      active: a.test.active,
      dueAt: a.dueAt,
      opensAt: a.opensAt,
      // A score the student may not see yet must not change what they see.
      hasResult: a.result !== null && resultsVisible(a.test, a),
      returnedAt: a.returnedAt,
      resultsReleasedAt: a.test.resultsReleasedAt,
    })),
    [`u${unread}`, `c${notes}`]
  );
  return NextResponse.json({ signature }, { headers: { "Cache-Control": "no-store" } });
}
