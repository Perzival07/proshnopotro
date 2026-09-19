"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  enterFullscreen,
  exitFullscreen,
  isNativeFullscreen,
} from "@/lib/fullscreen";
import { Maximize2, Minimize2, X } from "lucide-react";

/**
 * Full-screen state for an embedded paper or PDF.
 *
 * Native fullscreen hides the browser chrome where it is allowed; the CSS
 * overlay that FullscreenFrame applies covers the cases where it is not
 * (notably iOS Safari). Escape closes it, and leaving native fullscreen
 * (browser UI, F11) keeps the overlay in step rather than stranding it.
 */
export function useFullscreen() {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const collapse = useCallback(() => {
    setExpanded(false);
    if (typeof document !== "undefined") void exitFullscreen(document);
  }, []);

  const expand = useCallback(() => {
    setExpanded(true);
    void enterFullscreen(ref.current);
  }, []);

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

  return { ref, expanded, expand, collapse };
}

export type FullscreenControls = ReturnType<typeof useFullscreen>;

interface FullscreenFrameProps {
  fullscreen: FullscreenControls;
  /** The page to frame. Ignored when `children` are given instead. */
  src?: string;
  /** Content of our own, such as a paper written in the portal. */
  children?: React.ReactNode;
  /** Accessible name of the iframe. */
  title: string;
  /** Shown in the bar above the frame. */
  label: string;
  /** Height of the frame while it sits in the page. */
  collapsedClassName?: string;
  /** Shown under the bar, only while full screen (e.g. the exam clock). */
  toolbar?: React.ReactNode;
  /**
   * Rendered inside the full-screen element, only while full screen. Native
   * fullscreen paints nothing outside that element, so anything that must
   * stay in sight -- the proctoring camera -- has to live in here.
   */
  overlay?: React.ReactNode;
  sandbox?: string;
  allow?: string;
}

export function FullscreenFrame({
  fullscreen,
  src,
  title,
  label,
  // dvh, not vh: on mobile Safari `vh` counts the space behind the URL bar,
  // so a 70vh frame ran off the bottom of the screen.
  collapsedClassName = "h-[60dvh] sm:h-[70vh]",
  toolbar,
  overlay,
  sandbox,
  allow,
  children,
}: FullscreenFrameProps) {
  const { ref, expanded, expand, collapse } = fullscreen;

  return (
    <div
      ref={ref}
      className={
        expanded
          ? "fixed inset-0 z-50 flex h-[100dvh] flex-col bg-white"
          : "overflow-hidden rounded-xl border border-brand-border bg-white shadow-card"
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-brand-border bg-brand-page px-3 py-2">
        <span className="truncate text-[11px] font-semibold text-brand-navy">
          {label}
          {expanded && <span className="ml-2 hidden font-normal text-brand-ink/60 sm:inline">Press Esc to exit</span>}
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

      {expanded && toolbar && (
        <div className="border-b border-brand-border bg-brand-page px-3 py-2">{toolbar}</div>
      )}

      {children ? (
        <div
          aria-label={title}
          className={expanded ? "flex-1 overflow-y-auto bg-brand-page p-3 sm:p-4" : "bg-brand-page p-3 sm:p-4"}
        >
          {children}
        </div>
      ) : (
        <iframe
          src={src}
          title={title}
          className={expanded ? "w-full flex-1 border-0" : `w-full border-0 ${collapsedClassName}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox={sandbox}
          allow={allow}
        />
      )}

      {expanded && overlay}
    </div>
  );
}
