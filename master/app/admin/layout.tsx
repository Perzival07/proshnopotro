import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { LogoMark } from "@/components/Logo";
import { requireSuperAdmin } from "@/lib/access";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Super admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = await requireSuperAdmin();
  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="inline-flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="font-bold text-brand-900">Super admin</span>
          </Link>
          <div className="order-last w-full sm:order-none sm:w-auto">
            <AdminNav />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline">{email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="font-medium text-brand-700 hover:text-brand-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
