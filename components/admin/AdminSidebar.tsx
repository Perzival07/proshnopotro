"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoLockup } from "@/components/brand/LogoLockup";
import {
  FileText,
  UserPlus,
  UploadCloud,
  Users,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    name: "Manage Tests",
    href: "/admin/tests",
    icon: FileText,
    description: "Create, edit & configure tests",
  },
  {
    name: "Assign Tests",
    href: "/admin/assign",
    icon: UserPlus,
    description: "Assign to students or bulk emails",
  },
  {
    name: "Test Rosters",
    href: "/admin/roster",
    icon: Users,
    description: "Student progress & CSV export",
  },
  {
    name: "Import Results",
    href: "/admin/results",
    icon: UploadCloud,
    description: "Google Forms response CSV match",
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-brand-navy text-white flex flex-col justify-between shrink-0 h-screen sticky top-0 border-r border-white/10 shadow-lg">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center border-b border-white/15 bg-black/10">
          <LogoLockup variant="white" href="/admin/tests" subtitle="Admin Portal" />
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-1">
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
                  "group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all",
                  isActive
                    ? "bg-brand-blue text-white shadow-sm font-semibold"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-[#87CEEB]")} />
                  <span className="text-[13px]">{item.name}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-80" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer / Switch to Student View */}
      <div className="p-4 border-t border-white/15 bg-black/15">
        <Link
          href="/"
          className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-xs text-white/90 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 text-brand-blue" />
            <span>Switch to Student View</span>
          </div>
        </Link>
        <p className="text-[10px] text-white/40 text-center mt-3">
          Classes by Koustav Admin v1.0
        </p>
      </div>
    </aside>
  );
}
