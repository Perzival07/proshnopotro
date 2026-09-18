import { NextResponse, type NextRequest } from "next/server";
import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { isTimeUp } from "@/lib/exam-timer";
import { paperFile } from "@/lib/question-paper";
import { pdfResponse } from "@/lib/pdf-response";

export const dynamic = "force-dynamic";

/**
 * The PDF question paper, for the student sitting this attempt.
 *
 * Served only while the attempt is open -- the student owns it, has started
 * it, and has neither submitted nor run out of time -- the same conditions
 * under which resolveSecureFormUrl hands out this address. Once the attempt
 * closes the paper is gone, rather than living on at a link that never
 * expires. Anything else gets the same "not found".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const user = await getVerifiedSession();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.assignmentId },
    include: { test: true, result: true },
  });

  const open =
    assignment &&
    assignment.studentEmail.toLowerCase() === user.email.trim().toLowerCase() &&
    assignment.test.active &&
    assignment.startedAt &&
    !isAssignmentSubmitted(assignment) &&
    !isTimeUp(assignment);
  const file = open && paperFile(assignment.test);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return pdfResponse(file, assignment.test.paperName || "question-paper.pdf");
}
