/**
 * The faint tiled name laid over an exam paper.
 *
 * It cannot stop a screenshot or a photo of the screen, but it makes a leaked
 * one traceable to the student who took it, which is what actually deters
 * sharing. Built as an SVG data URL so it needs no image file and no layout:
 * one rotated line of text, repeated by the browser as a background.
 */

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** The line stamped on the paper: who is sitting it. */
export function watermarkText(name: string | null | undefined, email: string | null | undefined): string {
  return [name?.trim(), email?.trim().toLowerCase()].filter(Boolean).join(" · ");
}

/** A CSS `background-image` value tiling `text` diagonally. */
export function watermarkBackground(text: string): string {
  const safe = text.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='440' height='240'>` +
    `<text x='220' y='120' text-anchor='middle' transform='rotate(-24 220 120)' ` +
    `font-family='sans-serif' font-size='15' font-weight='600' fill='rgba(15,23,42,0.11)'>${safe}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
