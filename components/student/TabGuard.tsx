"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { recordTabSwitch } from "@/app/test/[assignmentId]/actions";
import { Button } from "@/components/ui/button";
import { EyeOff } from "lucide-react";

interface TabGuardProps {
  assignmentId: string;
  /** Only watch while the paper is actually open and unfinished. */
  active: boolean;
  /** The guard ended the attempt; the parent shows the closing panel. */
  onSubmitted: (message: string) => void;
}

/**
 * Watches for the student leaving the assessment.
 *
 * Deliberately listens to `visibilitychange` and nothing else. The obvious
 * alternative, a window `blur` listener, fires the moment the student clicks
 * into the Google Form iframe -- so it would report a violation for the act of
 * answering a question. `visibilitychange` fires only when the page really is
 * hidden: another tab, another window, a minimise, a locked screen, or a
 * backgrounded app on a phone.
 *
 * The count itself belongs to the server; this reports departures and shows
 * whatever it is told.
 */
export function TabGuard({ assignmentId, active, onSubmitted }: TabGuardProps) {
  const [warning, setWarning] = useState<string | null>(null);
  // One departure can raise several events (hide, then a focus change on the
  // way back). Without this window they would be billed as separate strikes.
  const lastReportedAt = useRef(0);
  const reportingRef = useRef(false);

  const report = useCallback(async () => {
    const now = Date.now();
    if (reportingRef.current || now - lastReportedAt.current < 1500) return;
    lastReportedAt.current = now;
    reportingRef.current = true;

    try {
      const res = await recordTabSwitch(assignmentId);
      if (res.error) return; // Never end an attempt over a failed report.
      if (res.submitted) {
        onSubmitted(
          res.message ||
            "You left the assessment too many times. Your test has been submitted."
        );
        return;
      }
      if (res.message) setWarning(res.message);
    } catch {
      // A dropped connection is not the student's violation to answer for.
    } finally {
      reportingRef.current = false;
    }
  }, [assignmentId, onSubmitted]);

  useEffect(() => {
    if (!active) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void report();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, report]);

  if (!warning) return null;

  return (
    // Above the full-screen paper overlay (z-50), so the warning is not buried
    // underneath the very thing the student is sitting in.
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/70 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tab-guard-title"
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <EyeOff className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2
              id="tab-guard-title"
              className="font-heading text-base font-bold text-brand-navy"
            >
              Stay on the assessment
            </h2>
            <p className="text-xs leading-relaxed text-brand-ink/80">{warning}</p>
          </div>
        </div>

        <Button
          onClick={() => setWarning(null)}
          size="lg"
          className="mt-5 w-full bg-brand-navy font-semibold text-white hover:bg-brand-navy/90"
        >
          Return to my assessment
        </Button>
      </div>
    </div>
  );
}
