import React from "react";
import Image from "next/image";
import { AtomMark } from "./AtomMark";
import { cn } from "@/lib/utils";
import { org, textOnlyBrand } from "@/lib/org";

/**
 * The organisation's mark: the logo uploaded in the master when there is
 * one, else the atom mark in its colours. On a dark background ("onDark")
 * the logo sits on a white tile so it stays visible whatever its colours.
 * (Loading spinners stay the animated atom, whatever the logo.)
 */
export function BrandMark({ size, onDark = false, className }: { size: number; onDark?: boolean; className?: string }) {
  if (textOnlyBrand) return null;
  if (org.hasLogoImage) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", onDark && "rounded-lg bg-white p-0.5", className)}
        style={{ width: size, height: size }}
      >
        <Image src="/org-logo.png" alt="" width={size} height={size} className="h-full w-full object-contain" unoptimized />
      </span>
    );
  }
  return (
    <AtomMark
      size={size}
      strokeColor={onDark ? "#FFFFFF" : org.colors.navy}
      dotColor={onDark ? org.colors.onDark : org.colors.blue}
      className={className}
    />
  );
}
