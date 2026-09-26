"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { resolveSecureFormUrl, markStudentSubmission, type StudentPaper } from "./actions";
import { ExamPaper, type ExamPaperHandle } from "@/components/student/ExamPaper";
import { exitFullscreen } from "@/lib/fullscreen";
import { isWrittenPaper, type TestFormat } from "@/lib/test-resource";
import { ExamCountdown } from "@/components/student/ExamCountdown";
import { TabGuard } from "@/components/student/TabGuard";
import { ContentGuard } from "@/components/student/ContentGuard";
import { AnswerUploadPanel } from "@/components/student/AnswerUploadPanel";
import { FullscreenFrame, useFullscreen } from "@/components/student/FullscreenFrame";
import {
  ProctorCameraBadge,
  useProctorCamera,
} from "@/components/student/ProctorCamera";
import { FaceScan } from "@/components/student/FaceScan";
import {
  ProctorFlagBanner,
  useProctorDetection,
} from "@/components/student/ProctorDetection";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  ExternalLink,
  AlertCircle,
  TimerOff,
  ShieldAlert,
  CheckCircle2,
  Video,
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
  /** Whether answer sheets are photographed after the paper. */
  answerSheets?: boolean;
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
  answerSheets = true,
  initialPhase = "exam",
}: StartTestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  // Resolved only after the server has authorised this student, so the link
  // still never appears in the page's initial HTML.
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  // A paper written in the portal, in place of a link.
  const [paper, setPaper] = useState<StudentPaper | null>(null);
  const [progress, setProgress] = useState({ answered: 0, total: 0 });
  // Each section's window on this browser's clock, for a paper timed per section.
  const [windows, setWindows] = useState<{ id: string; opensAtMs: number; closesAtMs: number }[] | null>(null);
  const examRef = useRef<ExamPaperHandle>(null);
  const onProgress = useCallback((answered: number, total: number) => setProgress({ answered, total }), []);
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
  // A proctored paper asks for the camera every time it is opened, before the
  // browser does. The browser remembers an earlier "Allow" and stays silent,
  // so without this step a returning student would never be asked at all.
  const [askingCamera, setAskingCamera] = useState(false);
  // Then a face scan, every time, before the paper is asked for: the attempt's
  // clock starts when the paper resolves, so the check has to come first. The
  // paper opens only once one clear face has been steady in view.
  const [scanning, setScanning] = useState(false);
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

  // Reads the same stream, on this device only, for a missing face, a second
  // face or a phone. The first flag of a kind warns; the second ends the
  // attempt. No frame is kept -- only the counts.
  const detection = useProctorDetection(
    assignmentId,
    camera.stream,
    cameraActive && camera.status === "on",
    handleGuardSubmitted
  );

  // A Google Doc or a Drive PDF: read on screen, answered on paper.
  const isDoc = isWrittenPaper(testFormat);
  const isQuestions = testFormat === "QUESTIONS";
  const paperNoun = isDoc || isQuestions ? "Question Paper" : "Google Form";

  const handleOpenClick = () => {
    if (proctored) {
      setAskingCamera(true);
      return;
    }
    void handleOpen();
  };

  // "Allow camera" turns the camera on and hands over to the face scan; the
  // paper is not requested until the scan passes.
  const handleAllowCamera = async () => {
    setAskingCamera(false);
    setScanning(true);
    await camera.start();
  };

  const handleScanPassed = () => {
    setScanning(false);
    void handleOpen();
  };

  const handleScanCancel = () => {
    setScanning(false);
    camera.stop();
  };

  const handleOpen = async () => {
    setAskingCamera(false);
    setLoading(true);
    setError(null);

    // Already on for a proctored paper, from the face scan that had to pass
    // to get here; this only covers the camera having dropped since. The
    // permission prompt was raised on the student's own click, not in an
    // effect over the paper, where it would be dismissed unread.
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
    if (res.error || (!res.embedUrl && !res.paper)) {
      camera.stop();
      setError(res.error || "Could not load the question paper.");
      return;
    }

    setEmbedUrl(res.embedUrl ?? null);
    setPaper(res.paper ?? null);
    if (res.paper?.windows && res.serverNow) {
      const skew = Date.now() - Date.parse(res.serverNow);
      setWindows(
        res.paper.windows.map((w) => ({
          id: w.id,
          opensAtMs: Date.parse(w.opensAt) + skew,
          closesAtMs: Date.parse(w.closesAt) + skew,
        }))
      );
    }
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

    collapse();
    setSubmitting(true);
    // Answers given in the last seconds are still on their way; they go
    // first, while the paper is still on screen, then the attempt closes.
    await examRef.current?.flush();
    setTimeUp(true);
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
      detection={detection.status}
      faces={detection.faces}
      onRetry={() => void camera.start()}
    />
  ) : null;

  const handleFinish = async () => {
    setConfirmingFinish(false);
    setSubmitting(true);
    setError(null);
    try {
      await examRef.current?.flush();
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

      {proctored && <ContentGuard active={opened && !timeUp} />}

      {proctored && cameraActive && (
        <ProctorFlagBanner flag={detection.flag} onDismiss={detection.dismiss} />
      )}

      {/* Native full screen paints only the paper's own element, so while
          the paper is full screen the badge moves inside it (see below). */}
      {!expanded && cameraBadge}

      {askingCamera && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/70 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="camera-permission-title"
            className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 text-left shadow-xl"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-navy">
                <Video className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h2
                  id="camera-permission-title"
                  className="font-heading text-base font-bold text-brand-navy"
                >
                  Allow your camera
                </h2>
                <p className="text-xs leading-relaxed text-brand-ink/80">
                  This test is camera-proctored. Your camera turns on now for a quick
                  face check &mdash; the paper opens, and your time starts, only once
                  it sees you. The camera then stays on until you finish; you will see
                  yourself in the corner of the screen. The camera also watches for a phone, for more than
                  one person in view (3 minutes), and for your face being out of view
                  (5 minutes). The first time any of these happens you get a warning; the
                  second time, your test is submitted automatically, and your tutor is
                  told either way. This check runs on your device &mdash; no video is
                  saved or sent anywhere.
                </p>
                <p className="text-xs leading-relaxed text-brand-ink/80">
                  If your browser asks, choose <strong>Allow this time</strong>.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setAskingCamera(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleAllowCamera()}
                className="bg-brand-navy font-semibold text-white hover:bg-brand-navy/90"
              >
                Allow camera
              </Button>
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <FaceScan
          stream={camera.stream}
          cameraStatus={camera.status}
          cameraError={camera.error}
          onRetryCamera={() => void camera.start()}
          onPassed={handleScanPassed}
          onCancel={handleScanCancel}
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
                  : isQuestions && !answerSheets
                    ? "The question paper is closed and your answers are submitted."
                    : "The question paper is closed. Upload photos of your answers, or finish without uploading."}
              </p>
            </div>
          </div>

          {/* The paper is gone; the upload pop-up is the only way forward.
              Held back until the close-out has landed, so the server is
              already treating the attempt as ended when it is asked. An
              objective paper has nothing to photograph: closing it reloads
              this page onto the student's result instead. */}
          {!submitting && isQuestions && !answerSheets && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-border bg-white p-4 text-xs text-brand-ink/80">
              <AtomMark size={18} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
              <span>Your answers are submitted. Loading your result&hellip;</span>
            </div>
          )}
          {!submitting && !(isQuestions && !answerSheets) && (
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
            onClick={handleOpenClick}
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
                <span>View {paperNoun}</span>
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

          {paper && (
            <FullscreenFrame
              fullscreen={fullscreen}
              title="Question paper"
              label={`${testTitle} \u00b7 ${progress.answered}/${progress.total} answered`}
              toolbar={
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">{countdown}</div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      collapse();
                      setConfirmingFinish(true);
                    }}
                    className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Submit
                  </Button>
                </div>
              }
              overlay={cameraBadge}
            >
              <ExamPaper
                ref={examRef}
                assignmentId={assignmentId}
                paper={paper}
                onProgress={onProgress}
                onEnded={() => void handleExpire()}
                cameraBadge={cameraActive}
                windows={windows}
              />
            </FullscreenFrame>
          )}

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
                {isQuestions ? "Your answers save as you go" : isDoc ? "Written paper" : "Assessment opened"}
              </p>
              <p className="text-brand-ink/80">
                {isQuestions
                  ? answerSheets
                    ? "Answer the questions here, and write the rest on paper. When you submit, or when the time runs out, the paper closes and you upload photos of your written answers."
                    : "Every answer is saved the moment you give it. Press Submit when you are done; when the time runs out, your answers are submitted automatically."
                  : isDoc
                  ? "Write your answers on paper. When you finish, or when the time runs out, the paper closes and you upload photos of your answer sheets."
                  : "Answer every question and press Submit inside the form. When you finish, or when the time runs out, the paper closes and you upload photos of your answer sheets."}
              </p>
            </div>
          </div>

          {confirmingFinish ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
              <p className="text-xs font-medium text-emerald-950">
                {isQuestions
                  ? `Submit now? You have answered ${progress.answered} of ${progress.total} questions. You cannot change your answers afterwards.`
                  : isDoc
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
                  {isQuestions ? "Yes, submit" : "Yes, finish"}
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
                  <span>
                    {isQuestions
                      ? answerSheets
                        ? "Submit \u2014 Then Upload Written Answers"
                        : "Submit Test"
                      : "I\u2019ve Finished \u2014 Upload My Answers"}
                  </span>
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
