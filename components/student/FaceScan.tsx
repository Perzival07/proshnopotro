"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CameraStatus } from "@/lib/proctor-camera";
import { FACE_MODEL, WASM_ROOT } from "@/components/student/ProctorDetection";
import { silenceMediapipeInfo } from "@/lib/mediapipe-log";
import { coverRect, NO_FACES, toFaceBoxes, type FaceSnapshot } from "@/lib/proctor-detect";
import { createScanGate, scanMessage, type ScanResult } from "@/lib/proctor-scan";
import { CheckCircle2, ScanFace, VideoOff } from "lucide-react";

/** Looks per second while scanning; the hold is two seconds, so this is smooth enough. */
const SAMPLE_INTERVAL_MS = 250;
/** How long "Face verified" stays up before the paper opens. */
const PASSED_PAUSE_MS = 700;

type Checker = "loading" | "ready" | "unavailable";

interface FaceScanProps {
  stream: MediaStream | null;
  cameraStatus: CameraStatus;
  cameraError: string | null;
  onRetryCamera: () => void;
  /** One clear face held steady; the paper may open. */
  onPassed: () => void;
  onCancel: () => void;
}

/**
 * The scan that stands between "View paper" and the paper: the student sees
 * themselves, and the paper opens only once exactly one clear face has been
 * steady in view (`lib/proctor-scan.ts`).
 *
 * It runs on the student's device and keeps nothing. If the face model cannot
 * load, the student is offered a way on rather than being locked out of a
 * paper by our checker failing -- the same bargain as the in-exam check. A
 * camera that will not turn on, by contrast, does block: there is nothing to
 * scan, and the paper is one the tutor asked to be proctored.
 */
export function FaceScan({
  stream,
  cameraStatus,
  cameraError,
  onRetryCamera,
  onPassed,
  onCancel,
}: FaceScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [checker, setChecker] = useState<Checker>("loading");
  const [result, setResult] = useState<ScanResult>({ state: "starting", progress: 0 });
  const [snapshot, setSnapshot] = useState<FaceSnapshot>(NO_FACES);
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;

  const live = cameraStatus === "on" && stream !== null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => {});
  }, [stream, live]);

  useEffect(() => {
    if (!live) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let passTimer: ReturnType<typeof setTimeout> | null = null;
    let close: (() => void) | null = null;

    setChecker("loading");
    setResult({ state: "starting", progress: 0 });

    (async () => {
      try {
        silenceMediapipeInfo();
        const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
        const detector = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
        close = () => detector.close();
        if (cancelled) {
          detector.close();
          close = null;
          return;
        }

        setChecker("ready");
        const gate = createScanGate();
        let lastVideoTime = -1;
        let busy = false;

        timer = setInterval(() => {
          const el = videoRef.current;
          if (!el || busy || el.readyState < 2) return;
          // A stalled camera repeats its last frame; that is not a new look.
          if (el.currentTime === lastVideoTime) return;
          lastVideoTime = el.currentTime;

          busy = true;
          try {
            const found = detector.detectForVideo(el, performance.now()).detections;
            const boxes = toFaceBoxes(found, el.videoWidth, el.videoHeight);
            setSnapshot({
              boxes,
              frameAspect: el.videoWidth / el.videoHeight || NO_FACES.frameAspect,
            });
            const next = gate.observe({ faceWidths: boxes.map((b) => b.w) }, Date.now());
            setResult(next);
            if (next.state === "passed" && timer) {
              clearInterval(timer);
              timer = null;
              passTimer = setTimeout(() => {
                if (!cancelled) onPassedRef.current();
              }, PASSED_PAUSE_MS);
            }
          } catch {
            // One bad frame is not worth failing the scan for.
          } finally {
            busy = false;
          }
        }, SAMPLE_INTERVAL_MS);
      } catch {
        if (!cancelled) setChecker("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (passTimer) clearTimeout(passTimer);
      try {
        close?.();
      } catch {
        // Already closed.
      }
    };
  }, [live]);

  const passed = result.state === "passed";
  const good = result.state === "holding" || passed;
  const boxColor = good ? "border-emerald-400" : "border-red-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="face-scan-title"
        className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 text-left shadow-xl"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-navy">
            <ScanFace className="h-5 w-5" />
          </div>
          <h2 id="face-scan-title" className="font-heading text-base font-bold text-brand-navy">
            Face check before you start
          </h2>
        </div>

        <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-brand-navy">
          {live ? (
            <>
              <video
                ref={videoRef}
                muted
                autoPlay
                playsInline
                className="h-full w-full -scale-x-100 object-cover"
              />
              {/* Mirrored with the picture beneath it, so a box sits on its face. */}
              <div className="pointer-events-none absolute inset-0 -scale-x-100" aria-hidden="true">
                {snapshot.boxes.map((box, i) => {
                  const r = coverRect(box, snapshot.frameAspect, 4 / 3);
                  return (
                    <div
                      key={i}
                      className={`absolute rounded-md border-2 transition-all duration-200 ease-out ${boxColor}`}
                      style={{
                        left: `${r.left}%`,
                        top: `${r.top}%`,
                        width: `${r.width}%`,
                        height: `${r.height}%`,
                      }}
                    />
                  );
                })}
              </div>
              {passed && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/40">
                  <CheckCircle2 className="h-14 w-14 text-white drop-shadow" />
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center">
              <VideoOff className="h-7 w-7 text-white/70" />
              <span className="text-xs font-medium text-white/80">
                {cameraStatus === "starting" ? "Starting camera…" : "Camera off"}
              </span>
            </div>
          )}
        </div>

        {live && checker !== "unavailable" && (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(result.progress * 100)}
            aria-label="Face check progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
              style={{ width: `${result.progress * 100}%` }}
            />
          </div>
        )}

        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-xs leading-relaxed ${
            live && !good && result.state !== "starting" ? "font-medium text-red-700" : "text-brand-ink/80"
          }`}
        >
          {!live
            ? cameraError || "Your camera must be on for this test."
            : checker === "unavailable"
              ? "The face check could not start on this device. You can continue without it."
              : checker === "loading"
                ? "Loading the face check…"
                : scanMessage(result.state)}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-brand-ink/60">
          The check runs on your device &mdash; no picture is saved or sent anywhere. Your time
          starts only after it passes.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {!live ? (
            <Button type="button" onClick={onRetryCamera} disabled={cameraStatus === "starting"} className="bg-brand-navy font-semibold text-white hover:bg-brand-navy/90">
              {cameraStatus === "starting" ? "Starting…" : "Turn camera on"}
            </Button>
          ) : checker === "unavailable" ? (
            <Button type="button" onClick={() => onPassedRef.current()} className="bg-brand-navy font-semibold text-white hover:bg-brand-navy/90">
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              disabled
              className="bg-brand-navy font-semibold text-white hover:bg-brand-navy/90"
            >
              {passed ? "Opening…" : "Scanning…"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
