"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtomMark } from "@/components/brand/AtomMark";
import { NAV_ITEMS } from "./AdminSidebar";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The admin navigation on phones and tablets.
 *
 * The desktop rail is a fixed 256px column, which on a 375px screen leaves
 * roughly 119px for the page itself -- unusable. Below `lg` the rail is hidden
 * and this drawer takes over: a hamburger in the header, and a panel that
 * slides in over the content rather than displacing it.
 */
export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating away must close the drawer; without this the panel stays open
  // over the page the student just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes it, and the page behind must not scroll under the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        aria-expanded={open}
        // 44px square: the minimum comfortable touch target, and larger than
        // the icon it contains.
        className="lg:hidden -ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-navy transition-colors hover:bg-brand-tint"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* max-w-[85%] leaves a visible strip of the page behind, so the
              drawer reads as temporary and is easy to dismiss by tapping out. */}
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto bg-brand-navy shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex h-16 items-center justify-between gap-2 border-b border-white/15 bg-black/10 px-4">
                {/* A compact lockup, not the full LogoLockup: beside the close
                    button there is not room for "classes by KOUSTAV" on one
                    line, and it wrapped mid-phrase. */}
                <Link href="/admin/tests" className="flex min-w-0 items-center gap-2.5">
                  <AtomMark size={30} strokeColor="#FFFFFF" dotColor="#62BEF0" className="shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-[15px] font-bold uppercase leading-none tracking-wide text-white">
                      Koustav
                    </span>
                    <span className="mt-1 block text-[10px] uppercase tracking-wider text-[#87CEEB]">
                      Admin Portal
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close admin menu"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1 p-3">
                <div className="px-3 py-2 text-[10px] font-heading font-semibold uppercase tracking-widest text-white/50">
                  Assessment Management
                </div>

                {NAV_ITEMS.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium transition-all",
                        isActive
                          ? "bg-brand-blue font-semibold text-white shadow-sm"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-white" : "text-[#87CEEB]"
                        )}
                      />
                      <span className="min-w-0 truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
