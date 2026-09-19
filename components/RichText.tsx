import React from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import { parseRichText, type InlineSegment } from "@/lib/rich-text";

function renderMath(tex: string, display: boolean): string {
  // trust: false keeps \href, \includegraphics and friends switched off, and
  // throwOnError: false shows a mistyped formula in red instead of crashing
  // the whole paper.
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    output: "htmlAndMathml",
  });
}

function renderInline(segments: InlineSegment[], tall = false) {
  return segments.map((segment, index) => {
    if (segment.kind === "text") return <React.Fragment key={index}>{segment.text}</React.Fragment>;

    if (segment.kind === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={segment.url}
          alt={segment.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="my-2 block max-h-80 max-w-full rounded-md border border-brand-border bg-white object-contain"
        />
      );
    }

    return (
      <span
        key={index}
        className={segment.display ? "my-2 block overflow-x-auto overflow-y-hidden" : undefined}
        // KaTeX escapes everything it is given; this is its own output.
        dangerouslySetInnerHTML={{
          __html: renderMath(!segment.display && tall ? `\\displaystyle ${segment.tex}` : segment.tex, segment.display),
        }}
      />
    );
  });
}

/**
 * Question text with its maths, images and tables: see lib/rich-text.ts for
 * the syntax. Line breaks the tutor typed are kept.
 *
 * `tall` draws inline maths at full size -- for options, where an answer that
 * is just a fraction should not be squeezed to the height of a line of text.
 */
export function RichText({ text, className = "", tall = false }: { text: string; className?: string; tall?: boolean }) {
  const segments = parseRichText(text);
  const inline: InlineSegment[] = [];
  const out: React.ReactNode[] = [];

  const flush = () => {
    if (inline.length) out.push(<React.Fragment key={out.length}>{renderInline(inline.splice(0), tall)}</React.Fragment>);
  };

  for (const segment of segments) {
    if (segment.kind !== "table") {
      inline.push(segment);
      continue;
    }
    flush();
    out.push(
      <div key={out.length} className="my-2 overflow-x-auto">
        <table className="border-collapse text-sm">
          <tbody>
            {segment.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="whitespace-pre-wrap border border-brand-border px-2 py-1 align-top">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  flush();

  return <div className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>{out}</div>;
}
