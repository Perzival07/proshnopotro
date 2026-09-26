import React from "react";
import { Phone } from "lucide-react";
import { org, PRODUCT_NAME } from "@/lib/org";

export function Footer() {
  return (
    <footer className="w-full border-t border-brand-border bg-white py-6 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-brand-ink/75">
        <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4 text-center sm:text-left">
          <span className="font-heading font-semibold text-brand-navy">
            {org.name}
          </span>
          <span className="hidden sm:inline text-brand-border">|</span>
          <span className="text-brand-ink/60 font-medium">
            Assessment Portal • &ldquo;{org.tagline}&rdquo;
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-brand-ink/60">For questions or support:</span>
          <a
            href={`tel:${org.support.phone}`}
            className="inline-flex items-center gap-1.5 font-heading font-semibold text-brand-navy hover:text-brand-blue transition-colors px-2 py-1 rounded-md hover:bg-brand-tint/60"
          >
            <Phone className="h-3.5 w-3.5 text-brand-blue" />
            <span>{org.support.phoneDisplay}</span>
          </a>
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-brand-ink/40">
        Powered by {PRODUCT_NAME}
      </p>
    </footer>
  );
}
