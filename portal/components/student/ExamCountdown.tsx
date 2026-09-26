"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatRemaining } from "@/lib/exam-timer";
import { Timer, AlertTriangle } from "lucide-react";

interface ExamCountdownProps {
  /**
   * The server's deadline already translated into this browser's clock, so
   * this component only ever subtracts it from `Date.now()`.
   *
   * The translation deliberately belongs to the parent: it can only be done
   * correctly at the instant the server's timestamp arrives, and this widget
   * is remounted whenever the paper goes in or out of full screen. Doing it
   * here meant every remount re-measured the offset against a `serverNow`
   * that was by then minutes old, and the whole elapsed time was absorbed
   * into the offset -- restarting the countdown from the top.
   */
  deadlineMs: number;
  /** Fired once, when the countdown reaches zero. */
  onExpire: () => void;
  /** Suppresses the callback once the attempt is already closed. */
  expired?: boolean;
}

/** Under this many milliseconds the pill turns urgent. */
const WARNING_MS = 5 * 60_000;
const CRITICAL_MS = 60_000;

/**
 * The student's countdown.
 *
 * It is a display and a trigger, never the authority: the server decides when
 * the attempt is over and re-checks that before accepting the submission this
 * fires. Its job is to be honest about the remaining time and to make sure a
 * student who is still on the page gets submitted the moment it runs out.
 */
export function ExamCountdown({
  deadlineMs,
  onExpire,
  expired = false,
}: ExamCountdownProps) {
  const readRemaining = useCallback(
    () => Math.max(0, deadlineMs - Date.now()),
    [deadlineMs]
  );

  // Rendered as null on the server and on the first client paint: the value is
  // time-dependent, so committing to one during SSR guarantees a hydration
  // mismatch a second later.
  const [remaining, setRemaining] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = readRemaining();
      setRemaining(left);
      if (left <= 0 && !firedRef.current && !expired) {
        firedRef.current = true;
        onExpire();
      }
    };

    tick();
    // Twice a second: a 1s interval throttled in a background tab makes the
    // displayed value visibly lag the real one when the student comes back.
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [readRemaining, onExpire, expired]);

  const isOut = remaining !== null && remaining <= 0;
  const isCritical = remaining !== null && remaining > 0 && remaining <= CRITICAL_MS;
  const isWarning = remaining !== null && remaining > CRITICAL_MS && remaining <= WARNING_MS;

  const tone = isOut
    ? "border-red-300 bg-red-50 text-red-800"
    : isCritical
    ? "border-red-300 bg-red-50 text-red-800 animate-pulse"
    : isWarning
    ? "border-[#F3DCB5] bg-[#FAEEDA] text-[#633806]"
    : "border-brand-border bg-white text-brand-navy";

  return (
    <div
      role="timer"
      aria-live={isCritical || isOut ? "assertive" : "off"}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 shadow-xs transition-colors ${tone}`}
    >
      <span className="flex items-center gap-2 text-xs font-semibold">
        {isOut || isCritical ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Timer className="h-4 w-4 shrink-0 text-brand-blue" />
        )}
        {isOut ? "Time is up" : "Time remaining"}
      </span>

      <span className="font-mono text-lg font-bold tabular-nums leading-none">
        {remaining === null ? "--:--" : formatRemaining(remaining)}
      </span>
    </div>
  );
}
