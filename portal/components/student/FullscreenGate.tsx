"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";

/**
 * Covers the paper until the student is in full screen.
 *
 * A proctored paper is sat full screen so that nothing else -- a second
 * window, a split screen, a floating chat -- can share the display. The click
 * is what lets the browser grant full screen at all (it refuses without a user
 * gesture), so this is a button, never an automatic request. The clock keeps
 * running behind it, which the message says.
 */
export function FullscreenGate({ show, onEnter }: { show: boolean; onEnter: () => void }) {
  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-navy/90 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fullscreen-gate-title"
        className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 text-left shadow-xl"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-navy">
            <Maximize2 className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 id="fullscreen-gate-title" className="font-heading text-base font-bold text-brand-navy">
              Continue in full screen
            </h2>
            <p className="text-xs leading-relaxed text-brand-ink/80">
              This assessment is sat in full screen. Leaving full screen counts as leaving the
              assessment, and doing it again will submit your test. Your timer is running.
            </p>
          </div>
        </div>

        <Button
          onClick={onEnter}
          size="lg"
          className="mt-5 w-full bg-brand-navy font-semibold text-white hover:bg-brand-navy/90"
        >
          Enter full screen
        </Button>
      </div>
    </div>,
    document.body
  );
}
