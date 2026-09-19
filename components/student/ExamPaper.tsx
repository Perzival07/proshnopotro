"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import {
  saveQuestionResponse,
  type StudentPaper,
} from "@/app/test/[assignmentId]/actions";
import { isAttempted, type ResponseValue } from "@/lib/marking";
import type { StudentQuestion, StudentSection } from "@/lib/paper";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Eraser,
  LayoutGrid,
} from "lucide-react";

export interface ExamPaperHandle {
  /** Sends every answer not yet saved, and waits (briefly) for them to land. */
  flush(): Promise<void>;
}

interface ExamPaperProps {
  assignmentId: string;
  paper: StudentPaper;
  /** Answered and total, for the "submit" confirmation. */
  onProgress?: (answered: number, total: number) => void;
  /** The server says the attempt is already over. */
  onEnded?: () => void;
  /** Leave room at the bottom for the camera badge, which sits over the page. */
  cameraBadge?: boolean;
}

type SaveState = "saving" | "saved" | "error";

const TYPE_HINT: Record<StudentQuestion["type"], string> = {
  SINGLE: "Choose one answer",
  MULTIPLE: "Choose one or more answers",
  INTEGER: "Type a whole number",
  DECIMAL: "Type a number",
};

function formatMarks(correct: number, wrong: number) {
  return `+${correct}${wrong < 0 ? `, −${Math.abs(wrong)}` : ""}`;
}

/**
 * The question paper for a test written in the portal.
 *
 * Every answer is saved to the server as it is given -- a closed laptop or a
 * dead battery loses nothing already answered -- and the palette shows where
 * the student stands at a glance, as on the NTA exams they are practising for.
 */
