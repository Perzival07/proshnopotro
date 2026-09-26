"use client";

import { useEffect } from "react";
import type { Violation } from "./ViolationGuard";

interface TabGuardProps {
  /** Only watch while the paper is actually open and unfinished. */
  active: boolean;
  report: (kind: Violation) => void;
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
 * Reporting, counting and the warning shown are in `ViolationGuard`.
 */
export function TabGuard({ active, report }: TabGuardProps) {
  useEffect(() => {
    if (!active) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") report("TAB");
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, report]);

  return null;
}
