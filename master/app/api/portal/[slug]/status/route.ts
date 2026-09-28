import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SIGNATURE_HEADER, verifyRequest } from "@/lib/signature";
import { billingStatus, dateKey, monthlyAmount, todayIst } from "@/lib/billing";
import { getSettings } from "@/lib/settings";

/**
 * What a portal asks the master, a few times an hour: is it suspended, and
 * what does its admin's billing page show. Signed with the organisation's
 * sync secret; an unknown slug and a bad signature get the same answer, so
 * the endpoint does not reveal which organisations exist.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = new URL(request.url).pathname;
  const org = await prisma.organisation.findUnique({
    where: { slug },
    include: { payments: { orderBy: { receivedOn: "desc" }, take: 24 } },
  });
  if (!org || !verifyRequest(org.syncSecret, request.headers.get(SIGNATURE_HEADER), "GET", path)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paidUpTo = org.paidUpTo ? dateKey(org.paidUpTo) : null;
  return NextResponse.json(
    {
      status: org.status,
      billing: {
        studentCount: org.studentCount,
        maxStudents: org.maxStudents,
        pricePerStudentInr: org.pricePerStudentInr,
        monthlyAmountInr: monthlyAmount(org.studentCount, org.pricePerStudentInr),
        paidUpTo,
        billingStatus: billingStatus({ paidUpTo, createdOn: dateKey(org.createdAt) }, todayIst()),
        countedAt: org.lastSyncAt?.toISOString() ?? null,
        payments: org.payments.map((p) => ({
          receivedOn: dateKey(p.receivedOn),
          amountInr: p.amountInr,
          reference: p.reference,
        })),
        instructions: (await getSettings()).paymentInstructions,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
