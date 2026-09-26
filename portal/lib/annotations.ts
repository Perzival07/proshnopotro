/**
 * The tutor's marks on an answer-sheet photo: pen strokes, ticks, crosses and
 * short notes, in the photo's own pixels.
 *
 * They are stored beside the photo and drawn over it (an SVG layer), never
 * burned into it, so the student's original page is kept and a stray stroke
 * can always be taken off again.
 */

export const ANNOTATION_COLORS = ["red", "green", "blue"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export const COLOR_HEX: Record<AnnotationColor, string> = {
  red: "#dc2626",
  green: "#16a34a",
  blue: "#2563eb",
};

export type Annotation =
  | { kind: "pen"; color: AnnotationColor; width: number; points: [number, number][] }
  | { kind: "tick"; color: AnnotationColor; x: number; y: number; size: number }
  | { kind: "cross"; color: AnnotationColor; x: number; y: number; size: number }
  | { kind: "text"; color: AnnotationColor; x: number; y: number; size: number; text: string };

export const MAX_ANNOTATIONS = 400;
export const MAX_PEN_POINTS = 1500;
export const MAX_NOTE_LENGTH = 300;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Checks what the browser sent before it is stored: a known shape, a known
 * colour, sizes in range, points on the page. Anything else is dropped rather
 * than saved; null only when it is not a list at all or far too long.
 */
export function sanitizeAnnotations(
  raw: unknown,
  page: { width: number; height: number }
): Annotation[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ANNOTATIONS) return null;
  const clampX = (x: number) => Math.min(Math.max(x, 0), page.width);
  const clampY = (y: number) => Math.min(Math.max(y, 0), page.height);
  const round = (v: number) => Math.round(v * 10) / 10;
  const color = (c: unknown): AnnotationColor | null =>
    (ANNOTATION_COLORS as readonly string[]).includes(c as string) ? (c as AnnotationColor) : null;
  const longest = Math.max(page.width, page.height);

  const out: Annotation[] = [];
  for (const item of raw) {
    const a = item as Record<string, unknown>;
    const c = color(a?.color);
    if (!c) continue;
    if (a.kind === "pen") {
      if (!Array.isArray(a.points) || a.points.length < 2 || a.points.length > MAX_PEN_POINTS) continue;
      const points = (a.points as unknown[])
        .filter((p): p is [number, number] => Array.isArray(p) && num(p[0]) && num(p[1]))
        .map(([x, y]) => [round(clampX(x)), round(clampY(y))] as [number, number]);
      if (points.length < 2 || !num(a.width)) continue;
      out.push({ kind: "pen", color: c, width: Math.min(Math.max(a.width, 1), longest / 20), points });
    } else if (a.kind === "tick" || a.kind === "cross") {
      if (!num(a.x) || !num(a.y) || !num(a.size)) continue;
      out.push({
        kind: a.kind === "tick" ? "tick" : "cross",
        color: c,
        x: round(clampX(a.x)),
        y: round(clampY(a.y)),
        size: Math.min(Math.max(a.size, 8), longest / 4),
      });
    } else if (a.kind === "text") {
      if (!num(a.x) || !num(a.y) || !num(a.size) || typeof a.text !== "string") continue;
      const text = a.text.trim().slice(0, MAX_NOTE_LENGTH);
      if (!text) continue;
      out.push({ kind: "text", color: c, x: round(clampX(a.x)), y: round(clampY(a.y)), size: Math.min(Math.max(a.size, 8), longest / 10), text });
    }
  }
  return out;
}

/** An SVG path through a pen stroke's points. */
export function strokePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

/** Whether a point is on (near) an annotation, for the eraser. */
export function hitTest(a: Annotation, x: number, y: number, tolerance: number): boolean {
  if (a.kind === "tick" || a.kind === "cross") return Math.hypot(a.x - x, a.y - y) <= a.size / 2 + tolerance;
  if (a.kind === "text") {
    const width = a.text.length * a.size * 0.55;
    return x >= a.x - tolerance && x <= a.x + width + tolerance && y >= a.y - a.size - tolerance && y <= a.y + tolerance;
  }
  if (a.kind === "pen") return a.points.some(([px, py]) => Math.hypot(px - x, py - y) <= a.width + tolerance);
  return false;
}
