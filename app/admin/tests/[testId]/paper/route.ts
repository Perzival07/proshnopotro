import { NextResponse, type NextRequest } from "next/server";
import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { paperFile } from "@/lib/question-paper";
import { pdfResponse } from "@/lib/pdf-response";

export const dynamic = "force-dynamic";

/**
 * The PDF question paper on a test, for the tutor to check. Route handlers sit
 * outside the admin layout's guard, so the role is checked here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  const user = await getVerifiedSession();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user.role !== "ADMIN") {
    return new NextResponse("Not found", { status: 404 });
  }

  const test = await prisma.test.findUnique({
    where: { id: params.testId },
    select: { paperPublicId: true, paperVersion: true, paperName: true },
  });
  const file = test && paperFile(test);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return pdfResponse(file, test.paperName || "question-paper.pdf");
}
