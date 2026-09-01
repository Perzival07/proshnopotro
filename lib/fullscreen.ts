/**
 * Fullscreen for the question-paper preview.
 *
 * The native Fullscreen API is the nicer option -- it hides the browser's own
 * chrome -- but it is not universally available: iOS Safari refuses to
 * fullscreen arbitrary elements, and the call rejects unless it comes from a
 * user gesture. So callers always apply a CSS overlay as well, and treat
 * native fullscreen as a bonus on top. These helpers never throw.
 */

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export function supportsNativeFullscreen(el: FullscreenElement | null): boolean {
  if (!el) return false;
  return typeof el.requestFullscreen === "function" ||
    typeof el.webkitRequestFullscreen === "function";
}

/** Returns true when native fullscreen was actually entered. */
export async function enterFullscreen(
  el: FullscreenElement | null
): Promise<boolean> {
  if (!el) return false;
  try {
    if (typeof el.requestFullscreen === "function") {
      await el.requestFullscreen();
      return true;
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // Rejected (no user gesture, or disallowed) -- the overlay still applies.
  }
  return false;
}

export async function exitFullscreen(doc: FullscreenDocument): Promise<void> {
  try {
    if (!isNativeFullscreen(doc)) return;
    if (typeof doc.exitFullscreen === "function") {
      await doc.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === "function") {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Nothing actionable; the overlay is removed by the caller regardless.
  }
}

export function isNativeFullscreen(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}
