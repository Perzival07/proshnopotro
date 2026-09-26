/**
 * MediaPipe's WebAssembly runtime reports its own start-up through
 * `console.error`, whatever the severity. On the first `detectForVideo` it logs
 * "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.", which is good
 * news, but Next's dev overlay shows any `console.error` as a red error
 * pointing at the detect call.
 *
 * Only messages the runtime tags "INFO:" are dropped; every real error still
 * goes through untouched.
 */

type ConsoleLike = { error: (...args: unknown[]) => void };

const PATCHED = Symbol.for("proshnopotro.mediapipeLogFilter");

/** Whether a console.error call is the runtime's own informational line. */
export function isMediapipeInfo(args: unknown[]): boolean {
  return typeof args[0] === "string" && args[0].startsWith("INFO:");
}

/** Installs the filter once; calling it again is a no-op. */
export function silenceMediapipeInfo(target: ConsoleLike = console): void {
  const marked = target as ConsoleLike & { [PATCHED]?: boolean };
  if (marked[PATCHED]) return;
  marked[PATCHED] = true;

  const original = target.error.bind(target);
  target.error = (...args: unknown[]) => {
    if (isMediapipeInfo(args)) return;
    original(...args);
  };
}
