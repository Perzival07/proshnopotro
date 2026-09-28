"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import type { ShowcaseOrg } from "@/lib/showcase";

function OrgTile({ org, hidden = false }: { org: ShowcaseOrg; hidden?: boolean }) {
  return (
    <a
      href={org.portalUrl}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className="group flex h-full w-40 shrink-0 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-night-900/80 px-4 pb-4 pt-5 transition hover:-translate-y-1 hover:border-white/25"
    >
      <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg shadow-black/30">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={hidden ? "" : `${org.name} logo`} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center rounded-xl text-3xl font-extrabold text-white"
            style={{ background: `linear-gradient(135deg, ${org.color}, #1e1e4b)` }}
          >
            {org.name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-center text-sm font-semibold leading-snug text-white">{org.name}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition group-hover:text-brand-300">
        Open portal <ArrowUpRight className="h-3 w-3" />
      </span>
    </a>
  );
}

/**
 * The organisations' logos: still and centred while they fit on one line,
 * rotating (paused on hover) once they do not. A hidden copy of the row is
 * measured against the space, so the choice follows the screen's width.
 */
export function JoinedOrgs({ orgs }: { orgs: ShowcaseOrg[] }) {
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setRotate((measure.current?.offsetWidth ?? 0) > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [orgs.length]);

  const gap = "gap-5";
  return (
    <div ref={box} className="relative">
      <div ref={measure} aria-hidden="true" className={clsx("invisible absolute left-0 top-0 flex w-max", gap)}>
        {orgs.map((o) => (
          <OrgTile key={o.slug} org={o} hidden />
        ))}
      </div>

      {rotate ? (
        <div className="mask-fade-x overflow-hidden motion-reduce:overflow-x-auto">
          <ul
            className={clsx("flex w-max animate-marquee py-2 hover:[animation-play-state:paused]", gap)}
            // Longer rows turn at the same speed, not faster.
            style={{ animationDuration: `${Math.max(20, orgs.length * 5)}s` }}
          >
            {[...orgs, ...orgs].map((o, i) => (
              // The second copy makes the loop seamless; the gap after the
              // last tile keeps the spacing even where the copies meet.
              <li key={`${o.slug}-${i}`} className={clsx("flex", i === orgs.length * 2 - 1 && "pr-5")}>
                <OrgTile org={o} hidden={i >= orgs.length} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className={clsx("flex flex-wrap justify-center py-2", gap)}>
          {orgs.map((o) => (
            <li key={o.slug} className="flex">
              <OrgTile org={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
