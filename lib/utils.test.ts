import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateShort,
  toDateTimeLocalValue,
  normalizeEmail,
  cn,
} from "./utils";

// 18:29 UTC is 23:59 IST -- the exact instant the deadline bugs turned on.
const DEADLINE = new Date("2026-09-08T18:29:00.000Z");

describe("formatDate", () => {
  it("renders in IST regardless of the server's timezone", () => {
    // Regression: with no timeZone, this returned 11:59 pm locally but
    // 06:29 pm on Vercel's UTC servers -- students saw the wrong deadline.
    expect(formatDate(DEADLINE)).toBe("08 Sept 2026, 11:59 pm");
  });

  it("accepts an ISO string", () => {
    expect(formatDate(DEADLINE.toISOString())).toBe("08 Sept 2026, 11:59 pm");
  });

  it("crosses the date boundary correctly", () => {
    // 19:00 UTC = 00:30 IST the following day
    expect(formatDate(new Date("2026-09-08T19:00:00.000Z"))).toBe(
      "09 Sept 2026, 12:30 am"
    );
  });

  it("does not throw on an invalid date", () => {
    expect(formatDate("not a date")).toBe("—");
  });
});

describe("formatDateShort", () => {
  it("renders in IST", () => {
    expect(formatDateShort(DEADLINE)).toBe("08 Sept");
  });

  it("crosses the date boundary correctly", () => {
    expect(formatDateShort(new Date("2026-09-08T19:00:00.000Z"))).toBe("09 Sept");
  });

  it("does not throw on an invalid date", () => {
    expect(formatDateShort("nonsense")).toBe("—");
  });
});

describe("toDateTimeLocalValue", () => {
  it("emits local wall-clock time, not UTC", () => {
    // Regression: toISOString() shifted 23:59 local to 18:29, so every
    // default deadline was created 5.5 hours early in IST.
    const d = new Date(2026, 8, 8, 23, 59, 0, 0); // local 8 Sep 2026, 23:59
    expect(toDateTimeLocalValue(d)).toBe("2026-09-08T23:59");
  });

  it("zero-pads single-digit months, days, hours and minutes", () => {
    const d = new Date(2026, 0, 5, 9, 7, 0, 0);
    expect(toDateTimeLocalValue(d)).toBe("2026-01-05T09:07");
  });

  it("round-trips back through the Date the form would submit", () => {
    const d = new Date(2026, 8, 8, 23, 59, 0, 0);
    const parsed = new Date(toDateTimeLocalValue(d));
    expect(parsed.getHours()).toBe(23);
    expect(parsed.getMinutes()).toBe(59);
    expect(parsed.getDate()).toBe(8);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Rahul@Example.COM ")).toBe("rahul@example.com");
  });
});

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("drops falsy values", () => {
    expect(cn("p-2", false && "hidden", undefined, "m-1")).toBe("p-2 m-1");
  });
});
