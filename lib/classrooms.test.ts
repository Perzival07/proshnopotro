import { describe, it, expect } from "vitest";
import {
  diffMembers,
  MAX_CLASSROOM_NAME,
  memberCountLabel,
  parseMemberEmails,
  validateClassroom,
} from "./classrooms";

describe("validateClassroom", () => {
  it("trims the name and keeps the optional fields as null when blank", () => {
    const res = validateClassroom({ name: "  Physics Batch A  " });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.name).toBe("Physics Batch A");
    expect(res.value.subject).toBeNull();
    expect(res.value.description).toBeNull();
    expect(res.value.iconName).toBe("GraduationCap");
    expect(res.value.active).toBe(true);
  });

  it("requires a name", () => {
    expect(validateClassroom({ name: "   " })).toMatchObject({ ok: false });
  });

  it("rejects a name too long to fit a card", () => {
    const res = validateClassroom({ name: "x".repeat(MAX_CLASSROOM_NAME + 1) });
    expect(res.ok).toBe(false);
  });

  it("keeps an explicit inactive flag", () => {
    const res = validateClassroom({ name: "Old Batch", active: false });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.active).toBe(false);
  });
});

describe("parseMemberEmails", () => {
  it("lower-cases, trims and de-duplicates, preserving first-seen order", () => {
    const res = parseMemberEmails([" Rahul@Gmail.com ", "priya@gmail.com", "RAHUL@gmail.com"]);
    expect(res.valid).toEqual(["rahul@gmail.com", "priya@gmail.com"]);
    expect(res.invalid).toEqual([]);
  });

  it("separates the typos rather than dropping them silently", () => {
    const res = parseMemberEmails(["ok@gmail.com", "not-an-email", ""]);
    expect(res.valid).toEqual(["ok@gmail.com"]);
    expect(res.invalid).toEqual(["not-an-email"]);
  });
});

describe("diffMembers", () => {
  it("adds only the new ones and removes only the dropped ones", () => {
    const { toAdd, toRemove } = diffMembers(
      ["a@x.com", "b@x.com"],
      ["b@x.com", "c@x.com"]
    );
    expect(toAdd).toEqual(["c@x.com"]);
    expect(toRemove).toEqual(["a@x.com"]);
  });

  it("treats a differently-cased address as the same member", () => {
    const { toAdd, toRemove } = diffMembers(["Rahul@Gmail.com"], ["rahul@gmail.com"]);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("removes everyone when the new list is empty", () => {
    const { toAdd, toRemove } = diffMembers(["a@x.com", "b@x.com"], []);
    expect(toAdd).toEqual([]);
    expect(toRemove.sort()).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("memberCountLabel", () => {
  it("reads naturally at zero, one and many", () => {
    expect(memberCountLabel(0)).toBe("No students yet");
    expect(memberCountLabel(1)).toBe("1 student");
    expect(memberCountLabel(12)).toBe("12 students");
  });
});
