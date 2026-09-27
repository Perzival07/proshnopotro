/**
 * What the master (the Proshnopotro super admin app) tells this portal about
 * itself: whether it is suspended, and its billing for the owner's Billing
 * page. Pure, so the parsing is tested; lib/master.ts does the fetching.
 */

export type MasterBilling = {
  studentCount: number;
  maxStudents: number | null;
  pricePerStudentInr: number;
  monthlyAmountInr: number;
  paidUpTo: string | null;
  billingStatus: "PAID" | "DUE" | "OVERDUE";
  countedAt: string | null;
  payments: { receivedOn: string; amountInr: number; reference: string }[];
  instructions: string;
};

export type MasterStatus = { status: "ACTIVE" | "SUSPENDED"; billing: MasterBilling };

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The master's reply, or null if it is not one this portal understands. */
export function parseMasterStatus(body: unknown): MasterStatus | null {
  const b = body as { status?: unknown; billing?: Record<string, unknown> } | null;
  if (!b || (b.status !== "ACTIVE" && b.status !== "SUSPENDED")) return null;
  const bill = b.billing;
  if (
    !bill ||
    !isInt(bill.studentCount) ||
    !(bill.maxStudents === null || isInt(bill.maxStudents)) ||
    !isInt(bill.pricePerStudentInr) ||
    !isInt(bill.monthlyAmountInr) ||
    !(bill.paidUpTo === null || isDay(bill.paidUpTo)) ||
    !["PAID", "DUE", "OVERDUE"].includes(bill.billingStatus as string) ||
    !(bill.countedAt === null || typeof bill.countedAt === "string") ||
    !Array.isArray(bill.payments) ||
    typeof bill.instructions !== "string"
  ) {
    return null;
  }
  const payments = bill.payments.filter(
    (p): p is MasterBilling["payments"][number] =>
      Boolean(p) && isDay(p.receivedOn) && isInt(p.amountInr) && typeof p.reference === "string"
  );
  return {
    status: b.status,
    billing: {
      studentCount: bill.studentCount,
      maxStudents: bill.maxStudents as number | null,
      pricePerStudentInr: bill.pricePerStudentInr,
      monthlyAmountInr: bill.monthlyAmountInr,
      paidUpTo: bill.paidUpTo as string | null,
      billingStatus: bill.billingStatus as MasterBilling["billingStatus"],
      countedAt: bill.countedAt as string | null,
      payments,
      instructions: bill.instructions,
    },
  };
}
