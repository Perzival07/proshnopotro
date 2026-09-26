"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/RichText";
import { AnnotationLayer } from "@/components/AnnotationLayer";
import {
  ANNOTATION_COLORS,
  COLOR_HEX,
  hitTest,
  strokePath,
  type Annotation,
  type AnnotationColor,
} from "@/lib/annotations";
import type { QuestionStatus, QuestionType } from "@/lib/marking";
import { deleteAnswerPhotos, saveAnnotations, saveOverallFeedback, saveTotalMarks, saveWrittenMark, setReturned } from "../actions";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eraser,
  ImageOff,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";

export interface MarkingQuestion {
  id: string;
  number: number;
  alternative: boolean;
  choiceGroup: string | null;
  section: string;
  type: QuestionType;
  stem: string;
  solution: string | null;
  max: number;
  status: QuestionStatus;
  marks: number;
  manualMarks: number | null;
  feedback: string;
}

interface Page {
  id: string;
  url: string | null;
  thumb: string | null;
  width: number;
  height: number;
  annotations: Annotation[];
}

interface Props {
  assignment: {
    id: string;
    submitted: boolean;
    studentEmail: string;
    studentName: string | null;
    className: string | null;
    endedAt: string | null;
    feedback: string;
    returnedAt: string | null;
    photosDeletedAt: string | null;
    /** The student's upload is over (done or skipped): photos can be deleted. */
    uploadClosed: boolean;
    result: { score: number; maxScore: number } | null;
  };
  test: { id: string; title: string; subject: string };
  pages: Page[];
  questions: MarkingQuestion[] | null;
  queue: { index: number; total: number; prev: string | null; next: string | null };
}

type Tool = "pen" | "tick" | "cross" | "text" | "eraser";

const fmt = (n: number) => String(Number(n.toFixed(2)));

// ─────────────────────────────────────────────────────────────
// Page viewer with drawing
// ─────────────────────────────────────────────────────────────

