/**
 * What the exam camera looks for.
 *
 * Detection runs in the student's browser on the same stream the self-view
 * uses (see `components/student/ProctorDetection.tsx`). No frame is stored or
 * sent: the model turns each one into three facts -- how many faces, whether
 * a phone is in shot -- and this module decides whether those facts have held
 * for long enough to count. Only that verdict, a bare count, reaches the server.
 *
 * The sustain times are the whole design. A single frame is unreliable: a
 * student looks down at their working, blinks, or the model misses a face for
 * a moment. Reporting on every frame would bury a tutor in noise and punish
 * ordinary behaviour, so a condition must persist before it counts.
 */

export const DETECTION_KINDS = ["NO_FACE", "MULTIPLE_FACES", "PHONE"] as const;
export type DetectionKind = (typeof DETECTION_KINDS)[number];

export function isDetectionKind(value: unknown): value is DetectionKind {
  return typeof value === "string" && (DETECTION_KINDS as readonly string[]).includes(value);
}

/** What one analysed frame contained. */
export interface FrameObservation {
  /** Faces found. */
  faces: number;
  /** Whether a mobile phone was found. */
  phone: boolean;
}

export interface TrackerConfig {
  /** How long each condition must hold, continuously, before it counts. */
  sustainMs: Record<DetectionKind, number>;
  /**
   * A condition only counts as over once it has been absent this long. Without
   * it, a face model that blinks for one frame in a three-minute stretch of
   * "two people in view" would restart the clock and the flag would never fire.
   */
  releaseMs: number;
  /** Frames are ignored this long after tracking starts. */
  graceMs: number;
  /**
   * A gap between frames longer than this means the page was throttled or
   * hidden, so the running clocks are dropped rather than being credited with
   * time nobody was watching.
   */
  maxFrameGapMs: number;
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  sustainMs: {
    // Long: students look down at paper all the time, and someone walking
    // through the room is not a second person helping.
    NO_FACE: 5 * 60_000,
    MULTIPLE_FACES: 3 * 60_000,
    // Short: a phone in shot is rarely innocent, but the model is jumpy, so
    // it still has to appear across several samples. Two strikes end the
    // attempt, so a single misfire must not count.
    PHONE: 2500,
  },
  releaseMs: 3000,
  graceMs: 5000,
  maxFrameGapMs: 3000,
};

export interface DetectionTracker {
  /** Feeds one frame; returns the kinds that have just crossed their threshold. */
  observe(frame: FrameObservation, now: number): DetectionKind[];
  /** Forgets everything, for a camera that was switched off and back on. */
  reset(): void;
}

function conditionsOf(frame: FrameObservation): Record<DetectionKind, boolean> {
  return {
    NO_FACE: frame.faces === 0,
    MULTIPLE_FACES: frame.faces >= 2,
    PHONE: frame.phone,
  };
}

export function createTracker(
  config: TrackerConfig = DEFAULT_TRACKER_CONFIG
): DetectionTracker {
  let startedAt: number | null = null;
  let lastFrameAt: number | null = null;
  // When each condition began holding, or null while it is not.
  const since: Record<DetectionKind, number | null> = {
    NO_FACE: null,
    MULTIPLE_FACES: null,
    PHONE: null,
  };
  // When each condition was last absent-since, for the release delay.
  const absentSince: Record<DetectionKind, number | null> = {
    NO_FACE: null,
    MULTIPLE_FACES: null,
    PHONE: null,
  };
  // Each condition fires once per episode: it must end before it can fire again.
  const fired: Record<DetectionKind, boolean> = {
    NO_FACE: false,
    MULTIPLE_FACES: false,
    PHONE: false,
  };

  function clear() {
    for (const kind of DETECTION_KINDS) {
      since[kind] = null;
      absentSince[kind] = null;
      fired[kind] = false;
    }
  }

  return {
    reset() {
      startedAt = null;
      lastFrameAt = null;
      clear();
    },

    observe(frame, now) {
      if (startedAt === null) startedAt = now;
      if (now - startedAt < config.graceMs) {
        lastFrameAt = now;
        return [];
      }

      if (lastFrameAt !== null && now - lastFrameAt > config.maxFrameGapMs) clear();
      lastFrameAt = now;

      const active = conditionsOf(frame);
      const newlyFired: DetectionKind[] = [];

      for (const kind of DETECTION_KINDS) {
        if (!active[kind]) {
          if (since[kind] === null) continue;
          if (absentSince[kind] === null) absentSince[kind] = now;
          if (now - (absentSince[kind] as number) >= config.releaseMs) {
            since[kind] = null;
            absentSince[kind] = null;
            fired[kind] = false;
          }
          continue;
        }
        absentSince[kind] = null;
        if (since[kind] === null) since[kind] = now;
        if (fired[kind]) continue;
        if (now - (since[kind] as number) < config.sustainMs[kind]) continue;

        fired[kind] = true;
        newlyFired.push(kind);
      }

      return newlyFired;
    },
  };
}

