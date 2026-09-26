import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The timezone every date in this app is rendered in.
 *
 * Without an explicit zone, Intl uses the runtime's -- IST on a local machine
 * but UTC on Vercel -- so a 23:59 IST deadline rendered as 18:29 in production.
 * Client components made it worse: they format once during SSR (server zone)
 * and again after hydration (browser zone), causing a mismatch. Pinning the
 * zone makes every surface agree, everywhere.
 */
export const DISPLAY_TIME_ZONE = "Asia/Kolkata";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    // hourCycle h12, not hour12:true -- en-GB resolves hour12 to the h11 cycle,
    // which renders a 00:30 deadline as "00:30 am" instead of "12:30 am".
    hourCycle: "h12",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(d);
}

/**
 * Formats a Date as the LOCAL wall-clock string a datetime-local input expects.
 *
 * toISOString() must not be used here: it converts to UTC, so 23:59 IST was
 * handed to the picker as 18:29 and every default deadline landed 5.5 hours
 * early.
 */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
