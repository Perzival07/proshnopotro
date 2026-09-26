"use client";

import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fullscreenElement } from "@/lib/fullscreen";
import { recordCaptureAttempt, recordTabSwitch } from "@/app/test/[assignmentId]/actions";
import { Button } from "@/components/ui/button";
import { EyeOff } from "lucide-react";

/** Everything the exam guards can report: each one spends a strike. */
export type Violation = "TAB" | "FULLSCREEN" | "CAPTURE";

/**
 * The single place the exam guards report to.
 *
 * One departure can raise several events -- pressing Ctrl+Tab in full screen
 * both hides the page and exits full screen -- and each guard on its own would
 * bill that as a separate strike, ending the attempt on what was one act. So
 * every guard reports through here, and one window swallows the echoes.
 *
 * The count itself belongs to the server; this reports the violation and shows
 * whatever it is told.
 */
export function useViolationReporter(
  assignmentId: string,
  onSubmitted: (message: string) => void
) {
  const [warning, setWarning] = useState<string | null>(null);
  const lastReportedAt = useRef(0);
  const reportingRef = useRef(false);

  const report = useCallback(
    async (kind: Violation) => {
      const now = Date.now();
      if (reportingRef.current || now - lastReportedAt.current < 1500) return;
      lastReportedAt.current = now;
      reportingRef.current = true;

      try {
        const res =
          kind === "CAPTURE"
            ? await recordCaptureAttempt(assignmentId)
            : await recordTabSwitch(assignmentId, kind);
        if (res.error) return; // Never end an attempt over a failed report.
        if (res.submitted) {
          onSubmitted(
            res.message ||
              "You broke the assessment rules too many times. Your test has been submitted."
          );
          return;
        }
        if (res.message) setWarning(res.message);
      } catch {
        // A dropped connection is not the student's violation to answer for.
      } finally {
        reportingRef.current = false;
      }
    },
    [assignmentId, onSubmitted]
  );

  const dismiss = useCallback(() => setWarning(null), []);

  return { report, warning, dismiss };
}

/** The warning the student must acknowledge after a violation. */
export function ViolationWarning({
  warning,
  onDismiss,
}: {
  warning: string | null;
  onDismiss: () => void;
}) {
  if (!warning) return null;

  // Native fullscreen paints nothing outside the full-screen element, so a
  // warning raised while the paper is full screen is placed inside it.
  return createPortal(
    // Above the full-screen paper overlay (z-50), so the warning is not buried
    // underneath the very thing the student is sitting in.
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-navy/70 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="violation-title"
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <EyeOff className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 id="violation-title" className="font-heading text-base font-bold text-brand-navy">
              Stay on the assessment
            </h2>
            <p className="text-xs leading-relaxed text-brand-ink/80">{warning}</p>
          </div>
        </div>

        <Button
          onClick={onDismiss}
          size="lg"
          className="mt-5 w-full bg-brand-navy font-semibold text-white hover:bg-brand-navy/90"
        >
          Return to my assessment
        </Button>
      </div>
    </div>,
    fullscreenElement(document) ?? document.body
  );
}
