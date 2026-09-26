"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fullscreenElement } from "@/lib/fullscreen";
import {
  CAPTURE_COVER_MS,
  isCaptureKey,
  isPrintOrSaveShortcut,
} from "@/lib/content-guard";
import { ShieldAlert } from "lucide-react";

interface ContentGuardProps {
  /** Only guard while the paper is actually open and unfinished. */
  active: boolean;
}

/**
 * Stops the paper being copied out, saved or printed, and blanks it while a
 * screenshot is being taken.
 *
 * Copy, cut, paste, the right-click menu, drag, text selection and printing are
 * refused outright (selection and printing through the `exam-locked` class in
 * globals.css). Screenshots cannot be refused -- the OS takes them -- so the
 * paper is covered for a moment when the key or chord for one goes down, and
 * the clipboard is overwritten after PrintScreen so the captured image does not
 * survive to be pasted. Best effort by nature: a phone gives the page no signal
 * at all, and keys pressed while focus is inside a cross-origin frame (a Google
 * Form) never reach this page.
 *
 * Answers stay typeable; nothing can be pasted in or copied out.
 */
export function ContentGuard({ active }: ContentGuardProps) {
  const [covered, setCovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cover = useCallback(() => {
    setCovered(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCovered(false), CAPTURE_COVER_MS);
  }, []);

  useEffect(() => {
    if (!active) return;

    const html = document.documentElement;
    html.classList.add("exam-locked");

    const refuse = (e: Event) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      if (isCaptureKey(e)) cover();
      if (isPrintOrSaveShortcut(e)) {
        e.preventDefault();
        cover();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isCaptureKey(e)) return;
      cover();
      // PrintScreen puts the image on the clipboard; replace it.
      void navigator.clipboard?.writeText(" ").catch(() => {});
    };

    // A screenshot tool or the task switcher can grab the page as it hides.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setCovered(true);
      else cover();
    };

    document.addEventListener("copy", refuse);
    document.addEventListener("cut", refuse);
    document.addEventListener("paste", refuse);
    document.addEventListener("contextmenu", refuse);
    document.addEventListener("dragstart", refuse);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeprint", cover);

    return () => {
      html.classList.remove("exam-locked");
      document.removeEventListener("copy", refuse);
      document.removeEventListener("cut", refuse);
      document.removeEventListener("paste", refuse);
      document.removeEventListener("contextmenu", refuse);
      document.removeEventListener("dragstart", refuse);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeprint", cover);
      if (timer.current) clearTimeout(timer.current);
      setCovered(false);
    };
  }, [active, cover]);

  if (!active || !covered) return null;

  // Native fullscreen paints nothing outside the full-screen element, so the
  // cover is placed inside it when the paper is full screen.
  return createPortal(
    <div
      role="alert"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-brand-navy p-6 text-center text-white"
    >
      <ShieldAlert className="h-10 w-10" />
      <p className="max-w-sm text-sm font-semibold">
        Screenshots and copying are disabled during the assessment.
      </p>
    </div>,
    fullscreenElement(document) ?? document.body
  );
}
