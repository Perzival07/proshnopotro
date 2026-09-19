/**
 * Splits question text into plain text, maths and images, for rendering.
 *
 * Question text is plain text, with:
 *   $...$  or \(...\)   inline maths (LaTeX, rendered by KaTeX)
 *   $$...$$ or \[...\]  displayed maths on its own line
 *   \ce{...}            chemistry, inside maths: $\ce{H2O}$
 *   ![caption](https://...)  an image
 *   \$                  a literal dollar sign
 *
 * Nothing here produces HTML, so no text a tutor types can inject markup; the
 * component that renders the segments escapes text and hands maths to KaTeX.
 */

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "math"; tex: string; display: boolean }
  | { kind: "image"; url: string; alt: string };

const IMAGE_RE = /^!\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/;

const DELIMITERS: { open: string; close: string; display: boolean }[] = [
  { open: "$$", close: "$$", display: true },
  { open: "\\[", close: "\\]", display: true },
  { open: "\\(", close: "\\)", display: false },
  { open: "$", close: "$", display: false },
];

/** Finds `close` from `from`, skipping an escaped `\$` for dollar delimiters. */
function findClose(text: string, close: string, from: number): number {
  let at = text.indexOf(close, from);
  while (at !== -1 && close.startsWith("$") && text[at - 1] === "\\") {
    at = text.indexOf(close, at + 1);
  }
  return at;
}

export function parseRichText(input: string): Segment[] {
  const segments: Segment[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) segments.push({ kind: "text", text: buffer });
    buffer = "";
  };

  outer: while (i < input.length) {
    if (input.startsWith("\\$", i)) {
      buffer += "$";
      i += 2;
      continue;
    }

    if (input[i] === "!") {
      const image = input.slice(i).match(IMAGE_RE);
      if (image) {
        flush();
        segments.push({ kind: "image", alt: image[1], url: image[2] });
        i += image[0].length;
        continue;
      }
    }

    for (const d of DELIMITERS) {
      if (!input.startsWith(d.open, i)) continue;
      const start = i + d.open.length;
      const end = findClose(input, d.close, start);
      // An unmatched "$" is just a dollar sign ("costs $5"), not maths.
      if (end === -1 || end === start) break;
      // Inline $...$ never spans a blank line: a stray "$" should not swallow
      // the rest of the question.
      const tex = input.slice(start, end);
      if (!d.display && /\n\s*\n/.test(tex)) break;
      flush();
      segments.push({ kind: "math", tex: tex.trim(), display: d.display });
      i = end + d.close.length;
      continue outer;
    }

    buffer += input[i];
    i++;
  }

  flush();
  return segments;
}