export const ExamPaper = forwardRef<ExamPaperHandle, ExamPaperProps>(function ExamPaper(
  { assignmentId, paper, onProgress, onEnded, cameraBadge = false },
  ref
) {
  const flat = useMemo(
    () =>
      paper.sections.flatMap((section) =>
        section.questions.map((question) => ({ question, section }))
      ),
    [paper.sections]
  );
  const passages = useMemo(() => new Map(paper.passages.map((p) => [p.id, p.content])), [paper.passages]);

  const [answers, setAnswers] = useState<Record<string, ResponseValue>>(() =>
    Object.fromEntries(paper.responses.map((r) => [r.questionId, r.value]))
  );
  const [review, setReview] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(paper.responses.map((r) => [r.questionId, r.markedForReview]))
  );
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set([...paper.responses.map((r) => r.questionId), flat[0]?.question.id].filter(Boolean) as string[])
  );
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const reviewRef = useRef(review);
  reviewRef.current = review;

  // ── Saving ────────────────────────────────────────────────
  // The newest unsent answer per question, and which are on their way. Only
  // one request per question is in flight at a time, so an older answer can
  // never land after a newer one and overwrite it.
  const pending = useRef(new Map<string, { value: ResponseValue; review: boolean }>());
  const inflight = useRef(new Set<string>());
  const typingTimers = useRef(new Map<string, number>());
  const retryTimer = useRef<number | null>(null);
  const endedRef = useRef(false);

  const pump = useCallback(
    async (questionId: string) => {
      if (inflight.current.has(questionId) || endedRef.current) return;
      const next = pending.current.get(questionId);
      if (!next) return;
      pending.current.delete(questionId);
      inflight.current.add(questionId);
      setSaveState((s) => ({ ...s, [questionId]: "saving" }));

      let failed = false;
      try {
        const res = await saveQuestionResponse(assignmentId, questionId, next.value, next.review);
        if (res.ended) {
          endedRef.current = true;
          onEnded?.();
        } else if (res.error) {
          // A refusal (the attempt limit, say) is final, and the server kept
          // the question unanswered -- so the screen must show it that way
          // too, not an answer that will never be marked.
          setNotice(res.error);
          setAnswers((a) => ({ ...a, [questionId]: null }));
          failed = true;
        }
      } catch {
        // The network, not a refusal: keep the answer and try again shortly.
        failed = true;
        if (!pending.current.has(questionId)) pending.current.set(questionId, next);
        if (retryTimer.current === null) {
          retryTimer.current = window.setTimeout(() => {
            retryTimer.current = null;
            for (const id of Array.from(pending.current.keys())) void pump(id);
          }, 3000);
        }
      } finally {
        inflight.current.delete(questionId);
        setSaveState((s) => ({ ...s, [questionId]: failed ? "error" : "saved" }));
        if (pending.current.has(questionId)) void pump(questionId);
      }
    },
    [assignmentId, onEnded]
  );

  const queueSave = useCallback(
    (questionId: string, value: ResponseValue, markedForReview: boolean, delayMs = 0) => {
      pending.current.set(questionId, { value, review: markedForReview });
      const existing = typingTimers.current.get(questionId);
      if (existing) window.clearTimeout(existing);
      if (delayMs === 0) {
        typingTimers.current.delete(questionId);
        void pump(questionId);
      } else {
        typingTimers.current.set(
          questionId,
          window.setTimeout(() => {
            typingTimers.current.delete(questionId);
            void pump(questionId);
          }, delayMs)
        );
      }
    },
    [pump]
  );

  useImperativeHandle(
    ref,
    () => ({
      async flush() {
        for (const [id, timer] of Array.from(typingTimers.current.entries())) {
          window.clearTimeout(timer);
          typingTimers.current.delete(id);
        }
        for (const id of Array.from(pending.current.keys())) void pump(id);
        const until = Date.now() + 8000;
        while ((pending.current.size > 0 || inflight.current.size > 0) && Date.now() < until) {
          await new Promise((r) => setTimeout(r, 150));
          for (const id of Array.from(pending.current.keys())) void pump(id);
        }
      },
    }),
    [pump]
  );

  useEffect(
    () => () => {
      typingTimers.current.forEach((t) => window.clearTimeout(t));
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    },
    []
  );

  // ── Progress ──────────────────────────────────────────────
  const answeredCount = flat.filter(({ question }) => isAttempted(answers[question.id])).length;
  useEffect(() => {
    onProgress?.(answeredCount, flat.length);
  }, [answeredCount, flat.length, onProgress]);

  const answeredInSection = (section: StudentSection) =>
    section.questions.filter((q) => isAttempted(answers[q.id])).length;

  // ── Navigation ────────────────────────────────────────────
  const goTo = (index: number) => {
    const bounded = Math.max(0, Math.min(flat.length - 1, index));
    setCurrent(bounded);
    setNotice(null);
    setShowPalette(false);
    const id = flat[bounded]?.question.id;
    if (id) setVisited((v) => (v.has(id) ? v : new Set(v).add(id)));
  };

  if (flat.length === 0) return null;
  const { question, section } = flat[current];
  const value = answers[question.id] ?? null;
  const marked = review[question.id] ?? false;
  const limit = section.attemptLimit;
  const limitReached =
    !!limit && !isAttempted(value) && answeredInSection(section) >= limit;

  const setAnswer = (next: ResponseValue, delayMs = 0) => {
    if (limitReached && isAttempted(next)) {
      setNotice(`You can answer only ${limit} questions in ${section.title}. Clear another answer first.`);
      return;
    }
    setNotice(null);
    setAnswers((a) => ({ ...a, [question.id]: next }));
    queueSave(question.id, next, reviewRef.current[question.id] ?? false, delayMs);
  };

  const toggleOption = (optionId: string) => {
    if (question.type === "SINGLE") {
      setAnswer(value === optionId ? null : optionId);
      return;
    }
    const chosen = new Set(Array.isArray(value) ? value : []);
    if (chosen.has(optionId)) chosen.delete(optionId);
    else chosen.add(optionId);
    setAnswer(chosen.size ? Array.from(chosen).sort() : null);
  };

  const toggleReview = () => {
    const next = !marked;
    setReview((r) => ({ ...r, [question.id]: next }));
    queueSave(question.id, answersRef.current[question.id] ?? null, next);
  };

  const passage = question.passageId ? passages.get(question.passageId) : null;
  const status = saveState[question.id];
  const anyError = Object.values(saveState).includes("error");

  return (
    <div className={`flex flex-col gap-3 lg:flex-row lg:items-start ${cameraBadge ? "pb-48 sm:pb-64" : ""}`}>
      <div className="min-w-0 flex-1 space-y-3">
        {/* Sections */}
        {paper.sections.length > 1 && (
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {paper.sections.map((s) => {
              const first = flat.findIndex((f) => f.section.id === s.id);
              const active = s.id === section.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(first)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-brand-border bg-white text-brand-navy hover:border-brand-blue"
                  }`}
                >
                  {s.title}
                  <span className={`ml-1.5 font-normal ${active ? "text-white/70" : "text-brand-ink/50"}`}>
                    {answeredInSection(s)}/{s.attemptLimit ?? s.questions.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {anyError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <CloudOff className="h-4 w-4 shrink-0" />
            Some answers have not reached the server yet. Check your internet; they will be sent again automatically.
          </div>
        )}

        <div className="rounded-xl border border-brand-border bg-white p-4 shadow-xs sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-brand-border/60 pb-3">
            <span className="font-heading text-base font-bold text-brand-navy">Question {question.number}</span>
            <span className="text-[11px] text-brand-ink/60">{TYPE_HINT[question.type]}</span>
            <span className="font-mono text-[11px] text-brand-ink/60">{formatMarks(question.marks.correct, question.marks.wrong)}</span>
            <span className="ml-auto text-[11px]">
              {status === "saving" && <span className="text-brand-ink/50">Saving&hellip;</span>}
              {status === "saved" && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </span>
              )}
              {status === "error" && <span className="font-semibold text-amber-700">Not saved yet</span>}
            </span>
          </div>

          {current === flat.findIndex((f) => f.section.id === section.id) && section.instructions && (
            <p className="mb-3 whitespace-pre-line rounded-md bg-brand-page p-2.5 text-xs text-brand-ink/80">
              {section.instructions}
            </p>
          )}
          {limit ? (
            <p className="mb-3 text-[11px] font-medium text-brand-blue">
              Answer any {limit} of the {section.questions.length} questions in {section.title}.
            </p>
          ) : null}

          {passage && (
            <div className="mb-4 max-h-72 overflow-y-auto rounded-lg border border-brand-blue/20 bg-brand-tint/40 p-3 text-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-navy">Read the passage</p>
              <RichText text={passage} />
            </div>
          )}

          <RichText text={question.stem} className="text-[15px] text-brand-ink" />

          <div className="mt-4">
            {question.options.length > 0 ? (
              <div className="space-y-2" role={question.type === "SINGLE" ? "radiogroup" : "group"}>
                {question.options.map((option) => {
                  const chosen = Array.isArray(value) ? value.includes(option.id) : value === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role={question.type === "SINGLE" ? "radio" : "checkbox"}
                      aria-checked={chosen}
                      disabled={limitReached && !chosen}
                      onClick={() => toggleOption(option.id)}
                      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        chosen
                          ? "border-brand-blue bg-brand-tint ring-1 ring-brand-blue"
                          : "border-brand-border bg-white hover:border-brand-blue/50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-bold ${
                          question.type === "SINGLE" ? "rounded-full" : "rounded-md"
                        } ${chosen ? "border-brand-navy bg-brand-navy text-white" : "border-brand-border text-brand-navy"}`}
                      >
                        {option.id}
                      </span>
                      <RichText tall text={option.text} className="min-w-0 flex-1" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="max-w-xs">
                <label htmlFor={`answer-${question.id}`} className="mb-1 block text-xs font-semibold text-brand-navy">
                  Your answer
                </label>
                <input
                  id={`answer-${question.id}`}
                  key={question.id}
                  type="text"
                  inputMode={question.type === "INTEGER" ? "numeric" : "decimal"}
                  autoComplete="off"
                  disabled={limitReached}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(question.type === "INTEGER" ? /[^\d-]/g : /[^\d.-]/g, "").slice(0, 20);
                    // Typing is saved once the student pauses, not per keystroke.
                    setAnswer(cleaned === "" ? null : cleaned, 600);
                  }}
                  onBlur={() => {
                    const pendingTimer = typingTimers.current.get(question.id);
                    if (pendingTimer) {
                      window.clearTimeout(pendingTimer);
                      typingTimers.current.delete(question.id);
                      void pump(question.id);
                    }
                  }}
                  placeholder={question.type === "INTEGER" ? "e.g. 42" : "e.g. 2.45"}
                  className="h-11 w-full rounded-lg border border-brand-border px-3 font-mono text-base focus-ring disabled:opacity-50"
                />
              </div>
            )}
          </div>

          {(notice || limitReached) && (
            <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-amber-800">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              {notice ||
                (limit === 1
                  ? `You have already answered a question in ${section.title}. Clear it to answer this one instead.`
                  : `You have answered ${limit} questions in ${section.title}. Clear one to answer this one instead.`)}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-brand-border/60 pt-3">
            <Button type="button" variant="outline" size="sm" disabled={current === 0} onClick={() => goTo(current - 1)} className="h-9 gap-1">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isAttempted(value)}
              onClick={() => setAnswer(null)}
              className="h-9 gap-1"
            >
              <Eraser className="h-4 w-4" /> Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleReview}
              className={`h-9 gap-1 ${marked ? "border-violet-400 bg-violet-50 text-violet-800" : ""}`}
            >
              <Bookmark className={`h-4 w-4 ${marked ? "fill-violet-500 text-violet-600" : ""}`} />
              {marked ? "Marked for review" : "Mark for review"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={current === flat.length - 1}
              onClick={() => goTo(current + 1)}
              className="ml-auto h-9 gap-1 bg-brand-navy text-white hover:bg-brand-navy/90"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPalette((s) => !s)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-border bg-white py-2 text-xs font-semibold text-brand-navy lg:hidden"
        >
          <LayoutGrid className="h-4 w-4" />
          {showPalette ? "Hide" : "Show"} all questions &middot; {answeredCount}/{flat.length} answered
        </button>
      </div>

      <aside
        className={`${showPalette ? "block" : "hidden"} w-full shrink-0 rounded-xl border border-brand-border bg-white p-3 shadow-xs lg:sticky lg:top-2 lg:block lg:w-64`}
      >
        <Palette
          sections={paper.sections}
          flat={flat}
          current={current}
          answers={answers}
          review={review}
          visited={visited}
          onPick={goTo}
        />
      </aside>
    </div>
  );
});

