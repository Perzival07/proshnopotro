import Link from "next/link";
import clsx from "clsx";

/*
 * Proshnopotro's logo is a fountain-pen nib, navy and teal with a white
 * outline, on a transparent background: public/brand/nib.svg. The same
 * drawing is the tab icon (app/icon.svg); app/apple-icon.png is it on the
 * site's dark background for phones' home screens.
 */

/** The nib. Size it with className (default 36px). */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/nib.svg" alt="" aria-hidden="true" className={clsx("block shrink-0", className ?? "h-9 w-9")} />
  );
}

/** The nib and the name, as a link home: the header's and footer's logo. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label="Proshnopotro home">
      <LogoMark />
      <span className={clsx("text-lg font-bold tracking-tight", light ? "text-white" : "text-brand-900")}>
        Proshnopotro
      </span>
    </Link>
  );
}