function PageMarker({
  page,
  annotations,
  onChange,
  tool,
  color,
  zoom,
}: {
  page: Page;
  annotations: Annotation[];
  onChange: (next: Annotation[]) => void;
  tool: Tool;
  color: AnnotationColor;
  zoom: number;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  const strokeRef = useRef<[number, number][] | null>(null);

  const toImage = (e: React.PointerEvent): [number, number] => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * page.width, ((e.clientY - rect.top) / rect.height) * page.height];
  };
  const unit = Math.max(page.width, page.height);

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const [x, y] = toImage(e);
    if (tool === "pen") {
      (e.target as Element).setPointerCapture(e.pointerId);
      strokeRef.current = [[x, y]];
      setStroke(strokeRef.current);
    } else if (tool === "tick" || tool === "cross") {
      onChange([...annotations, { kind: tool, color, x, y, size: unit * 0.045 }]);
    } else if (tool === "text") {
      const text = window.prompt("Note for the student:");
      if (text && text.trim()) onChange([...annotations, { kind: "text", color, x, y, size: unit * 0.022, text: text.trim() }]);
    } else if (tool === "eraser") {
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTest(annotations[i], x, y, unit * 0.01)) {
          onChange(annotations.filter((_, j) => j !== i));
          break;
        }
      }
    }
  };

  const move = (e: React.PointerEvent) => {
    if (tool !== "pen" || !strokeRef.current) return;
    const [x, y] = toImage(e);
    const [lx, ly] = strokeRef.current[strokeRef.current.length - 1];
    if (Math.hypot(x - lx, y - ly) < unit * 0.002) return;
    strokeRef.current = [...strokeRef.current, [x, y]];
    setStroke(strokeRef.current);
  };

  const up = () => {
    const points = strokeRef.current;
    strokeRef.current = null;
    setStroke(null);
    if (points && points.length > 1) {
      onChange([...annotations, { kind: "pen", color, width: Math.max(2, unit * 0.003), points: points.slice(0, 1500) }]);
    }
  };

  return (
    <div className="overflow-auto rounded-lg border border-brand-border bg-slate-100 p-2" style={{ maxHeight: "calc(100dvh - 220px)" }}>
      <div className="relative mx-auto" style={{ width: `${zoom * 100}%`, aspectRatio: `${page.width} / ${page.height}` }}>
        {page.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.url} alt="Answer page" className="absolute inset-0 h-full w-full select-none" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-ink/60">
            <ImageOff className="mr-2 h-4 w-4" /> Photo unavailable
          </div>
        )}
        <AnnotationLayer annotations={annotations} width={page.width} height={page.height}>
          {stroke && stroke.length > 1 && (
            <path
              d={strokePath(stroke)}
              fill="none"
              stroke={COLOR_HEX[color]}
              strokeWidth={Math.max(2, unit * 0.003)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </AnnotationLayer>
        <div
          ref={overlayRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={`absolute inset-0 touch-none ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Marks for one written answer
// ─────────────────────────────────────────────────────────────

function WrittenMark({
  assignmentId,
  question,
  onSaved,
}: {
  assignmentId: string;
  question: MarkingQuestion;
  onSaved: (id: string, marks: number | null, feedback: string, total?: { score?: number; maxScore?: number }) => void;
}) {
  const [marks, setMarks] = useState(question.manualMarks === null ? "" : String(question.manualMarks));
  const [note, setNote] = useState(question.feedback);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const saved = useRef({ marks: question.manualMarks, note: question.feedback });

  const save = async (nextMarks = marks, nextNote = note) => {
    const value = nextMarks.trim() === "" ? null : Number(nextMarks);
    if (value !== null && !Number.isFinite(value)) {
      setError("Enter a number.");
      return;
    }
    if (value === saved.current.marks && nextNote === saved.current.note) return;
    setState("saving");
    setError(null);
    try {
      const res = await saveWrittenMark(assignmentId, question.id, value, nextNote);
      if (res.error) {
        setError(res.error);
        setState("error");
        return;
      }
      saved.current = { marks: value, note: nextNote };
      setState("saved");
      onSaved(question.id, value, nextNote, { score: res.score, maxScore: res.maxScore });
    } catch {
      setError("Could not reach the server.");
      setState("error");
    }
  };

  const quick = (v: number) => {
    setMarks(String(v));
    void save(String(v));
  };

  return (
    <div className="space-y-2 rounded-lg border border-brand-border bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-brand-navy">
          Q{question.number}
          {question.alternative && <span className="ml-1 text-brand-blue">(OR)</span>}
          <span className="ml-2 font-normal text-brand-ink/60">out of {fmt(question.max)}</span>
        </p>
        <span className="text-[10px]">
          {state === "saving" && <span className="text-brand-ink/50">Saving…</span>}
          {state === "saved" && <span className="text-emerald-700">Saved</span>}
          {question.status === "NOT_COUNTED" && state !== "saving" && (
            <span className="text-amber-700">Other choice counts</span>
          )}
        </span>
      </div>
      <details>
        <summary className="cursor-pointer text-[11px] text-brand-ink/70">Question{question.solution ? " and model answer" : ""}</summary>
        <div className="mt-1 space-y-2 text-xs">
          <RichText text={question.stem} />
          {question.solution && (
            <div className="rounded bg-brand-page p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-brand-ink/60">Model answer</p>
              <RichText text={question.solution} />
            </div>
          )}
        </div>
      </details>
      <div className="flex items-center gap-1.5">
        <Input
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => e.key === "Enter" && void save()}
          inputMode="decimal"
          placeholder="—"
          aria-label={`Marks for question ${question.number}${question.alternative ? " (OR)" : ""}`}
          className="h-8 w-16 text-center text-sm font-semibold"
        />
        <span className="text-xs text-brand-ink/60">/ {fmt(question.max)}</span>
        <div className="ml-auto flex gap-1">
          {[0, question.max / 2, question.max].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => quick(Math.round(v * 2) / 2)}
              className="rounded border border-brand-border px-1.5 py-0.5 text-[11px] font-semibold text-brand-navy hover:bg-brand-tint"
            >
              {fmt(Math.round(v * 2) / 2)}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void save()}
        rows={2}
        placeholder="Comment for the student (optional)"
        className="w-full rounded-md border border-brand-border p-2 text-xs focus-ring"
      />
      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// The workspace
// ─────────────────────────────────────────────────────────────

export function MarkingWorkspace({ assignment, test, pages, questions, queue }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<AnnotationColor>("red");
  const [zoom, setZoom] = useState(1);
  const [marks, setMarks] = useState<Record<string, Annotation[]>>(() =>
    Object.fromEntries(pages.map((p) => [p.id, p.annotations]))
  );
  const history = useRef<Record<string, Annotation[][]>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef(new Map<string, number>());
  // What each page's waiting save will send, so leaving can send it at once.
  const pendingMarks = useRef(new Map<string, Annotation[]>());

  const [items, setItems] = useState(questions ?? []);
  const [total, setTotal] = useState(assignment.result);
  const [feedback, setFeedback] = useState(assignment.feedback);
  const [feedbackState, setFeedbackState] = useState<"idle" | "saving" | "saved">("idle");
  const [returnedAt, setReturnedAt] = useState(assignment.returnedAt);
  // Deleting the photos to free storage: asked twice, once inline.
  const [photosGone, setPhotosGone] = useState(assignment.photosDeletedAt !== null && pages.length === 0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deletePhotos = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await deleteAnswerPhotos(assignment.id);
      if (res.error) setDeleteError(res.error);
      else {
        // Nothing is left to save on the pages that are gone.
        pendingMarks.current.clear();
        timers.current.forEach((t) => window.clearTimeout(t));
        timers.current.clear();
        setPhotosGone(true);
        setConfirmingDelete(false);
      }
    } catch {
      setDeleteError("Could not reach the server. Nothing was deleted.");
    } finally {
      setDeleteBusy(false);
    }
  };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [linkScore, setLinkScore] = useState(assignment.result ? String(assignment.result.score) : "");
  const [linkMax, setLinkMax] = useState(assignment.result ? String(assignment.result.maxScore) : "");

  const page = pages[pageIndex];

  // Marks on a page are saved a moment after the last change to it.
  const persist = useCallback((pageId: string, list: Annotation[]) => {
    const existing = timers.current.get(pageId);
    if (existing) window.clearTimeout(existing);
    setSaveState("saving");
    pendingMarks.current.set(pageId, list);
    timers.current.set(
      pageId,
      window.setTimeout(async () => {
        timers.current.delete(pageId);
        pendingMarks.current.delete(pageId);
        try {
          const res = await saveAnnotations(pageId, list);
          setSaveState(res.error ? "error" : "saved");
        } catch {
          setSaveState("error");
        }
      }, 700)
    );
  }, []);

  const change = (next: Annotation[]) => {
    if (!page) return;
    history.current[page.id] = [...(history.current[page.id] ?? []), marks[page.id] ?? []].slice(-50);
    setMarks((m) => ({ ...m, [page.id]: next }));
    persist(page.id, next);
  };

  const undo = () => {
    if (!page) return;
    const stack = history.current[page.id] ?? [];
    const previous = stack.pop();
    if (previous === undefined) return;
    setMarks((m) => ({ ...m, [page.id]: previous }));
    persist(page.id, previous);
  };

  // Moving on to the next student sends any marks still waiting to save.
  useEffect(() => {
    const waiting = pendingMarks.current;
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      waiting.forEach((list, pageId) => void saveAnnotations(pageId, list));
    };
  }, []);

  const written = items.filter((q) => q.type === "SUBJECTIVE");
  // An internal choice is one question to mark: done once either side is.
  const writtenUnits = new Map<string, boolean>();
  for (const q of written) {
    const unit = q.choiceGroup ?? q.id;
    writtenUnits.set(unit, (writtenUnits.get(unit) ?? false) || q.manualMarks !== null);
  }
  const unmarked = Array.from(writtenUnits.values()).filter((done) => !done).length;

  const onWrittenSaved = (id: string, value: number | null, note: string, t?: { score?: number; maxScore?: number }) => {
    setItems((list) => list.map((q) => (q.id === id ? { ...q, manualMarks: value, feedback: note } : q)));
    if (t?.score !== undefined && t.maxScore !== undefined) setTotal({ score: t.score, maxScore: t.maxScore });
  };

  const saveFeedback = async () => {
    if (feedback === assignment.feedback && feedbackState === "idle") return;
    setFeedbackState("saving");
    try {
      await saveOverallFeedback(assignment.id, feedback);
      setFeedbackState("saved");
    } catch {
      setFeedbackState("idle");
      setMessage("Could not save the feedback.");
    }
  };

  const saveLinkMarks = async () => {
    setMessage(null);
    const res = await saveTotalMarks(assignment.id, Number(linkScore), Number(linkMax));
    if (res.error) setMessage(res.error);
    else setTotal({ score: Number(linkScore), maxScore: Number(linkMax) });
  };

  const toggleReturn = async () => {
    if (!returnedAt) {
      if (questions && unmarked > 0 && !window.confirm(`${unmarked} written ${unmarked === 1 ? "answer is" : "answers are"} not marked yet. Return the copy anyway?`)) {
        return;
      }
      if (!questions && !total && !window.confirm("You have not entered marks yet. Return the copy anyway?")) return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await saveFeedback();
      const res = await setReturned(assignment.id, !returnedAt);
      if (res.error) setMessage(res.error);
      else setReturnedAt(returnedAt ? null : new Date().toISOString());
    } finally {
      setBusy(false);
    }
  };

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "pen", label: "Pen", icon: <Pencil className="h-4 w-4" /> },
    { id: "tick", label: "Tick", icon: <Check className="h-4 w-4" /> },
    { id: "cross", label: "Cross", icon: <X className="h-4 w-4" /> },
    { id: "text", label: "Note", icon: <Type className="h-4 w-4" /> },
    { id: "eraser", label: "Eraser", icon: <Eraser className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/tests/${test.id}/marking`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:text-brand-blue"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All answer sheets
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-lg font-bold text-brand-navy">
            {assignment.studentName || assignment.studentEmail}
          </h1>
          <p className="truncate text-xs text-brand-ink/60">
            {test.title}
            {assignment.className ? ` · ${assignment.className}` : ""} · {assignment.studentEmail}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {total && (
            <span className="rounded-lg bg-brand-tint px-3 py-1.5 font-mono text-sm font-bold text-brand-navy">
              {fmt(total.score)} / {fmt(total.maxScore)}
            </span>
          )}
          {returnedAt ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Returned</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Not returned</span>
          )}
          <span className="text-[11px] text-brand-ink/60">
            {queue.index + 1} of {queue.total}
          </span>
          <Button asChild={!!queue.prev} variant="outline" size="sm" disabled={!queue.prev} className="h-8 w-8 p-0">
            {queue.prev ? (
              <Link href={`/admin/mark/${queue.prev}`} aria-label="Previous student">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
          <Button asChild={!!queue.next} variant="outline" size="sm" disabled={!queue.next} className="h-8 w-8 p-0">
            {queue.next ? (
              <Link href={`/admin/mark/${queue.next}`} aria-label="Next student">
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!assignment.submitted && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          This student has not submitted yet, so there is nothing to mark.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Pages */}
        <div className="min-w-0 space-y-2">
          {photosGone ? (
            <div className="rounded-lg border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/70">
              The answer photos were deleted to free storage. The marks, comments and feedback are kept.
            </div>
          ) : pages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
              No answer photos were uploaded for this attempt.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-brand-border bg-white p-2">
                {tools.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTool(t.id)}
                    aria-pressed={tool === t.id}
                    title={t.label}
                    className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold ${
                      tool === t.id ? "bg-brand-navy text-white" : "text-brand-ink/80 hover:bg-brand-tint"
                    }`}
                  >
                    {t.icon}
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
                <span className="mx-1 h-6 w-px bg-brand-border" />
                {ANNOTATION_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`${c} ink`}
                    aria-pressed={color === c}
                    className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-brand-navy" : "border-white"}`}
                    style={{ background: COLOR_HEX[c] }}
                  />
                ))}
                <span className="mx-1 h-6 w-px bg-brand-border" />
                <button type="button" onClick={undo} title="Undo" className="inline-flex h-8 items-center rounded-md px-2 text-brand-ink/80 hover:bg-brand-tint">
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Clear this page's marks"
                  onClick={() => (marks[page.id]?.length ?? 0) > 0 && window.confirm("Remove every mark on this page?") && change([])}
                  className="inline-flex h-8 items-center rounded-md px-2 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <span className="mx-1 h-6 w-px bg-brand-border" />
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} title="Zoom out" className="inline-flex h-8 items-center rounded-md px-2 hover:bg-brand-tint">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-[11px] text-brand-ink/70">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} title="Zoom in" className="inline-flex h-8 items-center rounded-md px-2 hover:bg-brand-tint">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setZoom(1)} title="Fit width" className="inline-flex h-8 items-center rounded-md px-2 hover:bg-brand-tint">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <span className="ml-auto text-[11px]">
                  {saveState === "saving" && <span className="text-brand-ink/50">Saving marks…</span>}
                  {saveState === "saved" && <span className="text-emerald-700">Marks saved</span>}
                  {saveState === "error" && <span className="font-semibold text-red-700">Marks not saved</span>}
                </span>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPageIndex(i)}
                    className={`relative h-20 w-14 shrink-0 overflow-hidden rounded border-2 bg-white ${
                      i === pageIndex ? "border-brand-blue" : "border-brand-border"
                    }`}
                    aria-label={`Page ${i + 1}`}
                  >
                    {p.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-center text-[10px] font-bold text-white">
                      {i + 1}
                      {(marks[p.id]?.length ?? 0) > 0 ? " ✎" : ""}
                    </span>
                  </button>
                ))}
              </div>

              {page && (
                <PageMarker
                  key={page.id}
                  page={page}
                  annotations={marks[page.id] ?? []}
                  onChange={change}
                  tool={tool}
                  color={color}
                  zoom={zoom}
                />
              )}
            </>
          )}
        </div>

        {/* Marks */}
        <aside className="space-y-3">
          {questions ? (
            <>
              <div className="rounded-lg border border-brand-border bg-white p-3 text-xs">
                <p className="font-semibold text-brand-navy">Marked on screen</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {items
                    .filter((q) => q.type !== "SUBJECTIVE")
                    .map((q) => (
                      <span
                        key={q.id}
                        title={q.status}
                        className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                          q.status === "CORRECT"
                            ? "bg-emerald-100 text-emerald-800"
                            : q.status === "PARTIAL"
                              ? "bg-sky-100 text-sky-800"
                              : q.status === "WRONG"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Q{q.number}
                        {q.alternative ? "′" : ""} {q.marks > 0 ? `+${fmt(q.marks)}` : fmt(q.marks)}
                      </span>
                    ))}
                </div>
                {written.length > 0 && (
                  <p className="mt-2 text-brand-ink/70">
                    {writtenUnits.size - unmarked} of {writtenUnits.size} written {writtenUnits.size === 1 ? "question" : "questions"} marked.
                  </p>
                )}
              </div>
              {written.map((q) => (
                <WrittenMark key={q.id} assignmentId={assignment.id} question={q} onSaved={onWrittenSaved} />
              ))}
            </>
          ) : (
            <div className="space-y-2 rounded-lg border border-brand-border bg-white p-3 text-xs">
              <p className="font-semibold text-brand-navy">Marks</p>
              <div className="flex items-center gap-2">
                <Input value={linkScore} onChange={(e) => setLinkScore(e.target.value)} inputMode="decimal" className="h-8 w-20" aria-label="Marks" />
                <span>out of</span>
                <Input value={linkMax} onChange={(e) => setLinkMax(e.target.value)} inputMode="decimal" className="h-8 w-20" aria-label="Total marks" />
                <Button type="button" size="sm" onClick={saveLinkMarks} className="h-8 bg-brand-navy text-xs text-white">
                  Save
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-brand-border bg-white p-3 text-xs">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-brand-navy">Overall feedback</p>
              {feedbackState === "saved" && <span className="text-[10px] text-emerald-700">Saved</span>}
            </div>
            <textarea
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                setFeedbackState("idle");
              }}
              onBlur={() => void saveFeedback()}
              rows={4}
              placeholder="What went well, and what to work on next"
              className="w-full rounded-md border border-brand-border p-2 focus-ring"
            />
          </div>

          <Button
            type="button"
            disabled={busy || !assignment.submitted}
            onClick={toggleReturn}
            className={`h-10 w-full gap-2 font-semibold ${
              returnedAt ? "border border-brand-border bg-white text-brand-navy hover:bg-brand-tint" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            <Send className="h-4 w-4" />
            {returnedAt ? "Take back to keep marking" : "Return to student"}
          </Button>
          <p className="text-[11px] leading-snug text-brand-ink/60">
            {returnedAt
              ? "The student can see the marked pages, your marks and comments."
              : "Until you return it, the student sees their written answers as awaiting marking."}
            {queue.next && (
              <>
                {" "}
                <Link href={`/admin/mark/${queue.next}`} className="font-semibold text-brand-blue hover:underline">
                  Next student →
                </Link>
              </>
            )}
          </p>
          {message && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{message}</p>}

          {pages.length > 0 && !photosGone && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-white p-3 text-xs">
              <p className="font-semibold text-red-800">Free up storage</p>
              {!assignment.uploadClosed ? (
                <p className="text-brand-ink/70">The student&apos;s upload is still open. You can delete the photos once it has closed.</p>
              ) : !confirmingDelete ? (
                <>
                  <p className="text-brand-ink/70">
                    Delete this student&apos;s {pages.length} answer {pages.length === 1 ? "photo" : "photos"} when you no longer need them.
                    Marks, comments and feedback stay.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(true)} className="h-8 gap-1.5 border-red-300 text-xs text-red-700 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete answer photos
                  </Button>
                </>
              ) : (
                <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-2.5 text-red-900">
                  <p className="font-semibold">Delete {pages.length} {pages.length === 1 ? "photo" : "photos"} for good?</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>The photos and everything you drew on them are removed and cannot be brought back.</li>
                    {!returnedAt && <li className="font-semibold">You have not returned this copy yet, so the student will never see their marked pages.</li>}
                    {returnedAt && <li>The student will no longer see their marked pages; they keep their marks and your comments.</li>}
                  </ul>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={deleteBusy} onClick={deletePhotos} className="h-8 bg-red-600 text-xs font-semibold text-white hover:bg-red-700">
                      {deleteBusy ? "Deleting\u2026" : "Yes, delete them"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={deleteBusy} onClick={() => setConfirmingDelete(false)} className="h-8 text-xs">
                      Keep them
                    </Button>
                  </div>
                </div>
              )}
              {deleteError && <p className="text-red-700">{deleteError}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
