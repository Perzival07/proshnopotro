import React from "react";
import { requireAdmin } from "@/lib/auth-utils";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUser = await requireAdmin();

  return (
    <div className="min-h-screen flex bg-brand-page text-brand-ink">
      {/* Fixed Desktop Sidebar */}
      <AdminSidebar />

      {/* Main Admin Content Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Admin Top Header */}
        <header className="h-16 border-b border-brand-border bg-white px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-navy" />
            <span className="font-heading font-semibold text-sm text-brand-navy">
              Tutor Administration Console
            </span>
            <Badge variant="admin" className="ml-2 text-[10px] uppercase py-0.5">
              Authorized Admin
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-brand-navy leading-none">
                {adminUser.name || "Admin Tutor"}
              </p>
              <p className="text-[11px] text-brand-ink/60 mt-0.5 leading-none">
                {adminUser.email}
              </p>
            </div>
            <Avatar className="h-8 w-8 ring-1 ring-brand-border">
              {adminUser.image && <AvatarImage src={adminUser.image} />}
              <AvatarFallback className="bg-brand-navy text-white text-xs">
                AD
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Dynamic page content */}
        <div className="p-8 max-w-7xl w-full mx-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
