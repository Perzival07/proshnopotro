"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { resolveSecureFormUrl, markStudentSubmission } from "./actions";
import {
  enterFullscreen,
  exitFullscreen,
  isNativeFullscreen,
} from "@/lib/fullscreen";
import type { TestFormat } from "@/lib/test-resource";
import { ExamCountdown } from "@/components/student/ExamCountdown";
import { TabGuard } from "@/components/student/TabGuard";
import { AnswerUploadPanel } from "@/components/student/AnswerUploadPanel";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  ExternalLink,
  AlertCircle,
  TimerOff,
  ShieldAlert,
  CheckCircle2,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

interface StartTestButtonProps {
  assignmentId: string;
  testTitle: string;
  testFormat: TestFormat;
  studentName?: string | null;
  /**
   * Set only when this student already started a timed attempt, so a reload
   * shows the clock still running rather than a fresh, untouched page.
   */
  initialEndsAt?: string | null;
  initialServerNow?: string | null;
  /** Whether leaving the tab is warned about and, on the second time, ends it. */
  proctored?: boolean;
  /**
   * "upload" when the attempt already ended but the answers are not uploaded
   * yet -- a reload, or a student coming back -- so the page opens straight
   * onto the upload pop-up instead of the paper.
   */
  initialPhase?: "exam" | "upload";
}

/**
 * Turns the server's deadline into an instant on this browser's clock.
 *
 * `serverNow` is the server's own time at the moment it issued `endsAt`, so
 * the difference against `Date.now()` right now is the browser's skew -- a
 * machine whose clock is minutes out cannot hand itself extra time or lose
 * any. This must be measured while `serverNow` is fresh, which is why the
 * result is computed once here and then held, never recomputed further down.
 */
function toClientDeadline(endsAt: string, serverNow: string): number {
  return Date.parse(endsAt) + (Date.now() - Date.parse(serverNow));
}

