/**
 * The face scan before a proctored paper opens.
 *
 * The attempt's clock starts the moment the paper is resolved, so the scan has
 * to pass first: a student sits in front of the camera, and only once exactly
 * one clear face has been steady in view for a moment does the paper open.
 *
 * Like the in-exam check (`lib/proctor-detect.ts`) this runs on the student's
 * device and keeps nothing -- the model's per-frame face count goes in, a
 * verdict comes out, and no picture is stored or sent.
 *
 * "Steady" is the point. One lucky frame proves nothing (a face model flickers,
 * and a photo held up would pass a single look), so the face must persist, and
 * anything that breaks it -- the face leaving, a second one arriving, the page
 * being throttled -- starts the count again.
 */

export type ScanState =
  /** Waiting for a first frame. */
  | "starting"
  /** No face in view. */
  | "no-face"
  /** More than one face in view. */
  | "multiple"
  /** One face, but too small in the frame to be a person at the screen. */
  | "too-far"
  /** One clear face; the hold is running. */
  | "holding"
  /** The hold completed. */
  | "passed";

export interface ScanConfig {
  /** How long one clear face must stay in view, unbroken. */
  holdMs: number;
  /** Smallest face width, as a fraction of the frame width. */
  minFaceWidth: number;
  /**
   * A gap between frames longer than this means the page was throttled or the
   * camera stalled, so the hold restarts rather than being credited with time
   * nobody was looking.
   */
  maxFrameGapMs: number;
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  holdMs: 2000,
  minFaceWidth: 0.12,
  maxFrameGapMs: 1500,
};

/** What one analysed frame contained. */
export interface ScanFrame {
  /** Width of each face found, as a fraction of the frame width. */
  faceWidths: number[];
}

export interface ScanResult {
  state: ScanState;
  /** 0-1 progress through the hold. */
  progress: number;
}

export interface ScanGate {
  observe(frame: ScanFrame, now: number): ScanResult;
  reset(): void;
}

export function createScanGate(config: ScanConfig = DEFAULT_SCAN_CONFIG): ScanGate {
  let holdSince: number | null = null;
  let lastFrameAt: number | null = null;
  let passed = false;

  return {
    reset() {
      holdSince = null;
      lastFrameAt = null;
      passed = false;
    },

    observe(frame, now) {
      // Passing is final: a student who has been verified is not un-verified
      // by the frame that arrives while the pop-up is closing.
      if (passed) return { state: "passed", progress: 1 };

      if (lastFrameAt !== null && now - lastFrameAt > config.maxFrameGapMs) {
        holdSince = null;
      }
      lastFrameAt = now;

      const count = frame.faceWidths.length;
      if (count === 0) {
        holdSince = null;
        return { state: "no-face", progress: 0 };
      }
      if (count > 1) {
        holdSince = null;
        return { state: "multiple", progress: 0 };
      }
      if (frame.faceWidths[0] < config.minFaceWidth) {
        holdSince = null;
        return { state: "too-far", progress: 0 };
      }

      if (holdSince === null) holdSince = now;
      const held = now - holdSince;
      if (held >= config.holdMs) {
        passed = true;
        return { state: "passed", progress: 1 };
      }
      return { state: "holding", progress: held / config.holdMs };
    },
  };
}

/** What the student is told, in the words that say what to do about it. */
export function scanMessage(state: ScanState): string {
  switch (state) {
    case "starting":
      return "Getting your camera ready…";
    case "no-face":
      return "We can’t see your face. Sit in front of the camera with your face in the frame and good light on it.";
    case "multiple":
      return "More than one person is in view. Only you should be in front of the camera.";
    case "too-far":
      return "Move a little closer so your face fills more of the frame.";
    case "holding":
      return "Hold still…";
    case "passed":
      return "Face verified.";
  }
}
