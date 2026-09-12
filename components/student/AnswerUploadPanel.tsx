"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  getAnswerUploadSignature,
  getAnswerUploadStatus,
  saveAnswerUploads,
  type UploadedPage,
} from "@/app/test/[assignmentId]/actions";
import { formatRemaining } from "@/lib/exam-timer";
import { MAX_ANSWER_IMAGES } from "@/lib/answer-upload";
import { shrinkImage } from "@/lib/shrink-image";
import { buildWhatsAppLink, TUTOR_WHATSAPP, workDoneMessage } from "@/lib/whatsapp";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  MessageCircle,
  TimerOff,
  Trash2,
  UploadCloud,
} from "lucide-react";

interface AnswerUploadPanelProps {
  assignmentId: string;
  testTitle: string;
  studentName?: string | null;
  /** Why the paper closed, shown at the top so the student knows it has ended. */
  endedMessage?: string | null;
}

interface Page {
  id: string;
  blob: Blob;
  previewUrl: string;
}

type Phase =
  | "loading"
  | "capture"
  | "confirm"
  | "uploading"
  | "done"
  | "expired"
  | "error";

/**
 * The step after the exam: photograph the answer sheets and upload them, once.
 *
 * Shown as a pop-up over the page that cannot be dismissed while the upload is
 * open -- the paper behind it is already gone. Photos are shrunk on the phone
 * before they leave it, then sent straight to Cloudinary with a signature the
 * server issues; only when every page has arrived is the set saved, and that
 * save is the one-time step. A failure before it leaves the student free to
 * try again.
 */
