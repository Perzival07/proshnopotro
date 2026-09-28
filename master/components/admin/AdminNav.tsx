"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/admin", label: "Organisations" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" || path.startsWith("/admin/orgs") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "whitespace-nowrap rounded-lg px-3 py-1.5 font-medium",
              active ? "bg-brand-50 text-brand-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-brand-900"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
