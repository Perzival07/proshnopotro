"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CAMERA_CONSTRAINTS,
  cameraErrorMessage,
  isCameraSupported,
  PROCTOR_NOTICE,
  stopStream,
  type CameraStatus,
} from "@/lib/proctor-camera";
import { Video, VideoOff } from "lucide-react";

/**
 * Owns the exam camera.
 *
 * The stream is opened when the paper opens and released the instant the
 * attempt ends, the tab is closed, or this unmounts. It is handed to a
 * <video> element and nowhere else: nothing here records, snapshots or
 * uploads a single frame, and nothing should ever be added that does.
 */
export function useProctorCamera(enabled: boolean) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // The stream is held in a ref as well as in state so that cleanup can reach
  // the current one without re-running every time React re-renders.
  const streamRef = useRef<MediaStream | null>(null);
  // Guards a second start while the browser's permission prompt is still up:
  // two getUserMedia calls would light two cameras and leak one of them.
  const startingRef = useRef(false);

  const stop = useCallback(() => {
    startingRef.current = false;
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setStatus((current) => (current === "on" || current === "starting" ? "idle" : current));
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current || startingRef.current) return;

    if (typeof navigator === "undefined" || !isCameraSupported(navigator)) {
      setStatus("unsupported");
      setError(
        "This browser cannot open a camera. Your tutor may ask you to take this test in Chrome or Safari."
      );
      return;
    }

    startingRef.current = true;
    setStatus("starting");
    setError(null);

    try {
      const media = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      // The attempt can end while the prompt is still open; in that case the
      // camera we were just granted has to be handed straight back.
      if (!startingRef.current) {
        stopStream(media);
        return;
      }
      streamRef.current = media;
      setStream(media);
      setStatus("on");
    } catch (err) {
      setStatus("blocked");
      setError(cameraErrorMessage(err));
    } finally {
      startingRef.current = false;
    }
  }, []);

  // The attempt ending is the one thing that must always release the camera.
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => () => stop(), [stop]);

  return { status, error, stream, start, stop };
}

interface ProctorCameraBadgeProps {
  stream: MediaStream | null;
  status: CameraStatus;
  error: string | null;
  onRetry: () => void;
}

/**
 * The corner badge: the student's own face, a live dot, and a plain statement
 * of what is being watched.
 *
 * It sits above the full-screen question paper (z-50) but below the tab-switch
 * warning (z-60) and the answer upload (z-70), so it is always visible during
 * the exam and never covers the things that end it.
 */
export function ProctorCameraBadge({
  stream,
  status,
  error,
  onRetry,
}: ProctorCameraBadgeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      // Autoplay can still be refused on a page the student has not touched;
      // there is nothing to recover here beyond not throwing.
      void video.play().catch(() => {});
    }
  }, [stream]);

  const live = status === "on";

  return (
    <div className="fixed bottom-3 right-3 z-[55] w-40 overflow-hidden rounded-xl border border-brand-border bg-white shadow-lg sm:w-44">
      <div className="relative aspect-[4/3] bg-brand-navy">
        {live ? (
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            // Mirrored, like every other self-view: an un-mirrored picture of
            // yourself reads as somebody else's camera pointed at you.
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            <VideoOff className="h-5 w-5 text-white/70" />
            <span className="text-[10px] font-medium text-white/80">
              {status === "starting" ? "Starting camera…" : "Camera off"}
            </span>
          </div>
        )}

        {live && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-[9px] font-bold uppercase tracking-wide text-white">
              Live
            </span>
          </span>
        )}
      </div>

      <div className="space-y-0.5 px-2 py-1.5">
        <p className="flex items-center gap-1 text-[10px] font-semibold text-brand-navy">
          <Video className="h-3 w-3 text-brand-blue" />
          {PROCTOR_NOTICE.camera}
        </p>
        <p className="text-[9px] leading-tight text-brand-ink/60">
          {PROCTOR_NOTICE.screen}
        </p>
      </div>

      {!live && (
        <div className="border-t border-brand-border bg-[#FAEEDA] px-2 py-1.5">
          <p className="text-[9px] leading-tight text-[#633806]">
            {error || "Your camera must be on during this test."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            disabled={status === "starting"}
            className="mt-1 w-full rounded bg-brand-navy px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-brand-navy/90 disabled:opacity-60"
          >
            {status === "starting" ? "Starting…" : "Turn camera on"}
          </button>
        </div>
      )}
    </div>
  );
}
