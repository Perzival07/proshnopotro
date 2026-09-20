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
  GraduationCap,
  NotebookText,
  School,
  ChevronRight,
  Library,
  ListTree,
  Layers,
  MessageCircleQuestion,
  PenLine,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InstallAppNavButton } from "@/components/pwa/InstallApp";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  /** Also shown to tutors. Everything else is for the owner alone. */
  tutor?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    name: "To Mark",
    href: "/admin/marking",
    icon: PenLine,
    description: "Answer sheets waiting for marks",
    tutor: true,
  },
  {
    name: "Manage Tests",
    href: "/admin/tests",
    icon: FileText,
    description: "Create, edit & configure tests",
  },
  {
    name: "Test Series",
    href: "/admin/series",
    icon: Layers,
    description: "Group tests to track progress",
  },
  {
    name: "Question Bank",
    href: "/admin/bank",
    icon: Library,
    description: "Past papers by year; reuse questions",
  },
  {
    name: "Assign Tests",
    href: "/admin/assign",
    icon: UserPlus,
    description: "Assign to students or bulk emails",
  },
  {
    name: "Students",
    href: "/admin/students",
    icon: GraduationCap,
    description: "Add, edit or remove students",
  },
  {
    name: "Classrooms",
    href: "/admin/classrooms",
    icon: School,
    description: "Group students into batches",
  },
  {
    name: "Notes",
    href: "/admin/notes",
    icon: NotebookText,
    description: "Share study material with a class",
  },
  {
    name: "Syllabus",
    href: "/admin/syllabus",
    icon: ListTree,
    description: "Chapters for tagging questions",
  },
  {
    name: "Doubts",
    href: "/admin/doubts",
    icon: MessageCircleQuestion,
    description: "Answer students' questions",
    tutor: true,
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
  {
    name: "Team",
    href: "/admin/team",
    icon: UserCog,
    description: "Tutors and what they can do",
  },
];

/** The links a role sees. */
export function navFor(role: "ADMIN" | "TUTOR"): NavItem[] {
  return role === "TUTOR" ? NAV_ITEMS.filter((i) => i.tutor) : NAV_ITEMS;
}

export function AdminSidebar({
  role = "ADMIN",
  badges,
}: {
  role?: "ADMIN" | "TUTOR";
  /** A count to show beside a link, by its href. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const items = navFor(role);

  return (
    <aside className="hidden lg:flex w-64 bg-brand-navy text-white flex-col justify-between shrink-0 h-screen sticky top-0 border-r border-white/10 shadow-lg">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center border-b border-white/15 bg-black/10">
          <LogoLockup variant="white" href={role === "TUTOR" ? "/admin/marking" : "/admin/tests"} subtitle={role === "TUTOR" ? "Tutor Portal" : "Admin Portal"} />
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-heading font-semibold uppercase tracking-widest text-white/50">
            Assessment Management
          </div>

          {items.map((item) => {
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
                {(badges?.[item.href] ?? 0) > 0 && (
                  <span
                    aria-label={`${badges![item.href]} waiting`}
                    className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white"
                  >
                    {badges![item.href]}
                  </span>
                )}
                {isActive && !(badges?.[item.href]) && <ChevronRight className="h-3.5 w-3.5 opacity-80" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/15 bg-black/15 space-y-2">
        <InstallAppNavButton />
        <p className="text-[10px] text-white/40 text-center">
          Classes by Koustav Admin v1.0
        </p>
      </div>
    </aside>
  );
}
