"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { demoHref, nav } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);

  // The menu covers the page on a phone; close it if the screen widens.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const close = () => wide.matches && setOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3.5 py-2 text-[15px] font-medium text-brand-900 transition hover:bg-slate-100"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#organisations"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-brand-900 transition hover:text-brand-600 sm:inline-flex"
          >
            Log in
          </a>
          <a
            href={demoHref}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:shadow-md hover:brightness-105"
          >
            Book a demo
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-brand-900 transition hover:bg-slate-100 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Main" className="border-t border-zinc-200/70 bg-white px-4 pb-4 pt-2 lg:hidden">
          {[...nav, { label: "Log in", href: "#organisations" }].map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-base font-medium text-brand-900 hover:bg-slate-100"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
