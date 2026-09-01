import React from "react";
import { AtomMark } from "./AtomMark";
import { cn } from "@/lib/utils";

interface LogoBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  showPhone?: boolean;
}

export function LogoBadge({
  size = 240,
  showPhone = true,
  className,
  ...props
}: LogoBadgeProps) {
  // Relative scaling based on base 240px
  const scale = size / 240;

  return (
    <div
      className={cn("flex flex-col items-center select-none", className)}
      style={{ width: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md"
      >
        {/* Outer Navy Ring */}
        <circle cx="120" cy="120" r="110" fill="#0A4B8C" />

        {/* Outer Ring Arc Paths for Text */}
        <defs>
          {/* Top arc for "classes by KOUSTAV" */}
          <path
            id="topTextPath"
            d="M 30,120 A 90,90 0 0,1 210,120"
            fill="none"
          />
          {/* Bottom arc for "LEARN. SUCCEED. SHINE." */}
          <path
            id="bottomTextPath"
            d="M 32,125 A 88,88 0 0,0 208,125"
            fill="none"
          />
        </defs>

        {/* Top Arc Text */}
        <text
          fill="#FFFFFF"
          fontFamily="var(--font-poppins), sans-serif"
          fontWeight="600"
          fontSize="17"
          letterSpacing="0.08em"
        >
          <textPath
            href="#topTextPath"
            startOffset="50%"
            textAnchor="middle"
          >
            classes by KOUSTAV
          </textPath>
        </text>

        {/* Equator Blue Triangle Accents */}
        {/* Left triangle pointing in */}
        <polygon points="26,120 40,111 40,129" fill="#2E9CD8" />
        {/* Right triangle pointing in */}
        <polygon points="214,120 200,111 200,129" fill="#2E9CD8" />

        {/* Bottom Arc Text: "LEARN. SUCCEED. SHINE." */}
        <text
          fill="#FFFFFF"
          fontFamily="var(--font-poppins), sans-serif"
          fontWeight="600"
          fontSize="12.5"
          letterSpacing="0.12em"
        >
          <textPath
            href="#bottomTextPath"
            startOffset="50%"
            textAnchor="middle"
          >
            &quot;LEARN. SUCCEED. SHINE.&quot;
          </textPath>
        </text>

        {/* Inner Light Blue Accent Ring */}
        <circle
          cx="120"
          cy="120"
          r="66"
          fill="#FFFFFF"
          stroke="#2E9CD8"
          strokeWidth="4"
        />

        {/* Central Atom Mark embedded */}
        <g transform="translate(70, 70)">
          <AtomMark
            size={100}
            strokeColor="#0A4B8C"
            dotColor="#2E9CD8"
          />
        </g>
      </svg>

      {/* Phone Number below the badge */}
      {showPhone && (
        <a
          href="tel:+919123924645"
          className="mt-3.5 font-heading font-semibold text-brand-ink text-base tracking-wider hover:text-brand-navy transition-colors flex items-center gap-1.5"
          style={{ fontSize: `${Math.max(14, 16 * scale)}px` }}
        >
          <span>+91 91239 24645</span>
        </a>
      )}
    </div>
  );
}
