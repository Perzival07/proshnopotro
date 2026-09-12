import { describe, it, expect } from "vitest";
import {
  answerFolder,
  attemptEndedAt,
  canSaveUpload,
  fitWithin,
  isInAnswerFolder,
  SAVE_GRACE_MINUTES,
  UPLOAD_WINDOW_MINUTES,
  uploadClosesAt,
  uploadState,
  type UploadableAssignment,
} from "./answer-upload";

const ended = new Date("2026-09-13T10:00:00.000Z");
const minutes = (n: number) => new Date(ended.getTime() + n * 60_000);

function attempt(overrides: Partial<UploadableAssignment> = {}): UploadableAssignment {
  return {
    status: "SUBMITTED",
    result: null,
    dueAt: "2026-09-20T00:00:00.000Z",
    startedAt: "2026-09-13T09:00:00.000Z",
    endedAt: ended,
    answersUploadedAt: null,
    test: { durationMinutes: 60 },
    ...overrides,
  };
}

describe("attemptEndedAt", () => {
  it("uses the stamped end time", () => {
    expect(attemptEndedAt(attempt())).toEqual(ended);
  });

  it("falls back to the timed deadline for attempts closed before the stamp existed", () => {
    expect(attemptEndedAt(attempt({ endedAt: null }))).toEqual(ended);
  });

  it("is unknown for an untimed attempt with no stamp", () => {
    expect(attemptEndedAt(attempt({ endedAt: null, test: { durationMinutes: null } }))).toBeNull();
  });
});

describe("uploadState", () => {
  it("is not available while the attempt is still running", () => {
    expect(uploadState(attempt({ status: "ASSIGNED", endedAt: null }), minutes(-5))).toBe(
      "NOT_ENDED"
    );
  });

  it("opens the moment the attempt ends", () => {
    expect(uploadState(attempt(), ended)).toBe("OPEN");
  });

  it("stays open to the end of the window, inclusive", () => {
    expect(uploadState(attempt(), minutes(UPLOAD_WINDOW_MINUTES))).toBe("OPEN");
  });

  it("closes after the window", () => {
    expect(uploadState(attempt(), minutes(UPLOAD_WINDOW_MINUTES + 1))).toBe("EXPIRED");
  });

  it("counts a recorded result as ended", () => {
    expect(uploadState(attempt({ status: "ASSIGNED", result: { id: "r" } }), ended)).toBe("OPEN");
  });

  it("allows only one upload", () => {
    expect(uploadState(attempt({ answersUploadedAt: minutes(2) }), minutes(3))).toBe("UPLOADED");
  });

  it("has no window when the end is unknown", () => {
    expect(
      uploadState(attempt({ endedAt: null, test: { durationMinutes: null } }), ended)
    ).toBe("EXPIRED");
  });
});

describe("uploadClosesAt", () => {
  it("is the end plus the window", () => {
    expect(uploadClosesAt(attempt())).toEqual(minutes(UPLOAD_WINDOW_MINUTES));
  });
});

describe("canSaveUpload", () => {
  it("accepts a save that lands shortly after the window, within the grace", () => {
    expect(canSaveUpload(attempt(), minutes(UPLOAD_WINDOW_MINUTES + SAVE_GRACE_MINUTES))).toBe(true);
  });

  it("refuses a save after the grace", () => {
    expect(
      canSaveUpload(attempt(), minutes(UPLOAD_WINDOW_MINUTES + SAVE_GRACE_MINUTES + 1))
    ).toBe(false);
  });

  it("refuses a second save", () => {
    expect(canSaveUpload(attempt({ answersUploadedAt: ended }), ended)).toBe(false);
  });

  it("refuses before the attempt has ended", () => {
    expect(canSaveUpload(attempt({ status: "ASSIGNED" }), ended)).toBe(false);
  });
});

describe("isInAnswerFolder", () => {
  it("accepts a file in the assignment's own folder", () => {
    expect(isInAnswerFolder(`${answerFolder("a1")}/xyz123`, "a1")).toBe(true);
  });

  it("rejects another assignment's folder", () => {
    expect(isInAnswerFolder(`${answerFolder("a2")}/xyz123`, "a1")).toBe(false);
  });

  it("rejects a folder whose id merely starts the same", () => {
    expect(isInAnswerFolder(`${answerFolder("a1")}0/xyz123`, "a1")).toBe(false);
  });

  it("rejects the bare folder and path tricks", () => {
    expect(isInAnswerFolder(`${answerFolder("a1")}/`, "a1")).toBe(false);
    expect(isInAnswerFolder(`${answerFolder("a1")}/../a2/x`, "a1")).toBe(false);
  });
});

describe("fitWithin", () => {
  it("scales a large portrait photo down to the longest edge", () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("scales a landscape photo by its width", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("keeps at least one pixel on a very thin image", () => {
    expect(fitWithin(10000, 2, 1600)).toEqual({ width: 1600, height: 1 });
  });

  it("returns zero for an unreadable size", () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});
