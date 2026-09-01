"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoLockup } from "@/components/brand/LogoLockup";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, ShieldCheck, BookOpen, Layers } from "lucide-react";
import { signOut } from "next-auth/react";

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: "STUDENT" | "ADMIN";
    phone?: string | null;
    className?: string | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";
  const initials =
    (user?.name || user?.email || "U")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-40 w-full bg-brand-navy shadow-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Wordmark */}
        <div className="flex items-center gap-6">
          <LogoLockup variant="white" href={isAdmin && pathname.startsWith("/admin") ? "/admin/tests" : "/"} />
          
          {/* Quick link if Admin */}
          {isAdmin && (
            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/20">
              <Link
                href="/admin/tests"
                className={`text-xs uppercase font-heading tracking-wider px-2.5 py-1 rounded transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-white/20 text-white font-semibold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Admin Center
              </Link>
              <Link
                href="/"
                className={`text-xs uppercase font-heading tracking-wider px-2.5 py-1 rounded transition-colors ${
                  pathname === "/"
                    ? "bg-white/20 text-white font-semibold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Student View
              </Link>
            </div>
          )}
        </div>

        {/* Right: User Avatar & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full focus-ring p-0.5">
                <Avatar className="h-9 w-9 ring-2 ring-brand-blue/50 hover:ring-brand-blue transition-all cursor-pointer">
                  {user.image && <AvatarImage src={user.image} alt={user.name || "Student"} />}
                  <AvatarFallback className="bg-brand-blue text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 bg-white shadow-xl border-brand-border">
                <DropdownMenuLabel className="font-normal px-2 py-1.5">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-navy leading-none truncate max-w-[150px]">
                        {user.name || "Student"}
                      </p>
                      <Badge
                        variant={isAdmin ? "admin" : "brand"}
                        className="text-[10px] uppercase px-1.5 py-0"
                      >
                        {user.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-brand-ink/70 leading-none truncate">
                      {user.email}
                    </p>
                    {user.className && (
                      <p className="text-xs font-medium text-brand-blue pt-0.5">
                        {user.className}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/tests" className="flex items-center gap-2 text-xs">
                        <ShieldCheck className="h-4 w-4 text-brand-navy" />
                        <span>Manage Tests</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/assign" className="flex items-center gap-2 text-xs">
                        <Layers className="h-4 w-4 text-brand-navy" />
                        <span>Assign Tests</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/results" className="flex items-center gap-2 text-xs">
                        <BookOpen className="h-4 w-4 text-brand-navy" />
                        <span>Import Results</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2 text-xs text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="text-xs font-heading font-semibold uppercase tracking-wider text-white bg-brand-blue/90 hover:bg-brand-blue px-3.5 py-1.5 rounded-md transition-colors shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