export function AnswerUploadPanel({
  assignmentId,
  testTitle,
  studentName,
  endedMessage,
}: AnswerUploadPanelProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [pages, setPages] = useState<Page[]>([]);
  const [processing, setProcessing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [savedCount, setSavedCount] = useState(0);
  const [closesAtMs, setClosesAtMs] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<Page[]>([]);
  pagesRef.current = pages;

  // Object URLs hold the photo in memory until revoked.
  useEffect(
    () => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)),
    []
  );

  const loadStatus = useCallback(async () => {
    try {
      const res = await getAnswerUploadStatus(assignmentId);
      if (res.error || !res.state) {
        setFatal(res.error || "Could not check your upload.");
        setPhase("error");
        return;
      }
      if (res.state === "UPLOADED") {
        setSavedCount(res.pageCount ?? 0);
        setPhase("done");
        return;
      }
      if (res.state === "EXPIRED") {
        setPhase("expired");
        return;
      }
      if (res.state === "NOT_ENDED") {
        // The close-out may still be landing; ask again shortly.
        window.setTimeout(loadStatus, 1500);
        return;
      }
      if (res.closesAt && res.serverNow) {
        setClosesAtMs(Date.parse(res.closesAt) + (Date.now() - Date.parse(res.serverNow)));
      }
      setPhase((p) => (p === "loading" ? "capture" : p));
    } catch {
      setFatal("Could not reach the server. Check your internet and reload this page.");
      setPhase("error");
    }
  }, [assignmentId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // The upload window's countdown. Display only; the server enforces it.
  useEffect(() => {
    if (closesAtMs === null) return;
    const tick = () => setRemaining(Math.max(0, closesAtMs - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [closesAtMs]);

  const windowOver =
    remaining !== null && remaining <= 0 && (phase === "capture" || phase === "confirm");

  useEffect(() => {
    if (windowOver) setPhase("expired");
  }, [windowOver]);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const files = Array.from(fileList);
    const room = MAX_ANSWER_IMAGES - pagesRef.current.length - processing;
    if (room <= 0) {
      setError(`You can upload at most ${MAX_ANSWER_IMAGES} pages.`);
      return;
    }
    const accepted = files.slice(0, room);
    if (accepted.length < files.length) {
      setError(`Only ${MAX_ANSWER_IMAGES} pages fit in one upload; the extra photos were left out.`);
    }

    setProcessing((n) => n + accepted.length);
    for (const file of accepted) {
      try {
        const blob = await shrinkImage(file);
        const page: Page = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          blob,
          previewUrl: URL.createObjectURL(blob),
        };
        setPages((prev) => [...prev, page]);
      } catch (err) {
        setError(
          err instanceof Error
            ? `${file.name || "A photo"}: ${err.message}`
            : "One photo could not be added."
        );
      } finally {
        setProcessing((n) => n - 1);
      }
    }
  };

  const removePage = (id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const upload = async () => {
    setError(null);
    setPhase("uploading");
    setProgress({ done: 0, total: pages.length });

    try {
      const signed = await getAnswerUploadSignature(assignmentId);
      if (signed.error || !signed.upload) {
        setError(signed.error || "Could not start the upload.");
        await loadStatus();
        setPhase((p) => (p === "uploading" ? "capture" : p));
        return;
      }
      const sig = signed.upload;

      const uploaded: UploadedPage[] = [];
      for (let i = 0; i < pages.length; i++) {
        const form = new FormData();
        form.append("file", pages[i].blob, `page-${i + 1}.jpg`);
        form.append("api_key", sig.apiKey);
        form.append("timestamp", String(sig.timestamp));
        form.append("signature", sig.signature);
        form.append("folder", sig.folder);
        form.append("type", sig.type);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
          { method: "POST", body: form }
        );
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.public_id) {
          throw new Error(body?.error?.message || `Page ${i + 1} did not upload.`);
        }
        uploaded.push({
          publicId: body.public_id,
          version: body.version,
          format: body.format,
          width: body.width,
          height: body.height,
          bytes: body.bytes,
        });
        setProgress({ done: i + 1, total: pages.length });
      }

      const saved = await saveAnswerUploads(assignmentId, uploaded);
      if (saved.error) {
        setError(saved.error);
        await loadStatus();
        setPhase((p) => (p === "uploading" ? "capture" : p));
        return;
      }

      setSavedCount(saved.pageCount ?? uploaded.length);
      setPhase("done");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(
        "The upload stopped part way, so nothing was saved. Check your internet and press Upload again."
      );
      setPhase("capture");
    }
  };

  const whatsappHref = buildWhatsAppLink(TUTOR_WHATSAPP, workDoneMessage(testTitle, studentName));
  const busy = processing > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-brand-navy/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="answer-upload-title"
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[90dvh] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="border-b border-brand-border bg-brand-page px-5 py-4">
          <h2 id="answer-upload-title" className="font-heading text-base font-bold text-brand-navy">
            {phase === "done" ? "Answers uploaded" : "Upload your answers"}
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-brand-ink/60">{testTitle}</p>
          {endedMessage && phase !== "done" && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-red-700">
              <TimerOff className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{endedMessage}</span>
            </p>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="mt-px h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {phase === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-brand-ink/70">
              <AtomMark size={20} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
              <span>Getting your upload ready&hellip;</span>
            </div>
          )}

          {phase === "error" && (
            <p className="py-6 text-center text-xs text-red-800">{fatal}</p>
          )}

          {phase === "expired" && (
            <div className="space-y-2 py-6 text-center">
              <TimerOff className="mx-auto h-8 w-8 text-red-600" />
              <p className="font-heading text-sm font-semibold text-brand-navy">
                The upload time is over
              </p>
              <p className="text-xs text-brand-ink/70">
                Answers can no longer be uploaded for this test. Please contact your tutor.
              </p>
            </div>
          )}

          {(phase === "capture" || phase === "confirm") && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#F3DCB5] bg-[#FAEEDA] px-3 py-2 text-[#633806]">
                <span className="text-[11px] font-semibold">Upload closes in</span>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {remaining === null ? "--:--" : formatRemaining(remaining)}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-brand-ink/80">
                Take a clear photo of <strong>every page</strong> of your answers, in order.
                You can upload <strong>only once</strong>, so check that all pages are here
                before you press Upload.
              </p>

              {/* Hidden inputs: one opens the camera, one the photo library. */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {phase === "capture" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    disabled={pages.length + processing >= MAX_ANSWER_IMAGES}
                    className="h-11 gap-2 bg-brand-navy text-white hover:bg-brand-navy/90"
                  >
                    <Camera className="h-4 w-4" />
                    {pages.length === 0 ? "Take photo" : "Take next page"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => galleryRef.current?.click()}
                    disabled={pages.length + processing >= MAX_ANSWER_IMAGES}
                    className="h-11 gap-2 border-brand-border text-brand-navy"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Choose from gallery
                  </Button>
                </div>
              )}

              {(pages.length > 0 || busy) && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-brand-navy">
                    {pages.length} of {MAX_ANSWER_IMAGES} pages
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {pages.map((page, index) => (
                      <div
                        key={page.id}
                        className="relative aspect-[3/4] max-w-full overflow-hidden rounded-lg border border-brand-border bg-brand-page"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.previewUrl}
                          alt={`Page ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute left-1 top-1 rounded bg-brand-navy/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                        {phase === "capture" && (
                          <button
                            type="button"
                            onClick={() => removePage(page.id)}
                            aria-label={`Remove page ${index + 1}`}
                            className="absolute right-1 top-1 rounded bg-white/90 p-1.5 text-red-600 shadow-xs"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: processing }).map((_, i) => (
                      <div
                        key={`processing-${i}`}
                        className="flex aspect-[3/4] max-w-full items-center justify-center rounded-lg border border-dashed border-brand-border bg-brand-page"
                      >
                        <AtomMark size={20} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {phase === "uploading" && (
            <div className="space-y-3 py-8 text-center">
              <AtomMark size={32} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
              <p className="font-heading text-sm font-semibold text-brand-navy">
                Uploading page {Math.min(progress.done + 1, progress.total)} of {progress.total}&hellip;
              </p>
              <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-brand-tint">
                <div
                  className="h-full bg-brand-blue transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-brand-ink/60">Keep this page open until it finishes.</p>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4 py-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <div className="space-y-1">
                <p className="font-heading text-sm font-semibold text-brand-navy">
                  {savedCount} {savedCount === 1 ? "page" : "pages"} uploaded
                </p>
                <p className="text-xs text-brand-ink/70">
                  Last step: tell your tutor on WhatsApp that your work is done.
                </p>
              </div>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Send &ldquo;Work done&rdquo; on WhatsApp</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-brand-border bg-white px-5 py-4">
          {phase === "capture" && (
            <Button
              type="button"
              onClick={() => setPhase("confirm")}
              disabled={pages.length === 0 || busy}
              size="lg"
              className="w-full gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              <UploadCloud className="h-5 w-5" />
              {pages.length === 0
                ? "Add your pages to upload"
                : `Upload ${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
            </Button>
          )}

          {phase === "confirm" && (
            <div className="space-y-3">
              <p className="text-center text-xs font-medium text-brand-navy">
                Upload these {pages.length} {pages.length === 1 ? "page" : "pages"}? You cannot
                add or change pages afterwards.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setPhase("capture")}>
                  Go back
                </Button>
                <Button
                  type="button"
                  onClick={upload}
                  className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                >
                  Yes, upload
                </Button>
              </div>
            </div>
          )}

          {(phase === "done" || phase === "expired" || phase === "error") && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              Back to All Assessments
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
