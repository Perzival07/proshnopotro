/**
 * Brightens a dark camera frame before the face model looks at it.
 *
 * The face model is trained on reasonably lit faces. In a dim room a webcam
 * gives a muddy, low-contrast picture -- the face is still there, but squeezed
 * into the bottom few dozen brightness levels -- and the model sees nothing.
 * Stretching those levels back over the full range (and lifting the shadows a
 * little) brings the face back.
 *
 * Only the copy the model sees is changed; the student's self-view is the
 * camera as it is. A frame that is already lit well enough is left alone, so a
 * normal room behaves exactly as before.
 */

export interface LowLightConfig {
  /** Frames with a mean brightness (0-255) at or above this are left alone. */
  darkBelow: number;
  /** Brightness the frame's mean is lifted to. */
  targetMean: number;
  /** Fraction of the darkest and brightest pixels ignored when stretching, so a lamp or a black shirt does not set the range. */
  clip: number;
  /** Smallest range stretched to full, so pure sensor noise is not blown up into blotches. */
  minRange: number;
  /**
   * Below this many levels between the darkest and brightest pixels the frame
   * is black (a covered lens, a dark room with nothing lit), and brightening
   * would only turn noise into shapes the model might take for a face.
   */
  minSignal: number;
}

export const DEFAULT_LOW_LIGHT: LowLightConfig = {
  darkBelow: 90,
  targetMean: 115,
  clip: 0.01,
  minRange: 24,
  minSignal: 5,
};

/** Every this-many pixels is sampled for the histogram; plenty for a 640px frame. */
const SAMPLE_STEP = 4;

/**
 * The 256-entry table that maps each channel value to its brightened value,
 * or null when the frame is bright enough to leave alone (or too black to help).
 */
export function lowLightTable(
  rgba: Uint8ClampedArray | Uint8Array,
  config: LowLightConfig = DEFAULT_LOW_LIGHT
): Uint8Array | null {
  const histogram = new Uint32Array(256);
  let total = 0;
  let sum = 0;
  for (let i = 0; i + 2 < rgba.length; i += 4 * SAMPLE_STEP) {
    // Rec. 601 luma, in integers.
    const y = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
    histogram[y]++;
    sum += y;
    total++;
  }
  if (total === 0) return null;
  const mean = sum / total;
  if (mean >= config.darkBelow) return null;

  const cut = total * config.clip;
  let lo = 0;
  for (let seen = 0; lo < 255 && seen + histogram[lo] <= cut; lo++) seen += histogram[lo];
  let hi = 255;
  for (let seen = 0; hi > 0 && seen + histogram[hi] <= cut; hi--) seen += histogram[hi];
  if (hi - lo < config.minSignal) return null;
  hi = Math.min(255, Math.max(hi, lo + config.minRange));
  const range = hi - lo;

  // After the stretch, a gamma that carries the mean to the target.
  const stretchedMean = Math.min(0.95, Math.max(0.02, (mean - lo) / range));
  const gamma = Math.min(1, Math.max(0.35, Math.log(config.targetMean / 255) / Math.log(stretchedMean)));

  const table = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - lo) / range));
    table[v] = Math.round(255 * Math.pow(t, gamma));
  }
  return table;
}

/** Brightens the frame in place when it is dark. Returns whether it changed anything. */
export function brightenIfDark(
  rgba: Uint8ClampedArray | Uint8Array,
  config: LowLightConfig = DEFAULT_LOW_LIGHT
): boolean {
  const table = lowLightTable(rgba, config);
  if (!table) return false;
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    rgba[i] = table[rgba[i]];
    rgba[i + 1] = table[rgba[i + 1]];
    rgba[i + 2] = table[rgba[i + 2]];
  }
  return true;
}
