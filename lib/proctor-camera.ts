/**
 * The exam camera.
 *
 * During a proctored attempt the student's camera is switched on and shown
 * back to them in the corner of the page, beside a note that their screen
 * activity is being recorded. That is the whole of it: being visibly watched
 * is what discourages a student from reaching for a phone, and it costs
 * nothing to do honestly.
 *
 * Nothing is captured. There is no MediaRecorder, no canvas snapshot, no
 * upload, and no frame ever leaves the browser -- the stream is attached to
 * <video> elements for the student's own eyes and for the on-device face and
 * phone check (`components/student/ProctorDetection.tsx`), which keeps only a
 * count of what it flagged, and is released the moment the attempt ends.
 * Anything else would mean storing pictures of children, which this portal
 * deliberately does not do.
 */

/**
 * A small self-view, front camera, no microphone.
 *
 * VGA is the floor for the face and phone check: at 320x240 a phone held at
 * arm's length is a handful of pixels and the object model never sees it. It
 * is still far below 1080p, which would flatten a phone battery over a
 * two-hour paper for no gain. `ideal` rather than `exact` so a webcam that
 * cannot do this size still opens.
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 15, max: 24 },
  },
  audio: false,
};

export type CameraStatus =
  /** Not asked for yet. */
  | "idle"
  /** The browser is asking, or the device is waking up. */
  | "starting"
  /** Live. */
  | "on"
  /** The student said no, or the device refused. */
  | "blocked"
  /** No camera, or a browser without getUserMedia (an http:// page, say). */
  | "unsupported";

/** Whether this browser can open a camera at all. */
export function isCameraSupported(
  navigatorLike: Pick<Navigator, "mediaDevices"> | undefined | null
): boolean {
  return typeof navigatorLike?.mediaDevices?.getUserMedia === "function";
}

/**
 * What to tell the student when the camera does not come on.
 *
 * Each case has a different fix, and "camera error" would leave them guessing
 * which one they are in the middle of an exam they are being timed on.
 */
export function cameraErrorMessage(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Your tutor requires the camera to be on during this test — allow it in your browser's address bar, then press Turn camera on.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. Your tutor may ask you to take this test on a device with a camera.";
    case "NotReadableError":
    case "AbortError":
      return "Your camera is already in use by another app. Close it — a video call, or the camera app — and press Turn camera on.";
    default:
      return "The camera could not be started. Press Turn camera on to try again.";
  }
}

/**
 * Whether the status counts as the camera being on the student's side of the
 * bargain, for the wording of the badge.
 */
export function isCameraLive(status: CameraStatus): boolean {
  return status === "on";
}

/**
 * Releases a camera.
 *
 * Every track has to be stopped by hand: dropping the reference alone leaves
 * the light on, which -- after a page that spent the whole exam saying the
 * camera is on -- would look exactly like the portal still watching.
 */
export function stopStream(stream: { getTracks(): { stop(): void }[] } | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // A track already ended by the browser throws; there is nothing to undo.
    }
  });
}

/** The two lines the badge shows while an attempt is being watched. */
export const PROCTOR_NOTICE = {
  camera: "Camera on",
  screen: "Screen activity recorded",
  detection: "Face & phone check on",
} as const;
