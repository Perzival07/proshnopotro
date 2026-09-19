/**
 * Splits question text into plain text, maths and images, for rendering.
 *
 * Question text is plain text, with:
 *   $...$  or \(...\)   inline maths (LaTeX, rendered by KaTeX)
 *   $$...$$ or \[...\]  displayed maths on its own line
 *   \ce{...}            chemistry, inside maths: $\ce{H2O}$
 *   ![caption](https://...)  an image
 *   \$                  a literal dollar sign
 *   | a | b |            a table row; consecutive rows form a table, and a
 *                       |---|---| row under the first is ignored
 *
 * Nothing here produces HTML, so no text a tutor types can inject markup; the
 * component that renders the segments escapes text and hands maths to KaTeX.
 */

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: "math"; tex: string; display: boolean }
  | { kind: "image"; url: string; alt: string };

export type Segment = InlineSegment | { kind: "table"; rows: InlineSegment[][][] };

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

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_RULE_RE = /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/;

/** Splits "| a | b |" into its cells, keeping "\|" inside a cell. */
function tableCells(row: string): string[] {
  // A loop rather than a lookbehind regex: Safari before iOS 16.4 cannot even
  // parse one, and the whole paper would fail to load.
  const inner = row.trim().slice(1, -1);
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && inner[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (inner[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += inner[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseRichText(input: string): Segment[] {
  const lines = input.split("\n");
  const segments: Segment[] = [];
  let text: string[] = [];

  const flushText = () => {
    if (text.length) segments.push(...parseInline(text.join("\n")));
    text = [];
  };

  for (let i = 0; i < lines.length; ) {
    if (!TABLE_ROW_RE.test(lines[i])) {
      text.push(lines[i]);
      i++;
      continue;
    }
    const rows: string[] = [];
    while (i < lines.length && TABLE_ROW_RE.test(lines[i])) rows.push(lines[i++]);
    // A lone "| x |" line is text, not a table.
    const body = rows.filter((r) => !TABLE_RULE_RE.test(r));
    if (body.length < 2 && rows.length < 2) {
      text.push(...rows);
      continue;
    }
    // The line break before the table belongs to the table now.
    if (text.length && text[text.length - 1] === "") text.pop();
    flushText();
    segments.push({ kind: "table", rows: body.map((r) => tableCells(r).map((c) => parseInline(c))) });
  }
  flushText();
  return segments;
}

function parseInline(input: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
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
