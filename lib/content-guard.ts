/**
 * Copy and screenshot deterrence for a proctored paper.
 *
 * A web page cannot truly stop a screenshot: the operating system takes it
 * without asking the browser, and on phones the page is not even told. What it
 * can do is refuse copying, saving and printing outright, and blank the paper
 * for the moments a capture is being made -- the key that takes one, or the
 * modifier chords of the OS screenshot tools. Those checks live here, as pure
 * functions of the key event, so they can be tested without a browser.
 */

/** The parts of a KeyboardEvent these checks read. */
export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** How long the paper stays covered after a capture attempt, in ms. */
export const CAPTURE_COVER_MS = 2500;

/**
 * Whether this key press is (or is the start of) a screenshot: PrintScreen
 * on Windows and Linux, Cmd+Shift on macOS (Cmd+Shift+3/4/5) and Win+Shift
 * (Win+Shift+S, the Snipping Tool). Shift alongside Meta is matched on its own
 * rather than waiting for the digit or letter, because the OS usually consumes
 * that last key before the page sees it.
 */
export function isCaptureKey(e: KeyLike): boolean {
  if (e.key === "PrintScreen" || e.code === "PrintScreen") return true;
  return e.metaKey && e.shiftKey;
}

/** Ctrl/Cmd+P (print) and Ctrl/Cmd+S (save the page): never wanted mid-exam. */
export function isPrintOrSaveShortcut(e: KeyLike): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return false;
  const k = e.key.toLowerCase();
  return k === "p" || k === "s";
}

/** Whether an event's target is somewhere the student types their answer. */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
}
