import React from "react";
import { AtomMark } from "@/components/brand/AtomMark";

export function EmptyState() {
  return (
    <div className="w-full flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-brand-border bg-white shadow-xs max-w-2xl mx-auto my-12">
      <div className="p-4 bg-brand-tint/60 rounded-full mb-4">
        <AtomMark size={64} strokeColor="#0A4B8C" dotColor="#2E9CD8" />
      </div>
      <h2 className="font-heading text-lg sm:text-xl font-semibold text-brand-navy mb-2">
        No tests assigned yet
      </h2>
      <p className="text-body text-brand-ink/70 max-w-md leading-relaxed text-sm">
        Your tutor will assign tests here when they&apos;re ready. Check back soon or contact your tutor if you are expecting a test.
      </p>
    </div>
  );
}
