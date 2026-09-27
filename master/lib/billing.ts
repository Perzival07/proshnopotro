/**
 * Billing rules for the super admin's dashboard. Organisations pay per
 * enrolled student per month, outside the app; the master only tracks it.
 *
 * Dates here are calendar days as "YYYY-MM-DD" strings, in India time, so a
 * payment recorded at 1 a.m. IST never lands on the previous day.
 */

export type BillingStatus = "PAID" | "DUE" | "OVERDUE";

/** How long after the paid-up-to date an unpaid organisation is "due" rather than "overdue". */
export const GRACE_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in India, as "YYYY-MM-DD". */
export function todayIst(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** A date column (stored at UTC midnight) as "YYYY-MM-DD". */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> the Date Prisma stores for a date column. */
export function fromDateKey(key: string): Date {
  const d = new Date(`${key}T00:00:00Z`);
  // The round trip also refuses days a month does not have, like 30 February.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(d.getTime()) || dateKey(d) !== key) {
    throw new Error(`Not a date: ${key}`);
  }
  return d;
}

function daysBetween(from: string, to: string): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / DAY_MS);
}

/**
 * Paid while today is on or before the paid-up-to date; due for
 * GRACE_DAYS after it; overdue after that. An organisation that has never
 * paid counts from the day it was added.
 */
export function billingStatus(
  org: { paidUpTo: string | null; createdOn: string },
  today: string
): BillingStatus {
  if (org.paidUpTo && today <= org.paidUpTo) return "PAID";
  const from = org.paidUpTo ?? org.createdOn;
  return daysBetween(from, today) > GRACE_DAYS ? "OVERDUE" : "DUE";
}

/** What an organisation owes for one month at its current roster. */
export function monthlyAmount(studentCount: number, pricePerStudentInr: number): number {
  return studentCount * pricePerStudentInr;
}

/** The last day of the month holding `key`. */
export function endOfMonth(key: string): string {
  const d = fromDateKey(key);
  return dateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/**
 * The paid-up-to date a new payment most likely buys: one more month after
 * the current one, or the end of the payment's own month for a first payment.
 */
export function suggestPaidUpTo(paidUpTo: string | null, receivedOn: string): string {
  if (!paidUpTo) return endOfMonth(receivedOn);
  const d = fromDateKey(paidUpTo);
  return endOfMonth(dateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))));
}

/** "2026-09" for the month holding `key`. */
export function monthOf(key: string): string {
  return key.slice(0, 7);
}

/** The first and last day of a "YYYY-MM" month, or null if it is not one. */
export function monthRange(month: string): { first: string; last: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const first = `${month}-01`;
  return { first, last: endOfMonth(first) };
}

/** 12345 -> "₹12,345" */
export function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** "2026-09-27" -> "27 Sep 2026" */
export function formatDay(key: string): string {
  return fromDateKey(key).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "2026-09" -> "September 2026" */
export function formatMonth(month: string): string {
  return fromDateKey(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}
