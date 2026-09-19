import React from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import { parseRichText } from "@/lib/rich-text";

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

/**
 * Question text with its maths and images: see lib/rich-text.ts for the
 * syntax. Line breaks the tutor typed are kept.
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const segments = parseRichText(text);

  return (
    <div className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {segments.map((segment, index) => {
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
            dangerouslySetInnerHTML={{ __html: renderMath(segment.tex, segment.display) }}
          />
        );
      })}
    </div>
  );
}
