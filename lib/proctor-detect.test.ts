import { describe, it, expect } from "vitest";
import {
  createTracker,
  DEFAULT_TRACKER_CONFIG,
  DETECTION_COLUMN,
  DETECTION_KINDS,
  hasPhone,
  coverRect,
  isDetectionKind,
  toFaceBoxes,
  registerFlag,
  type FrameObservation,
} from "./proctor-detect";

const OK: FrameObservation = { faces: 1, phone: false };
const NO_FACE: FrameObservation = { faces: 0, phone: false };
const TWO: FrameObservation = { faces: 2, phone: false };
const PHONE: FrameObservation = { faces: 1, phone: true };

const { graceMs } = DEFAULT_TRACKER_CONFIG;

/** Feeds `frame` every 500ms from `from` for `ms`, returning everything fired. */
function feed(
  tracker: ReturnType<typeof createTracker>,
  frame: FrameObservation,
  from: number,
  ms: number
) {
  const fired: string[] = [];
  for (let t = from; t <= from + ms; t += 500) fired.push(...tracker.observe(frame, t));
  return fired;
}

const MIN = 60_000;

describe("createTracker", () => {
  it("ignores everything during the grace period", () => {
    const tracker = createTracker();
    expect(feed(tracker, PHONE, 0, graceMs - 500)).toEqual([]);
  });

  it("does not flag a face missing for less than 5 minutes", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    expect(feed(tracker, NO_FACE, graceMs + 500, 5 * MIN - 1000)).toEqual([]);
  });

  it("flags NO_FACE after 5 minutes, and only once per episode", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    expect(feed(tracker, NO_FACE, graceMs + 500, 8 * MIN)).toEqual(["NO_FACE"]);
  });

  it("flags MULTIPLE_FACES after 3 minutes, not before", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    expect(feed(tracker, TWO, graceMs + 500, 3 * MIN - 1000)).toEqual([]);
    expect(feed(tracker, TWO, graceMs + 3 * MIN - 500, 2000)).toEqual(["MULTIPLE_FACES"]);
  });

  it("flags a phone after a few seconds, not on one frame", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    expect(feed(tracker, PHONE, graceMs + 500, 1500)).toEqual([]);
    const later = createTracker();
    feed(later, OK, 0, graceMs);
    expect(feed(later, PHONE, graceMs + 500, 3500)).toEqual(["PHONE"]);
  });

  it("does not let a one-frame blink restart a long episode", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    let t = graceMs + 500;
    feed(tracker, TWO, t, 2 * MIN);
    t += 2 * MIN + 500;
    tracker.observe(OK, t); // the model misses the second face for a moment
    t += 500;
    expect(feed(tracker, TWO, t, 70_000)).toEqual(["MULTIPLE_FACES"]);
  });

  it("does start over once the condition has really ended", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    let t = graceMs + 500;
    feed(tracker, TWO, t, 2 * MIN);
    t += 2 * MIN + 500;
    feed(tracker, OK, t, 10_000); // well past the release delay
    t += 10_500;
    expect(feed(tracker, TWO, t, 2 * MIN)).toEqual([]);
  });

  it("re-arms after an episode ends, so a second phone sighting flags again", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    let t = graceMs + 500;
    expect(feed(tracker, PHONE, t, 4000)).toEqual(["PHONE"]);
    t += 4500;
    feed(tracker, OK, t, 5000);
    t += 5500;
    expect(feed(tracker, PHONE, t, 4000)).toEqual(["PHONE"]);
  });

  it("does not credit time across a long gap between frames", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    feed(tracker, TWO, graceMs + 500, 2 * MIN);
    // The tab was hidden for ten minutes; the next frame is not "3 minutes of two faces".
    expect(tracker.observe(TWO, graceMs + 12 * MIN)).toEqual([]);
  });

  it("starts fresh after reset()", () => {
    const tracker = createTracker();
    feed(tracker, OK, 0, graceMs);
    feed(tracker, PHONE, graceMs + 500, 10_000);
    tracker.reset();
    // Grace applies again from the first frame after the reset.
    expect(feed(tracker, PHONE, 100_000_000, graceMs - 500)).toEqual([]);
  });
});

describe("registerFlag", () => {
  it("warns on the first flag of a kind", () => {
    const outcome = registerFlag("PHONE", 0);
    expect(outcome).toMatchObject({ count: 1, shouldSubmit: false });
    expect(outcome.message).toMatch(/warning/i);
  });

  it("ends the attempt on the second, and says why", () => {
    const outcome = registerFlag("NO_FACE", 1);
    expect(outcome).toMatchObject({ count: 2, shouldSubmit: true });
    expect(outcome.message).toMatch(/submitted automatically/);
  });

  it("keeps ending it past the limit and treats a negative tally as zero", () => {
    expect(registerFlag("MULTIPLE_FACES", 5).shouldSubmit).toBe(true);
    expect(registerFlag("MULTIPLE_FACES", -3).count).toBe(1);
  });
});

describe("hasPhone", () => {
  const det = (categoryName: string, score: number) => [{ categories: [{ categoryName, score }] }];

  it("accepts a confident cell phone", () => {
    expect(hasPhone(det("cell phone", 0.8))).toBe(true);
  });

  it("rejects a low-confidence phone and other objects", () => {
    expect(hasPhone(det("cell phone", 0.3))).toBe(false);
    expect(hasPhone(det("laptop", 0.95))).toBe(false);
    expect(hasPhone([])).toBe(false);
  });
});

describe("detection kinds", () => {
  it("validates kinds coming from the client", () => {
    expect(isDetectionKind("PHONE")).toBe(true);
    expect(isDetectionKind("phone")).toBe(false);
    expect(isDetectionKind(undefined)).toBe(false);
  });

  it("has a distinct column for every kind", () => {
    const columns = DETECTION_KINDS.map((k) => DETECTION_COLUMN[k]);
    expect(new Set(columns).size).toBe(DETECTION_KINDS.length);
  });
});

describe("toFaceBoxes", () => {
  it("normalises pixel boxes and skips detections without one", () => {
    const boxes = toFaceBoxes(
      [{ boundingBox: { originX: 160, originY: 120, width: 320, height: 240 } }, {}],
      640,
      480
    );
    expect(boxes).toEqual([{ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }]);
  });

  it("returns nothing for a frame with no size yet", () => {
    expect(toFaceBoxes([{ boundingBox: { originX: 1, originY: 1, width: 1, height: 1 } }], 0, 0)).toEqual([]);
  });
});

describe("coverRect", () => {
  const box = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

  it("is the identity when the frame and container are the same shape", () => {
    expect(coverRect(box, 4 / 3, 4 / 3)).toEqual({ left: 25, top: 25, width: 50, height: 50 });
  });

  it("accounts for the sides a wider frame loses", () => {
    // 16:9 into 4:3 shows the middle 75% of the width.
    const r = coverRect({ x: 0.125, y: 0, w: 0.75, h: 1 }, 16 / 9, 4 / 3);
    expect(r.left).toBeCloseTo(0);
    expect(r.width).toBeCloseTo(100);
    expect(r.top).toBe(0);
    expect(r.height).toBe(100);
  });

  it("accounts for the top and bottom a taller frame loses", () => {
    const r = coverRect({ x: 0, y: 0.125, w: 1, h: 0.75 }, 1, 4 / 3);
    expect(r.top).toBeCloseTo(0);
    expect(r.height).toBeCloseTo(100);
  });
});