export function StartTestButton({
  assignmentId,
  testTitle,
  testFormat,
  studentName,
  initialEndsAt,
  initialServerNow,
  proctored = false,
  initialPhase = "exam",
}: StartTestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  // Resolved only after the server has authorised this student, so the link
  // still never appears in the page's initial HTML.
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Timing comes from the server -- both on load (a resumed attempt) and from
  // the resolve call that starts the clock. It is stored as a single instant
  // on this browser's clock, fixed when it arrives: the countdown below is
  // remounted as the paper moves in and out of full screen, and a value it had
  // to re-derive on every mount would drift back to the full duration.
  const [deadlineMs, setDeadlineMs] = useState<number | null>(() =>
    initialEndsAt && initialServerNow
      ? toClientDeadline(initialEndsAt, initialServerNow)
      : null
  );
  // True once the attempt is over, however it ended. The paper is taken away
  // and the answer upload takes its place.
  const [timeUp, setTimeUp] = useState(initialPhase === "upload");
  // Read once. Closing the attempt revalidates this page, which re-renders it
  // with initialPhase="upload" while this component keeps its state -- so the
  // live prop cannot tell a page that opened on the upload from one that just
  // got there.
  const [openedOnUpload] = useState(initialPhase === "upload");
  // The student pressed Finish, as opposed to the clock or the guard ending it.
  const [finishedEarly, setFinishedEarly] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  // Set when the tab guard, rather than the clock, ended the attempt -- the
  // closing panel has to say which, since the student can tell the difference.
  const [guardMessage, setGuardMessage] = useState<string | null>(null);

  const handleGuardSubmitted = useCallback((message: string) => {
    setGuardMessage(message);
    setTimeUp(true);
    if (typeof document !== "undefined") void exitFullscreen(document);
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
    if (typeof document !== "undefined") void exitFullscreen(document);
  }, []);

  const expand = useCallback(() => {
    setExpanded(true);
    // Native fullscreen hides the browser chrome where it is allowed; the CSS
    // overlay below covers the cases where it is not (notably iOS Safari).
    void enterFullscreen(previewRef.current);
  }, []);

  // Escape closes it, and leaving native fullscreen (browser UI, F11) keeps
  // our overlay in step rather than stranding it.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    const onFsChange = () => {
      if (!isNativeFullscreen(document)) setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    // Stop the page behind the overlay from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded, collapse]);

  const isDoc = testFormat === "GOOGLE_DOC";
  const paperNoun = isDoc ? "Question Paper" : "Google Form";

  const handleOpen = async () => {
    setLoading(true);
    setError(null);

    const res = await resolveSecureFormUrl(assignmentId);
    setLoading(false);

    if (res.ended) {
      // The attempt closed while they were away; go straight to the upload.
      setTimeUp(true);
      return;
    }
    if (res.error || !res.embedUrl) {
      setError(res.error || "Could not load the question paper.");
      return;
    }

    setEmbedUrl(res.embedUrl);
    setOpened(true);
    if (res.endsAt && res.serverNow) {
      const fresh = toClientDeadline(res.endsAt, res.serverNow);
      // Re-opening the paper resolves the same attempt again, so never let a
      // second answer push the deadline out; the earliest one stands.
      setDeadlineMs((current) => (current === null ? fresh : Math.min(current, fresh)));
    }
  };

  /**
   * The countdown hit zero. The submission still has to clear the server's own
   * clock check, so this is a request to close the attempt, not a decision.
   * The ref guards against the countdown remounting (it moves in the tree when
   * the preview opens) and firing a second time.
   */
  const expiringRef = useRef(false);
  const handleExpire = useCallback(async () => {
    if (expiringRef.current) return;
    expiringRef.current = true;

    setTimeUp(true);
    collapse();
    setSubmitting(true);
    try {
      const res = await markStudentSubmission(assignmentId, "TIMER");
      if (res.error) {
        // Leave the manual confirm button in reach rather than trapping the
        // student behind a failed auto-submit.
        setError(res.error);
        setTimeUp(false);
        expiringRef.current = false;
      }
    } catch {
      setError("Your time is up, but the submission could not be saved. Please press the confirm button.");
      setTimeUp(false);
      expiringRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [assignmentId, collapse]);

  const countdown =
    deadlineMs !== null ? (
      <ExamCountdown deadlineMs={deadlineMs} onExpire={handleExpire} expired={timeUp} />
    ) : null;

  const handleFinish = async () => {
    setConfirmingFinish(false);
    setSubmitting(true);
    setError(null);
    try {
      const res = await markStudentSubmission(assignmentId, "STUDENT");
      if (res.error) {
        setError(res.error);
        return;
      }
      collapse();
      setFinishedEarly(true);
      setTimeUp(true);
    } catch {
      setError("Could not finish the assessment. Check your internet and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Watching starts only once the paper is actually in front of them, and
          stops the moment the attempt is over. */}
      {proctored && (
        <TabGuard
          assignmentId={assignmentId}
          active={opened && !timeUp && !submitting}
          onSubmitted={handleGuardSubmitted}
        />
      )}

      {error && (
        <div className="p-3.5 text-xs bg-red-50 text-red-800 border border-red-200 rounded-lg flex items-center gap-2.5 text-left">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {timeUp ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-red-900">
            <TimerOff className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="space-y-1 text-xs">
              <p className="font-heading text-sm font-semibold">
                {guardMessage ? "Assessment closed" : finishedEarly ? "Assessment finished" : "Time is up"}
              </p>
              <p className="leading-relaxed">
                {submitting
                  ? "Submitting your assessment\u2026"
                  : "The question paper is closed. Upload photos of your answers to finish."}
              </p>
            </div>
          </div>

          {/* The paper is gone; the upload pop-up is the only way forward.
              Held back until the close-out has landed, so the server is
              already treating the attempt as ended when it is asked. */}
          {!submitting && (
            <AnswerUploadPanel
              assignmentId={assignmentId}
              testTitle={testTitle}
              studentName={studentName}
              endedMessage={
                guardMessage ||
                (finishedEarly || openedOnUpload
                  ? null
                  : "Time is up. The question paper has been closed.")
              }
            />
          )}
        </div>
      ) : !opened ? (
        <div className="space-y-4">
          {/* A reload lands here with the attempt already running. The clock is
              shown before they re-open the paper, not after, so the time they
              have left is never hidden behind a button press. */}
          {countdown}

          <Button
            id="start-assessment-btn"
            onClick={handleOpen}
            disabled={loading}
            size="lg"
            className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white font-medium py-3 px-6 shadow-md transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <AtomMark size={20} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                <span>Verifying &amp; Opening&hellip;</span>
              </div>
            ) : (
              <>
                <span>
                  {deadlineMs !== null ? `Return to ${paperNoun}` : `View ${paperNoun}`}
                </span>
                <ExternalLink className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* The clock lives above the paper, and travels inside the overlay
              when the paper goes full screen so it never leaves the student's
              sight. */}
          {!expanded && countdown}

          {/* In-page preview */}
          {embedUrl && (
            <div
              ref={previewRef}
              className={
                expanded
                  ? "fixed inset-0 z-50 flex h-[100dvh] flex-col bg-white"
                  : "overflow-hidden rounded-xl border border-brand-border bg-white shadow-card"
              }
            >
              <div className="flex items-center justify-between gap-2 border-b border-brand-border bg-brand-page px-3 py-2">
                <span className="truncate text-[11px] font-semibold text-brand-navy">
                  {isDoc ? "Question paper" : "Assessment form"}
                  {expanded && <span className="ml-2 font-normal text-brand-ink/60">Press Esc to exit</span>}
                </span>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={expanded ? collapse : expand}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-blue hover:underline"
                  >
                    {expanded ? (
                      <>
                        <Minimize2 className="h-3 w-3" />
                        Exit full screen
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3 w-3" />
                        Full screen
                      </>
                    )}
                  </button>

                  {expanded && (
                    <button
                      type="button"
                      onClick={collapse}
                      aria-label="Close full screen"
                      className="rounded p-1 text-brand-ink/70 transition-colors hover:bg-brand-tint hover:text-brand-navy"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {expanded && countdown && (
                <div className="border-b border-brand-border bg-brand-page px-3 py-2">
                  {countdown}
                </div>
              )}

              <iframe
                src={embedUrl}
                title={isDoc ? "Question paper" : "Assessment form"}
                // dvh, not vh: on mobile Safari `vh` counts the space behind
                // the URL bar, so a 70vh frame ran off the bottom of the screen.
                className={expanded ? "flex-1 w-full border-0" : "h-[60dvh] w-full border-0 sm:h-[70vh]"}
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          )}

          <div className="p-4 bg-sky-50 text-sky-950 border border-sky-200 rounded-xl flex items-start gap-3 text-left">
            <ShieldAlert className="h-5 w-5 shrink-0 text-brand-blue mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-brand-navy">
                {isDoc ? "Written paper" : "Assessment opened"}
              </p>
              <p className="text-brand-ink/80">
                {isDoc
                  ? "Write your answers on paper. When you finish, or when the time runs out, the paper closes and you upload photos of your answer sheets."
                  : "Answer every question and press Submit inside the form. When you finish, or when the time runs out, the paper closes and you upload photos of your answer sheets."}
              </p>
            </div>
          </div>

          {confirmingFinish ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
              <p className="text-xs font-medium text-emerald-950">
                {isDoc
                  ? "Finish now? The question paper will close and you cannot open it again."
                  : "Have you pressed Submit inside the form? Finishing closes the paper and you cannot open it again."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmingFinish(false)}>
                  Keep working
                </Button>
                <Button
                  type="button"
                  onClick={handleFinish}
                  className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                >
                  Yes, finish
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setConfirmingFinish(true)}
              disabled={submitting}
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 shadow-md transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={20} strokeColor="#FFFFFF" dotColor="#A7F3D0" animate />
                  <span>Finishing&hellip;</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>I&apos;ve Finished &mdash; Upload My Answers</span>
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