/**
 * Flags of one kind allowed before the attempt is submitted. The first is a
 * warning; the second ends the attempt -- the same bargain as the tab guard.
 */
export const MAX_FLAGS_PER_KIND = 2;

export interface FlagOutcome {
  /** This kind's tally after this flag. */
  count: number;
  /** Whether this flag ends the attempt. */
  shouldSubmit: boolean;
  /** What the student is told. */
  message: string;
}

/** Applies one flag to a running tally for its kind. */
export function registerFlag(kind: DetectionKind, previousCount: number): FlagOutcome {
  const count = Math.max(0, previousCount) + 1;
  const shouldSubmit = count >= MAX_FLAGS_PER_KIND;
  return { count, shouldSubmit, message: detectionMessage(kind, shouldSubmit) };
}

/** What the student is shown for a flag: a warning, or the reason it ended. */
export function detectionMessage(kind: DetectionKind, final = false): string {
  const seen = {
    NO_FACE: "We have not been able to see your face for over 5 minutes.",
    MULTIPLE_FACES: "More than one person has been in view of the camera for over 3 minutes.",
    PHONE: "A phone was seen in the camera.",
  }[kind];
  return final
    ? `${seen} This happened before, so your test has been submitted automatically.`
    : `${seen} This is your warning \u2014 if it happens again, your test will be submitted automatically.`;
}

/** Short label for the tutor's roster. */
export function detectionLabel(kind: DetectionKind): string {
  switch (kind) {
    case "NO_FACE":
      return "Face not visible";
    case "MULTIPLE_FACES":
      return "Multiple faces";
    case "PHONE":
      return "Phone seen";
  }
}

/**
 * The prisma column each kind is counted in. Kept here, beside the kinds, so a
 * new one cannot be added without deciding where it is tallied.
 */
export const DETECTION_COLUMN = {
  NO_FACE: "noFaceFlags",
  MULTIPLE_FACES: "multiFaceFlags",
  PHONE: "phoneFlags",
} as const satisfies Record<DetectionKind, string>;

/**
 * Picks the object detector's phone out of its results.
 *
 * The score bar is deliberately high: a false "phone" accuses a student of
 * cheating, whereas a missed one costs nothing that a tutor cannot see for
 * themselves on the roster or in the room.
 */
export const PHONE_SCORE_THRESHOLD = 0.5;
export const PHONE_CATEGORY = "cell phone";

export function hasPhone(
  detections: { categories: { categoryName: string; score: number }[] }[]
): boolean {
  return detections.some((d) =>
    d.categories.some(
      (c) => c.categoryName === PHONE_CATEGORY && c.score >= PHONE_SCORE_THRESHOLD
    )
  );
}

/** A face's box as fractions (0-1) of the analysed frame. */
export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the badge draws: the boxes, and the shape of the frame they came from. */
export interface FaceSnapshot {
  boxes: FaceBox[];
  /** Frame width / height, needed to place a box on a cropped picture. */
  frameAspect: number;
}

export const NO_FACES: FaceSnapshot = { boxes: [], frameAspect: 4 / 3 };

/** Turns the detector's pixel boxes into fractions of the frame. */
export function toFaceBoxes(
  detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[],
  frameWidth: number,
  frameHeight: number
): FaceBox[] {
  if (!(frameWidth > 0) || !(frameHeight > 0)) return [];
  const boxes: FaceBox[] = [];
  for (const d of detections) {
    const b = d.boundingBox;
    if (!b) continue;
    boxes.push({
      x: b.originX / frameWidth,
      y: b.originY / frameHeight,
      w: b.width / frameWidth,
      h: b.height / frameHeight,
    });
  }
  return boxes;
}

/**
 * Where a frame-relative box lands, in percent, on a picture shown with
 * `object-fit: cover` in a container of another shape. A 16:9 webcam in the
 * 4:3 badge is cropped at the sides, so drawing at the raw fractions would put
 * the box beside the face rather than on it.
 */
export function coverRect(
  box: FaceBox,
  frameAspect: number,
  containerAspect: number
): { left: number; top: number; width: number; height: number } {
  // Fraction of the frame that stays visible along each axis.
  const visibleW = frameAspect > containerAspect ? containerAspect / frameAspect : 1;
  const visibleH = frameAspect < containerAspect ? frameAspect / containerAspect : 1;
  const offsetX = (1 - visibleW) / 2;
  const offsetY = (1 - visibleH) / 2;
  return {
    left: ((box.x - offsetX) / visibleW) * 100,
    top: ((box.y - offsetY) / visibleH) * 100,
    width: (box.w / visibleW) * 100,
    height: (box.h / visibleH) * 100,
  };
}
