import React from "react";
import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";
import { org } from "@/lib/org";

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

  const content = (
    <div className={cn("inline-flex items-center gap-3 select-none", className)}>
      <BrandMark size={36} onDark={isWhite} className="shrink-0 transition-transform duration-300 group-hover:scale-105" />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className={cn(
              "font-heading font-medium text-[17px] tracking-tight",
              isWhite ? "text-white/90" : "text-brand-ink"
            )}
          >
            {org.logo.prefix}
          </span>
          <span
            className={cn(
              "font-heading font-semibold text-[19px] tracking-wide uppercase",
              isWhite ? "text-white font-bold" : "text-brand-navy"
            )}
          >
            {org.logo.main}
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
        ) : org.tagline ? (
          <span
            className={cn(
              "text-[10px] font-sans tracking-widest uppercase mt-0.5 font-medium",
              isWhite ? "text-brand-on-dark" : "text-brand-blue"
            )}
          >
            {org.tagline}
          </span>
        ) : null}
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
