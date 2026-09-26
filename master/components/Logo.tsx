import Link from "next/link";
import clsx from "clsx";

/** প্র, the first letters of প্রশ্নপত্র ("question paper"), on a gradient tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-sky-600 font-bengali font-bold text-white shadow-sm shadow-brand-500/30",
        className ?? "h-9 w-9 text-lg"
      )}
    >
      প্র
    </span>
  );
}

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
