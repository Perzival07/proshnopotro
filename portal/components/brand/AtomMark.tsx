import React from "react";
import { cn } from "@/lib/utils";

interface AtomMarkProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
  strokeColor?: string;
  dotColor?: string;
  animate?: boolean;
}

export function AtomMark({
  className,
  size = 40,
  strokeColor = "#0A4B8C",
  dotColor = "#2E9CD8",
  animate = false,
  ...props
}: AtomMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animate && "animate-spin", className)}
      {...props}
    >
      {/* Central nucleus */}
      <circle cx="50" cy="50" r="8" fill={dotColor} />

      {/* Orbit 1: Vertical ellipse */}
      <ellipse
        cx="50"
        cy="50"
        rx="15"
        ry="36"
        stroke={strokeColor}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Orbit 2: Tilted 60 deg */}
      <g transform="rotate(60 50 50)">
        <ellipse
          cx="50"
          cy="50"
          rx="15"
          ry="36"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Electron dot on orbit 2 */}
        <circle cx="50" cy="14" r="5" fill={dotColor} />
      </g>

      {/* Orbit 3: Tilted -60 deg (120 deg) */}
      <g transform="rotate(-60 50 50)">
        <ellipse
          cx="50"
          cy="50"
          rx="15"
          ry="36"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Electron dot on orbit 3 */}
        <circle cx="50" cy="86" r="5" fill={dotColor} />
      </g>

      {/* Electron dot on orbit 1 */}
      <circle cx="35" cy="50" r="5" fill={dotColor} />
    </svg>
  );
}
