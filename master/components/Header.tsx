"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { demoHref, nav } from "@/lib/site";

/** How far below the top of the screen a section must reach to count as the one being read. */
const READING_LINE = 140;

export function Header() {
  const [open, setOpen] = useState(false);
  // The links whose sections are on this page, each pointing at the one that is.
  const [links, setLinks] = useState(nav.map(({ label, href }) => ({ label, href })));
  const [active, setActive] = useState(-1);
  const [hovered, setHovered] = useState(-1);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);

  // The menu covers the page on a phone; close it if the screen widens.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const close = () => wide.matches && setOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    const has = (h: string) => Boolean(document.getElementById(h.slice(1)));
    const top = (h: string) => document.getElementById(h.slice(1))!.getBoundingClientRect().top;
    setLinks(
      nav
        .map(({ label, href, fallback }) => ({ label, href: has(href) ? href : fallback && has(fallback) ? fallback : "" }))
        .filter((l) => l.href)
        // In the order the sections come down the page, whichever of them are here.
        .sort((a, b) => top(a.href) - top(b.href))
    );
  }, []);

  // The section being read is the last one whose top has passed the reading line.
  useEffect(() => {
    const sections = links.map((l) => document.getElementById(l.href.slice(1)));
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = -1;
      sections.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= READING_LINE) current = i;
      });
      // At the very bottom the last section may be too short to reach the line.
      if (current >= 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = sections.length - 1;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [links]);

  // The highlight glides to the link being hovered, else the one being read.
  const target = hovered >= 0 ? hovered : active;
  const place = useCallback(() => {
    const el = target >= 0 ? items.current[target] : null;
    setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [target]);
  useLayoutEffect(place, [place, links]);
  useEffect(() => {
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Logo light />

        <nav aria-label="Main" className="hidden lg:block">
          <div className="relative flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1" onMouseLeave={() => setHovered(-1)}>
            {/* The gliding highlight, underlined in the site's gradient */}
            <span
              aria-hidden="true"
              className={clsx(
                "pointer-events-none absolute bottom-1 top-1 rounded-full bg-white/10 transition-[left,width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                pill ? "opacity-100" : "opacity-0"
              )}
              style={pill ? { left: pill.left, width: pill.width } : undefined}
            >
              <span className="absolute inset-x-4 -bottom-[5px] h-[2px] rounded-full bg-gradient-to-r from-brand-400 to-accent-400" />
            </span>
            {links.map((item, i) => (
              <a
                key={item.href}
                ref={(el) => {
                  items.current[i] = el;
                }}
                href={item.href}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(-1)}
                aria-current={i === active ? "location" : undefined}
                className={clsx(
                  "relative z-10 whitespace-nowrap rounded-full px-4 py-1.5 text-[15px] font-medium transition-colors duration-300",
                  i === target ? "text-white" : "text-slate-400 hover:text-white"
                )}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="/hub"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:inline-flex"
          >
            Log in
          </a>
          <a
            href={demoHref}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-400"
          >
            Book a demo
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-200 transition hover:bg-white/10 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Main" className="border-t border-white/10 bg-night-950 px-4 pb-4 pt-2 lg:hidden">
          {/* The same order down a line, with the section being read marked on it */}
          <ol className="ml-2 border-l border-white/10">
            {links.map((item, i) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={i === active ? "location" : undefined}
                  className={clsx(
                    "-ml-px block border-l-2 py-3 pl-4 text-base font-medium transition-colors",
                    i === active ? "border-brand-400 text-white" : "border-transparent text-slate-300 hover:text-white"
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
          <a href="/hub" onClick={() => setOpen(false)} className="mt-2 block rounded-md px-3 py-3 text-base font-medium text-slate-200 hover:bg-white/5">
            Log in
          </a>
        </nav>
      )}
    </header>
  );
}
