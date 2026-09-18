"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { resolveSecureFormUrl, markStudentSubmission } from "./actions";
import { exitFullscreen } from "@/lib/fullscreen";
import { isWrittenPaper, type TestFormat } from "@/lib/test-resource";
import { ExamCountdown } from "@/components/student/ExamCountdown";
import { TabGuard } from "@/components/student/TabGuard";
import { AnswerUploadPanel } from "@/components/student/AnswerUploadPanel";
import { FullscreenFrame, useFullscreen } from "@/components/student/FullscreenFrame";
import {
  ProctorCameraBadge,
  useProctorCamera,
} from "@/components/student/ProctorCamera";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  ExternalLink,
  AlertCircle,
  TimerOff,
  ShieldAlert,
  CheckCircle2,
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
  const fullscreen = useFullscreen();
  const { expanded, collapse } = fullscreen;

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

  // The camera is on for exactly as long as the paper is: opened, proctored,
  // not yet finished. Nothing it sees is captured or sent anywhere -- it is
  // shown back to the student so that being watched is visible rather than
  // claimed.
  const cameraActive = proctored && opened && !timeUp;
  const camera = useProctorCamera(cameraActive);

  const handleGuardSubmitted = useCallback((message: string) => {
    setGuardMessage(message);
    setTimeUp(true);
    if (typeof document !== "undefined") void exitFullscreen(document);
  }, []);

  // A Google Doc or a Drive PDF: read on screen, answered on paper.
  const isDoc = isWrittenPaper(testFormat);
  const paperNoun = isDoc ? "Question Paper" : "Google Form";

  const handleOpen = async () => {
    setLoading(true);
    setError(null);

    // Asked for here, on the student's own click, rather than in an effect
    // once the paper is up: a permission prompt that appears out of nowhere
    // over a question paper is one a student dismisses without reading. A
    // refusal does not block the attempt -- it leaves the badge saying so.
    if (proctored) {
      await camera.start();
    }

    const res = await resolveSecureFormUrl(assignmentId);
    setLoading(false);

    // Both of these leave without opening the paper, so the camera granted a
    // moment ago has to be handed straight back: the badge that explains why
    // it is on is only rendered once the paper is up, and a light burning
    // behind no explanation at all is the one outcome to avoid.
    if (res.ended) {
      // The attempt closed while they were away; go straight to the upload.
      camera.stop();
      setTimeUp(true);
      return;
    }
    if (res.error || !res.embedUrl) {
      camera.stop();
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

  const cameraBadge = cameraActive ? (
    <ProctorCameraBadge
      stream={camera.stream}
      status={camera.status}
      error={camera.error}
      onRetry={() => void camera.start()}
    />
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

      {/* Native full screen paints only the paper's own element, so while
          the paper is full screen the badge moves inside it (see below). */}
      {!expanded && cameraBadge}

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
                  : "The question paper is closed. Upload photos of your answers, or finish without uploading."}
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
            <FullscreenFrame
              fullscreen={fullscreen}
              src={embedUrl}
              title={isDoc ? "Question paper" : "Assessment form"}
              label={isDoc ? "Question paper" : "Assessment form"}
              toolbar={countdown}
              overlay={cameraBadge}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
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
