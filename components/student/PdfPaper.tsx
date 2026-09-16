"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { loadPdfJs } from "@/lib/pdfjs";
import { AtomMark } from "@/components/brand/AtomMark";
import { AlertCircle, Minus, Plus } from "lucide-react";

interface PdfPaperProps {
  /** Signed link to the paper, resolved by the server for this attempt. */
  url: string;
  title: string;
  className?: string;
}

const ZOOMS = [1, 1.5, 2, 3];

/**
 * Longest canvas edge drawn, in device pixels. iOS Safari silently blanks a
 * canvas past about 16 megapixels, which a zoomed A4 page on a retina screen
 * would otherwise exceed.
 */
const MAX_CANVAS_EDGE = 4000;

type PdfDocument = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfJs>>["getDocument"]>["promise"]>;

/**
 * Shows an uploaded question paper inside the page, drawn page by page with
 * pdf.js.
 *
 * An iframe onto the PDF would be simpler, but phone browsers do not show PDFs
 * inside a page -- Android Chrome downloads them instead -- which would take
 * the student out of the portal, and out of the tab the guard is watching.
 * Drawing it also leaves no download button in reach.
 */
export function PdfPaper({ url, title, className }: PdfPaperProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);

  // Load the document once per link.
  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocument | null = null;
    setDoc(null);
    setError(null);

    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url }).promise)
      .then((d) => {
        loaded = d;
        if (cancelled) void d.destroy();
        else setDoc(d);
      })
      .catch((err) => {
        console.error("Could not load the question paper:", err);
        if (!cancelled) {
          setError("The question paper could not be loaded. Check your connection and reload the page.");
        }
      });

    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
    };
  }, [url]);

  // Pages fit the width available, which changes with full screen and rotation.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(
    async (isStale: () => boolean) => {
      const host = pagesRef.current;
      if (!doc || !host || width <= 0) return;

      const cssWidth = Math.max(200, (width - 16) * ZOOMS[zoomIndex]);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);

      // Build every page's box first, so the scroll height is right from the
      // start and the student can see how long the paper is.
      const canvases: HTMLCanvasElement[] = [];
      host.replaceChildren();
      for (let n = 1; n <= doc.numPages; n++) {
        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-label", `${title}, page ${n} of ${doc.numPages}`);
        canvas.className = "mx-auto block bg-white shadow-sm";
        canvas.style.width = `${cssWidth}px`;
        host.appendChild(canvas);
        canvases.push(canvas);
      }

      for (let n = 1; n <= doc.numPages; n++) {
        if (isStale()) return;
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const canvas = canvases[n - 1];
        canvas.style.height = `${(cssWidth * base.height) / base.width}px`;

        let scale = (cssWidth * ratio) / base.width;
        scale = Math.min(scale, MAX_CANVAS_EDGE / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        if (isStale()) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise.catch(() => {});
        page.cleanup();
      }
    },
    [doc, width, zoomIndex, title]
  );

  useEffect(() => {
    let stale = false;
    void draw(() => stale);
    return () => {
      stale = true;
    };
  }, [draw]);

  return (
    <div className={`relative flex flex-col bg-slate-100 ${className ?? ""}`}>
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto overscroll-contain p-2"
        // Nothing to save here: the paper stays in the portal.
        onContextMenu={(e) => e.preventDefault()}
      >
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        ) : !doc ? (
          <div className="flex h-full min-h-40 items-center justify-center gap-2 text-xs text-brand-ink/60">
            <AtomMark size={18} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
            <span>Loading the question paper&hellip;</span>
          </div>
        ) : null}
        <div ref={pagesRef} className="flex w-max min-w-full flex-col gap-2 select-none" />
      </div>

      {doc && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-brand-border bg-white/95 p-1 shadow-md">
          <button
            type="button"
            onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-navy hover:bg-brand-tint disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-[11px] font-medium text-brand-ink/70">
            {Math.round(ZOOMS[zoomIndex] * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomIndex((z) => Math.min(ZOOMS.length - 1, z + 1))}
            disabled={zoomIndex === ZOOMS.length - 1}
            aria-label="Zoom in"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-navy hover:bg-brand-tint disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
