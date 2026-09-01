import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LogoBadge } from "@/components/brand/LogoBadge";
import { OnboardingForm } from "./OnboardingForm";
import { Footer } from "@/components/Footer";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
  });

  if (user?.profileComplete) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-brand-page">
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-400">
          <div className="flex justify-center mb-5">
            <LogoBadge size={140} showPhone={false} />
          </div>

          <div className="bg-white rounded-xl border border-brand-border shadow-card p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="font-heading text-xl sm:text-2xl font-semibold text-brand-navy">
                Complete Your Student Profile
              </h1>
              <p className="text-sm text-brand-ink/70 mt-1.5">
                Welcome to <strong>Classes by Koustav</strong>. Please provide your academic details to activate your portal.
              </p>
            </div>

            <OnboardingForm
              defaultName={user?.name || session.user.name}
              email={session.user.email}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
