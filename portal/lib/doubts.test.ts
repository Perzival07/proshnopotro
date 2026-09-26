import { describe, it, expect } from "vitest";
import { checkDoubtBody, MAX_DOUBT_LENGTH, statusAfterMessage, statusLabel } from "./doubts";

describe("checkDoubtBody", () => {
  it("trims and accepts a question", () => expect(checkDoubtBody("  Why is it B?\n")).toEqual({ body: "Why is it B?" }));
  it("refuses an empty or over-long one", () => {
    expect(checkDoubtBody("   ")).toHaveProperty("error");
    expect(checkDoubtBody("x".repeat(MAX_DOUBT_LENGTH + 1))).toHaveProperty("error");
    expect(checkDoubtBody("x".repeat(MAX_DOUBT_LENGTH))).toHaveProperty("body");
  });
});

describe("thread status", () => {
  it("a student's message reopens it and a tutor's answers it", () => {
    expect(statusAfterMessage(false)).toBe("OPEN");
    expect(statusAfterMessage(true)).toBe("ANSWERED");
  });
  it("words the status for who is looking", () => {
    expect(statusLabel("OPEN", "tutor")).toBe("Needs a reply");
    expect(statusLabel("OPEN", "student")).toBe("Waiting for your tutor");
    expect(statusLabel("ANSWERED", "student")).toBe("Answered");
    expect(statusLabel("RESOLVED", "tutor")).toBe("Resolved");
  });
});
