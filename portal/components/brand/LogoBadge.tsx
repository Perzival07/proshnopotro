import React from "react";
import { AtomMark } from "./AtomMark";
import { cn } from "@/lib/utils";
import { org } from "@/lib/org";

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
        <circle cx="120" cy="120" r="110" fill={org.colors.navy} />

        {/* Outer Ring Arc Paths for Text */}
        <defs>
          {/* Top arc for the organisation name, e.g. "classes by KOUSTAV" */}
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
            {org.logo.prefix} {org.logo.main}
          </textPath>
        </text>

        {/* Equator Blue Triangle Accents */}
        {/* Left triangle pointing in */}
        <polygon points="26,120 40,111 40,129" fill={org.colors.blue} />
        {/* Right triangle pointing in */}
        <polygon points="214,120 200,111 200,129" fill={org.colors.blue} />

        {/* Bottom Arc Text: the tagline */}
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
            &quot;{org.tagline.toUpperCase()}&quot;
          </textPath>
        </text>

        {/* Inner Light Blue Accent Ring */}
        <circle
          cx="120"
          cy="120"
          r="66"
          fill="#FFFFFF"
          stroke={org.colors.blue}
          strokeWidth="4"
        />

        {/* The organisation's logo from the master, else the atom mark */}
        {org.hasLogoImage ? (
          <image href="/org-logo.png" x="74" y="74" width="92" height="92" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <g transform="translate(70, 70)">
            <AtomMark size={100} strokeColor={org.colors.navy} dotColor={org.colors.blue} />
          </g>
        )}
      </svg>

      {/* Phone Number below the badge */}
      {showPhone && org.support.phone && (
        <a
          href={`tel:${org.support.phone}`}
          className="mt-3.5 font-heading font-semibold text-brand-ink text-base tracking-wider hover:text-brand-navy transition-colors flex items-center gap-1.5"
          style={{ fontSize: `${Math.max(14, 16 * scale)}px` }}
        >
          <span>{org.support.phoneDisplay}</span>
        </a>
      )}
    </div>
  );
}
