"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { silenceMediapipeInfo } from "@/lib/mediapipe-log";
import { fullscreenElement } from "@/lib/fullscreen";
import { recordProctorFlag } from "@/app/test/[assignmentId]/actions";
import {
  createTracker,
  detectionMessage,
  hasPhone,
  NO_FACES,
  toFaceBoxes,
  type DetectionKind,
  type FaceSnapshot,
} from "@/lib/proctor-detect";
import { ScanFace, X } from "lucide-react";

/** Where the self-hosted models and WebAssembly runtime are served from. */
const ASSET_ROOT = "/proctor";
export const FACE_MODEL = `${ASSET_ROOT}/blaze_face_short_range.tflite`;
const OBJECT_MODEL = `${ASSET_ROOT}/efficientdet_lite0.tflite`;
export const WASM_ROOT = `${ASSET_ROOT}/wasm`;

/** Two looks a second is plenty: a flag needs seconds of evidence anyway. */
const SAMPLE_INTERVAL_MS = 500;

export type DetectionStatus = "idle" | "loading" | "ready" | "unavailable";

/**
 * Where the latest face boxes live. Detection writes to it twice a second; only
 * the badge subscribes, so a new sample repaints the corner camera and not the
 * whole test page around it.
 */
export interface FaceStore {
  get(): FaceSnapshot;
  set(next: FaceSnapshot): void;
  subscribe(listener: () => void): () => void;
}

