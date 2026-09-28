import Link from "next/link";
import clsx from "clsx";

/*
 * Proshnopotro's logo (../proshnopotro_logo.png): the open book and pen nib
 * before Kolkata's skyline, over প্রশ্নপত্র and "Proshnopotro", on black.
 * public/brand/logo.webp is the whole logo, for large places; emblem.webp is
 * its square centre (nib, book, skyline) for small ones, and app/icon.png and
 * app/apple-icon.png are the emblem as the tab and home-screen icon.
 */

/** The square emblem, for small places. Size it with className (default 36px). */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/emblem.webp"
      alt=""
      aria-hidden="true"
      className={clsx("block shrink-0 rounded-xl object-cover shadow-sm shadow-brand-500/30", className ?? "h-9 w-9")}
    />
  );
}

/** The whole logo, with its black background: a badge on light pages, seamless on dark ones. */
export function FullLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo.webp"
      alt="Proshnopotro, প্রশ্নপত্র"
      width={1200}
      height={800}
      className={clsx("block h-auto rounded-2xl", className ?? "w-56")}
    />
  );
}

/** The emblem and the name, as a link home: the header's logo. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Proshnopotro home">
      <LogoMark />
      <span className={clsx("text-lg font-bold tracking-tight", light ? "text-white" : "text-brand-900")}>
        Proshnopotro
      </span>
    </Link>
  );
}
