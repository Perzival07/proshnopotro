import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { signOut } from "@/auth";
import { LogoMark } from "@/components/Logo";
import { isSuperAdmin, requireSignedIn } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Your organisations | Proshnopotro", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The student hub: every organisation this Google account is enrolled in,
 * from the rosters the portals sync to the master. Signing in to the chosen
 * portal is that portal's own Google sign-in, with the same account.
 */
export default async function HubPage({ searchParams }: { searchParams: Promise<{ stay?: string }> }) {
  const email = await requireSignedIn("/hub");
  const { stay } = await searchParams;
  const orgs = await prisma.organisation.findMany({
    where: { status: "ACTIVE", enrolment: { some: { email } } },
    select: { slug: true, name: true, portalUrl: true },
    orderBy: { name: "asc" },
  });

  // One organisation: straight in, unless they came back here on purpose.
  if (orgs.length === 1 && !stay && !isSuperAdmin(email)) redirect(`${orgs[0].portalUrl}/login`);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <LogoMark className="mx-auto h-12 w-12 text-2xl" />
          <h1 className="text-xl font-bold text-brand-900">Your organisations</h1>
          <p className="text-sm text-zinc-600">Signed in as {email}</p>
        </div>

        {isSuperAdmin(email) && (
          <Link href="/admin" className="block rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm font-semibold text-brand-800 hover:bg-brand-100">
            Super admin workspace →
          </Link>
        )}

        {orgs.length === 0 ? (
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
            <p className="font-semibold text-brand-900">No organisation has enrolled this email yet.</p>
            <p>
              Ask your tuition to add <strong>{email}</strong> to their portal. New enrolments appear here within a day. If you used
              another Google account with them, sign out and use that one.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orgs.map((o) => (
              <li key={o.slug}>
                <a
                  href={`${o.portalUrl}/login`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
                >
                  <span>
                    <span className="block font-semibold text-brand-900">{o.name}</span>
                    <span className="block text-xs text-zinc-500">{o.portalUrl.replace(/^https?:\/\//, "")}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-brand-600" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-center gap-4 text-sm">
          <Link href="/" className="text-zinc-600 hover:text-brand-900">
            {site.name} home
          </Link>
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
    </main>
  );
}
