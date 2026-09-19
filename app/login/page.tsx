import React, { Suspense } from "react";
import { getVerifiedSession } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/permissions";
import { LogoBadge } from "@/components/brand/LogoBadge";
import { LoginForm } from "./LoginForm";
import { Footer } from "@/components/Footer";
import { InstallAppCard } from "@/components/pwa/InstallApp";

export default async function LoginPage() {
  // Read from the database, not the session cookie: the cookie's copy of the
  // role is only refreshed at sign-in, and a student promoted since then
  // should still land on the admin console.
  const user = await getVerifiedSession();

  if (user) {
    if (user.role === "ADMIN" || user.role === "TUTOR") {
      redirect(homeFor(user.role));
    }
    if (!user.profileComplete) {
      redirect("/onboarding");
    }
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-brand-page">
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
          {/* Centered Large LogoBadge */}
          <div className="mb-6 flex justify-center">
            <LogoBadge size={220} showPhone={false} />
          </div>

          <div className="w-full bg-white rounded-xl border border-brand-border shadow-card p-6 sm:p-8 text-center">
            <h1 className="font-heading text-xl sm:text-2xl font-semibold text-brand-navy mb-1">
              Student Assessment Portal
            </h1>
            <p className="text-body text-brand-ink/70 mb-6 text-sm">
              Sign in with your registered Google account to view and access your assigned assessments.
            </p>

            <Suspense fallback={<div className="h-24" />}>
              <LoginForm />
            </Suspense>
          </div>

          <InstallAppCard className="mt-4 w-full" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
