import React from "react";
import { COLOR_HEX, strokePath, type Annotation } from "@/lib/annotations";

/**
 * The tutor's marks drawn over an answer-sheet photo, as an SVG layer in the
 * photo's own pixels. The photo underneath is never changed.
 */
export function AnnotationLayer({
  annotations,
  width,
  height,
  className = "",
  children,
}: {
  annotations: Annotation[];
  width: number;
  height: number;
  className?: string;
  /** Extra SVG content, such as a stroke still being drawn. */
  children?: React.ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      {annotations.map((a, i) => {
        const stroke = COLOR_HEX[a.color];
        if (a.kind === "pen") {
          return (
            <path
              key={i}
              d={strokePath(a.points)}
              fill="none"
              stroke={stroke}
              strokeWidth={a.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (a.kind === "tick") {
          const s = a.size / 2;
          return (
            <path
              key={i}
              d={`M${a.x - s} ${a.y} L${a.x - s / 3} ${a.y + s * 0.7} L${a.x + s} ${a.y - s * 0.8}`}
              fill="none"
              stroke={stroke}
              strokeWidth={a.size / 8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (a.kind === "cross") {
          const s = a.size / 2.4;
          return (
            <path
              key={i}
              d={`M${a.x - s} ${a.y - s} L${a.x + s} ${a.y + s} M${a.x + s} ${a.y - s} L${a.x - s} ${a.y + s}`}
              fill="none"
              stroke={stroke}
              strokeWidth={a.size / 8}
              strokeLinecap="round"
            />
          );
        }
        return (
          <text
            key={i}
            x={a.x}
            y={a.y}
            fill={stroke}
            fontSize={a.size}
            fontFamily="system-ui, sans-serif"
            fontWeight={600}
            paintOrder="stroke"
            stroke="white"
            strokeWidth={a.size / 6}
          >
            {a.text}
          </text>
        );
      })}
      {children}
    </svg>
  );
}