function createFaceStore(): FaceStore {
  let current = NO_FACES;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next) {
      current = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const EMPTY_STORE: FaceStore = {
  get: () => NO_FACES,
  set: () => {},
  subscribe: () => () => {},
};

/** The latest face boxes, re-rendering the caller as they change. */
export function useFaceSnapshot(store: FaceStore | undefined): FaceSnapshot {
  const source = store ?? EMPTY_STORE;
  return useSyncExternalStore(source.subscribe, source.get, () => NO_FACES);
}

export interface ProctorFlag {
  kind: DetectionKind;
  message: string;
  /** Distinguishes two flags of the same kind, so the banner re-appears. */
  id: number;
}

/**
 * Watches the exam camera for a missing face, several faces, or a phone.
 *
 * Everything happens in this browser. The stream is shown to a private,
 * off-screen <video>; each sample is read by two on-device models and thrown
 * away. Nothing is drawn to a canvas, recorded or uploaded -- the only thing
 * that leaves is the bare kind of flag, once it has held for several seconds
 * (see `lib/proctor-detect.ts`).
 *
 * If the models cannot load (an old browser, a blocked WebAssembly), status
 * becomes "unavailable" and the attempt carries on unwatched. A student is
 * never locked out of a paper because our checker failed to start.
 */
export function useProctorDetection(
  assignmentId: string,
  stream: MediaStream | null,
  enabled: boolean,
  /** The second flag of a kind ended the attempt; the parent shows the closing panel. */
  onSubmitted: (message: string) => void
) {
  const [status, setStatus] = useState<DetectionStatus>("idle");
  const [flag, setFlag] = useState<ProctorFlag | null>(null);
  const flagId = useRef(0);
  const [faces] = useState(createFaceStore);
  // Held in a ref so a parent re-render never restarts the models.
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;

  const dismiss = useCallback(() => setFlag(null), []);

  useEffect(() => {
    if (!enabled || !stream) {
      setStatus("idle");
      return;
    }

    const faceStore = faces;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let video: HTMLVideoElement | null = null;
    let closers: (() => void)[] = [];

    setStatus("loading");

    (async () => {
      try {
        // Loaded on demand: the runtime is large and only proctored attempts need it.
        silenceMediapipeInfo();
        const { FilesetResolver, FaceDetector, ObjectDetector } = await import(
          "@mediapipe/tasks-vision"
        );
        const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
        const [faceDetector, objectDetector] = await Promise.all([
          FaceDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: FACE_MODEL },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.5,
          }),
          ObjectDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: OBJECT_MODEL },
            runningMode: "VIDEO",
            scoreThreshold: 0.4,
            maxResults: 5,
            categoryAllowlist: ["cell phone"],
          }),
        ]);
        closers = [() => faceDetector.close(), () => objectDetector.close()];
        if (cancelled) {
          closers.forEach((close) => close());
          return;
        }

        // A private element, not the badge's: the badge remounts as the paper
        // enters and leaves full screen, and the loop must not notice.
        video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        // In the document but invisible; some browsers stop decoding a video
        // that is not attached.
        video.style.cssText =
          "position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0";
        video.setAttribute("aria-hidden", "true");
        document.body.appendChild(video);
        await video.play().catch(() => {});
        if (cancelled) return;

        // The server counts and decides. If it cannot be reached the student
        // still gets the warning, but a failed report never ends an attempt.
        const report = async (kind: DetectionKind) => {
          let message = detectionMessage(kind);
          try {
            const res = await recordProctorFlag(assignmentId, kind);
            if (cancelled) return;
            if (res.submitted && res.message) {
              onSubmittedRef.current(res.message);
              return;
            }
            if (res.message) message = res.message;
          } catch {
            // Fall through to the local warning.
          }
          flagId.current += 1;
          setFlag({ kind, message, id: flagId.current });
        };

        const tracker = createTracker();
        let lastVideoTime = -1;
        let busy = false;
        // The object model is the costly one, and a phone must persist for
        // seconds to count, so it looks every other sample and the last answer
        // stands in between.
        let tick = 0;
        let phoneInView = false;

        setStatus("ready");

        timer = setInterval(() => {
          const el = video;
          if (!el || busy || el.readyState < 2) return;
          // A paused or stalled camera repeats its last frame; do not count that as a new look.
          if (el.currentTime === lastVideoTime) return;
          lastVideoTime = el.currentTime;

          busy = true;
          try {
            const now = performance.now();
            const found = faceDetector.detectForVideo(el, now).detections;
            const faceCount = found.length;
            faceStore.set({
              boxes: toFaceBoxes(found, el.videoWidth, el.videoHeight),
              frameAspect: el.videoWidth / el.videoHeight || NO_FACES.frameAspect,
            });
            if (tick++ % 2 === 0) {
              phoneInView = hasPhone(objectDetector.detectForVideo(el, now).detections);
            }
            const phone = phoneInView;

            for (const kind of tracker.observe({ faces: faceCount, phone }, Date.now())) {
              void report(kind);
            }
          } catch {
            // One bad frame is not worth stopping the watch for.
          } finally {
            busy = false;
          }
        }, SAMPLE_INTERVAL_MS);
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      faceStore.set(NO_FACES);
      if (timer) clearInterval(timer);
      if (video) {
        video.pause();
        video.srcObject = null;
        video.remove();
      }
      closers.forEach((close) => {
        try {
          close();
        } catch {
          // Already closed.
        }
      });
    };
  }, [assignmentId, stream, enabled, faces]);

  return { status, flag, dismiss, faces };
}

/**
 * A warning, shown at the top of the screen without covering the paper. A
 * modal would interrupt a student mid-answer over something a model may have
 * got wrong. It stays until dismissed: a second flag ends the attempt, so a
 * warning that faded on its own could be missed entirely.
 */
export function ProctorFlagBanner({
  flag,
  onDismiss,
}: {
  flag: ProctorFlag | null;
  onDismiss: () => void;
}) {
  if (!flag) return null;

  // Native fullscreen paints nothing outside the full-screen element, so a
  // flag raised while the paper is full screen is placed inside it.
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[58] flex justify-center px-3">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left shadow-lg"
      >
        <ScanFace className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <p className="flex-1 text-xs leading-relaxed text-amber-950">{flag.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded p-0.5 text-amber-800 transition-colors hover:bg-amber-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    fullscreenElement(document) ?? document.body
  );
}