function Palette({
  sections,
  flat,
  current,
  answers,
  review,
  visited,
  onPick,
}: {
  sections: StudentSection[];
  flat: { question: StudentQuestion; section: StudentSection }[];
  current: number;
  answers: Record<string, ResponseValue>;
  review: Record<string, boolean>;
  visited: Set<string>;
  onPick: (index: number) => void;
}) {
  const indexOf = new Map(flat.map((f, i) => [f.question.id, i]));
  const counts = { answered: 0, notAnswered: 0, review: 0, notVisited: 0 };
  for (const { question } of flat) {
    const a = isAttempted(answers[question.id]);
    if (review[question.id]) counts.review++;
    else if (a) counts.answered++;
    else if (visited.has(question.id)) counts.notAnswered++;
    else counts.notVisited++;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-brand-ink/70">
        <Legend className="border-emerald-600 bg-emerald-500 text-white" label={`Answered (${counts.answered})`} />
        <Legend className="border-red-300 bg-red-50 text-red-700" label={`Not answered (${counts.notAnswered})`} />
        <Legend className="border-violet-600 bg-violet-500 text-white" label={`For review (${counts.review})`} />
        <Legend className="border-brand-border bg-white text-brand-ink" label={`Not visited (${counts.notVisited})`} />
      </div>

      {sections.map((section) => (
        <div key={section.id}>
          {sections.length > 1 && (
            <p className="mb-1.5 text-[11px] font-semibold text-brand-navy">{section.title}</p>
          )}
          <div className="grid grid-cols-6 gap-1.5">
            {section.questions.map((q) => {
              const index = indexOf.get(q.id)!;
              const answered = isAttempted(answers[q.id]);
              const marked = review[q.id];
              const style = marked
                ? "border-violet-600 bg-violet-500 text-white"
                : answered
                  ? "border-emerald-600 bg-emerald-500 text-white"
                  : visited.has(q.id)
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-brand-border bg-white text-brand-ink";
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onPick(index)}
                  aria-label={`Question ${q.number}`}
                  aria-current={index === current ? "true" : undefined}
                  className={`relative h-8 rounded-md border text-xs font-semibold ${style} ${
                    index === current ? "ring-2 ring-brand-blue ring-offset-1" : ""
                  }`}
                >
                  {q.number}
                  {marked && answered && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[10px] leading-snug text-brand-ink/55">
        Answers marked for review are still marked. Your answers save as you go.
      </p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${className}`} />
      {label}
    </span>
  );
}
