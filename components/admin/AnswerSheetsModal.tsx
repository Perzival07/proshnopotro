"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AtomMark } from "@/components/brand/AtomMark";
import { getAnswerSheets, type AnswerSheetPage } from "@/app/admin/roster/actions";
import { formatDate } from "@/lib/utils";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Images,
  LayoutGrid,
} from "lucide-react";

export interface AnswerSheetsTarget {
  assignmentId: string;
  studentEmail: string;
  studentName?: string | null;
  testTitle: string;
  pageCount: number;
}

interface AnswerSheetsModalProps {
  target: AnswerSheetsTarget | null;
  onClose: () => void;
}

/**
 * The tutor's view of a student's uploaded answer sheets.
 *
 * The photos are private in Cloudinary; the links arrive signed from the
 * server each time this opens, so they are fetched on open rather than baked
 * into the roster page.
 */
export function AnswerSheetsModal({ target, onClose }: AnswerSheetsModalProps) {
  const [pages, setPages] = useState<AnswerSheetPage[] | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setPages(null);
    setError(null);
    setCurrent(null);
    getAnswerSheets(target.assignmentId)
      .then((res) => {
        if (cancelled) return;
        if (res.error) setError(res.error);
        else {
          setPages(res.pages ?? []);
          setUploadedAt(res.uploadedAt ?? null);
        }
      })
      .catch(() => !cancelled && setError("Could not load the answer sheets."));
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Arrow keys page through the full-size view.
  useEffect(() => {
    if (current === null || !pages) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setCurrent((c) => (c === null ? c : Math.min(pages.length - 1, c + 1)));
      if (e.key === "ArrowLeft") setCurrent((c) => (c === null ? c : Math.max(0, c - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, pages]);

  if (!target) return null;

  const page = current !== null && pages ? pages[current] : null;

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[95dvh] max-w-4xl flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 text-brand-navy">
            <Images className="h-5 w-5 text-brand-blue" />
            <DialogTitle>Answer sheets</DialogTitle>
          </div>
          <DialogDescription>
            <strong>{target.studentName || target.studentEmail}</strong> &middot; {target.testTitle}
            {uploadedAt && <> &middot; uploaded {formatDate(uploadedAt)}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!error && pages === null && (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-brand-ink/70">
              <AtomMark size={20} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
              <span>Loading {target.pageCount} pages&hellip;</span>
            </div>
          )}

          {pages && pages.length === 0 && (
            <p className="py-16 text-center text-xs text-brand-ink/60">
              No answer sheets have been uploaded.
            </p>
          )}

          {pages && pages.length > 0 && page === null && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pages.map((p, index) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCurrent(index)}
                  className="group relative aspect-[3/4] max-w-full overflow-hidden rounded-lg border border-brand-border bg-brand-page text-left transition-shadow hover:shadow-card-hover"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl}
                    alt={`Page ${index + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded bg-brand-navy/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Page {index + 1}
                  </span>
                </button>
              ))}
            </div>
          )}

          {pages && page && current !== null && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrent(null)}
                  className="gap-1.5 text-xs"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  All pages
                </Button>
                <span className="text-xs font-semibold text-brand-navy">
                  Page {current + 1} of {pages.length}
                </span>
                <a
                  href={page.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
                >
                  Open original
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex justify-center rounded-lg border border-brand-border bg-brand-page p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.fullUrl}
                  alt={`Page ${current + 1}`}
                  className="max-h-[65dvh] w-auto max-w-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={current === 0}
                  onClick={() => setCurrent(current - 1)}
                  className="gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={current === pages.length - 1}
                  onClick={() => setCurrent(current + 1)}
                  className="gap-1.5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
