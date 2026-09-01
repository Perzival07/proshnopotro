import React from "react";
import Link from "next/link";
import { AtomMark } from "./AtomMark";
import { cn } from "@/lib/utils";

interface LogoLockupProps {
  variant?: "white" | "navy";
  className?: string;
  href?: string;
  subtitle?: string;
}

export function LogoLockup({
  variant = "white",
  className,
  href = "/",
  subtitle,
}: LogoLockupProps) {
  const isWhite = variant === "white";
  const strokeColor = isWhite ? "#FFFFFF" : "#0A4B8C";
  const dotColor = isWhite ? "#62BEF0" : "#2E9CD8";

  const content = (
    <div className={cn("inline-flex items-center gap-3 select-none", className)}>
      <AtomMark
        size={36}
        strokeColor={strokeColor}
        dotColor={dotColor}
        className="shrink-0 transition-transform duration-300 group-hover:scale-105"
      />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className={cn(
              "font-heading font-medium text-[17px] tracking-tight",
              isWhite ? "text-white/90" : "text-brand-ink"
            )}
          >
            classes by
          </span>
          <span
            className={cn(
              "font-heading font-semibold text-[19px] tracking-wide uppercase",
              isWhite ? "text-white font-bold" : "text-brand-navy"
            )}
          >
            KOUSTAV
          </span>
        </div>
        {subtitle ? (
          <span
            className={cn(
              "text-[11px] font-sans tracking-wider uppercase mt-1",
              isWhite ? "text-white/70" : "text-brand-blue"
            )}
          >
            {subtitle}
          </span>
        ) : (
          <span
            className={cn(
              "text-[10px] font-sans tracking-widest uppercase mt-0.5 font-medium",
              isWhite ? "text-[#87CEEB]" : "text-brand-blue"
            )}
          >
            Learn. Succeed. Shine.
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
