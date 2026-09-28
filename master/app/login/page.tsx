import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, devLoginEnabled, signIn } from "@/auth";
import { LogoMark } from "@/components/Logo";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/** Only same-site paths, so the login page cannot bounce anyone elsewhere. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/hub";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  const session = await auth();
  if (session?.user?.email) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <LogoMark className="mx-auto h-14 w-14" />
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-brand-900">Sign in to Proshnopotro</h1>
          <p className="text-sm text-zinc-600">Use the Google account your tuition knows you by.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Sign-in did not work. Try again.
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: next });
          }}
        >
          <button type="submit" className={`${secondaryButtonClass} w-full`}>
            Continue with Google
          </button>
        </form>
        {devLoginEnabled && (
          <form
            className="space-y-2 border-t border-zinc-200 pt-6 text-left"
            action={async (form: FormData) => {
              "use server";
              await signIn("dev", { email: form.get("email"), redirectTo: next });
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Development only</p>
            <input name="email" type="email" required placeholder="any@email.com" className={inputClass} />
            <button type="submit" className={`${buttonClass} w-full`}>
              Quick login
            </button>
          </form>
        )}
        <p className="text-xs text-zinc-500">
          By signing in you agree to the <Link href="/terms" className="text-brand-700 hover:underline">terms</Link> and the{" "}
          <Link href="/privacy" className="text-brand-700 hover:underline">privacy policy</Link>.
        </p>
      </div>
    </main>
  );
}
