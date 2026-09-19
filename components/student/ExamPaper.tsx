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
import { MatrixColumns } from "@/components/MatrixColumns";
import { Calculator } from "@/components/student/Calculator";
import { Button } from "@/components/ui/button";
import {
  saveQuestionResponse,
  type StudentPaper,
} from "@/app/test/[assignmentId]/actions";
import { isAttempted, type ResponseValue } from "@/lib/marking";
import type { StudentQuestion, StudentSection } from "@/lib/paper";
import { formatRemaining } from "@/lib/exam-timer";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Calculator as CalculatorIcon,
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
  /**
   * For a paper timed per section: each section's window on this browser's
   * clock. Only the open section can be seen and answered.
   */
  windows?: { id: string; opensAtMs: number; closesAtMs: number }[] | null;
}

type SaveState = "saving" | "saved" | "error";

const TYPE_HINT: Record<StudentQuestion["type"], string> = {
  SINGLE: "Choose one answer",
  MULTIPLE: "Choose one or more answers",
  INTEGER: "Type a whole number",
  DECIMAL: "Type a number",
  MATRIX: "Match each row to one or more columns",
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
  { assignmentId, paper, onProgress, onEnded, cameraBadge = false, windows = null },
  ref
) {
  const flat = useMemo(
    () =>
      paper.sections.flatMap((section) =>
        section.questions.map((question) => ({ question, section }))
      ),
    [paper.sections]
  );
  const passages = useMemo(() => new Map(paper.passages.map((p) => [p.id, p])), [paper.passages]);

  // The paper's second language, when its questions have one. Students read
  // either language, or both side by side, as on NTA papers.
  const second = paper.secondLanguage && flat.some((f) => f.question.translation) ? paper.secondLanguage : null;
  const [language, setLanguage] = useState<"first" | "second" | "both">("first");

  const [answers, setAnswers] = useState<Record<string, ResponseValue>>(() =>
    Object.fromEntries(paper.responses.map((r) => [r.questionId, r.value]))
  );
  const [review, setReview] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(paper.responses.map((r) => [r.questionId, r.markedForReview]))
  );
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set([...paper.responses.map((r) => r.questionId), flat[0]?.question.id].filter(Boolean) as string[])
  );
  // ── Sections on their own clocks ───────────────────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!windows) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [windows]);
  const activeWindow = windows?.find((w) => now >= w.opensAtMs && now < w.closesAtMs) ?? null;
  const canVisit = useCallback(
    (sectionId: string) => !windows || activeWindow?.id === sectionId,
    [windows, activeWindow]
  );

  const [current, setCurrent] = useState(() => {
    if (!windows) return 0;
    const open = windows.find((w) => Date.now() >= w.opensAtMs && Date.now() < w.closesAtMs);
    const index = open ? flat.findIndex((f) => f.section.id === open.id) : -1;
    return index === -1 ? 0 : index;
  });
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

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

  // When a section's time runs out, the next one opens and the student is
  // taken to it; the closed one cannot be gone back to.
  const activeId = activeWindow?.id ?? null;
  const previousActive = useRef(activeId);
  useEffect(() => {
    if (!windows || previousActive.current === activeId) return;
    const closed = paper.sections.find((s) => s.id === previousActive.current);
    previousActive.current = activeId;
    const opened = paper.sections.find((s) => s.id === activeId);
    if (!opened) return;
    const first = flat.findIndex((f) => f.section.id === opened.id);
    if (first !== -1) {
      setCurrent(first);
      setVisited((v) => new Set(v).add(flat[first].question.id));
    }
    setNotice(closed ? `Time for ${closed.title} is over. ${opened.title} has started.` : null);
  }, [activeId, windows, paper.sections, flat]);

  // ── Navigation ────────────────────────────────────────────
  const goTo = (index: number) => {
    const bounded = Math.max(0, Math.min(flat.length - 1, index));
    if (!canVisit(flat[bounded].section.id)) return;
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
  const sectionClosed = !canVisit(section.id);
  const limitReached =
    sectionClosed || (!!limit && !isAttempted(value) && answeredInSection(section) >= limit);

  const setAnswer = (next: ResponseValue, delayMs = 0) => {
    if (sectionClosed) {
      setNotice(`Time for ${section.title} is over.`);
      return;
    }
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

  const toggleCell = (row: string, column: string) => {
    const grid: Record<string, string[]> =
      value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
    const cols = new Set(grid[row] ?? []);
    if (cols.has(column)) cols.delete(column);
    else cols.add(column);
    if (cols.size) grid[row] = Array.from(cols).sort();
    else delete grid[row];
    setAnswer(Object.keys(grid).length ? grid : null);
  };

  const setMarked = (next: boolean) => {
    if (next === marked && !typingTimers.current.has(question.id)) return;
    setReview((r) => ({ ...r, [question.id]: next }));
    queueSave(question.id, answersRef.current[question.id] ?? null, next);
  };

  // The next question the student may open, in paper order, or -1.
  const nextIndex = current < flat.length - 1 && canVisit(flat[current + 1].section.id) ? current + 1 : -1;
  const moveOn = () => {
    if (nextIndex === -1) {
      setNotice(
        current === flat.length - 1
          ? "That was the last question. Check the palette for any you skipped, then press Submit."
          : "That was the last question in this section."
      );
      return;
    }
    goTo(nextIndex);
  };

  // NTA's buttons. Answers here are saved the moment they are given, so
  // "Save" only confirms: it clears a review mark and moves on.
  const saveAndNext = () => {
    setMarked(false);
    moveOn();
  };
  const markAndNext = () => {
    setMarked(true);
    moveOn();
  };

  const passageRow = question.passageId ? passages.get(question.passageId) : null;
  const passage = passageRow?.content ?? null;
  const t = second ? question.translation ?? null : null;
  const showFirst = language !== "second" || !t;
  const showSecond = language !== "first" && !!t;
  const both = showFirst && showSecond;

  /** Text in the language(s) chosen: one column, or two side by side. */
  const bilingual = (first: React.ReactNode, translated: React.ReactNode, className = "") =>
    both ? (
      <div className={`grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2 ${className}`}>
        <div className="min-w-0">{first}</div>
        <div className="min-w-0 sm:border-l sm:border-brand-border sm:pl-5">{translated}</div>
      </div>
    ) : (
      <div className={className}>{showSecond ? translated : first}</div>
    );
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
              const w = windows?.find((x) => x.id === s.id);
              const state = !w ? null : now >= w.closesAtMs ? "closed" : now < w.opensAtMs ? "later" : "open";
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!canVisit(s.id)}
                  onClick={() => goTo(first)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-brand-border bg-white text-brand-navy hover:border-brand-blue"
                  }`}
                >
                  {s.title}
                  <span className={`ml-1.5 font-normal ${active ? "text-white/70" : "text-brand-ink/50"}`}>
                    {state === "closed"
                      ? "Closed"
                      : state === "later"
                        ? `Opens in ${formatRemaining(w!.opensAtMs - now)}`
                        : `${answeredInSection(s)}/${s.attemptLimit ?? s.questions.length}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {(paper.calculator || second) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {second && (
              <div role="group" aria-label="Language" className="flex overflow-hidden rounded-md border border-brand-border text-xs font-semibold">
                {([
                  ["first", "English"],
                  ["second", second],
                  ["both", "Both"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={language === value}
                    onClick={() => setLanguage(value)}
                    className={`px-3 py-1.5 ${language === value ? "bg-brand-navy text-white" : "bg-white text-brand-ink/80 hover:bg-brand-tint"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {paper.calculator && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCalculator((s) => !s)}
                className={`h-8 gap-1.5 text-xs ${showCalculator ? "border-brand-navy bg-brand-tint" : ""}`}
              >
                <CalculatorIcon className="h-3.5 w-3.5" /> Calculator
              </Button>
            )}
          </div>
        )}
        {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

        {activeWindow && (
          <div className="flex items-center justify-between rounded-lg border border-brand-blue/30 bg-brand-tint/60 px-3 py-2 text-xs text-brand-navy">
            <span className="font-semibold">
              {paper.sections.find((s) => s.id === activeWindow.id)?.title}: time left in this section
            </span>
            <span className="font-mono text-sm font-bold tabular-nums">{formatRemaining(activeWindow.closesAtMs - now)}</span>
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
            {marked && (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                Marked for review
              </span>
            )}
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
              {bilingual(<RichText text={passage} />, <RichText text={passageRow?.translation ?? passage} />)}
            </div>
          )}

          {bilingual(
            <RichText text={question.stem} className="text-[15px] text-brand-ink" />,
            <RichText text={t?.stem ?? question.stem} className="text-[15px] text-brand-ink" />
          )}

          <div className="mt-4">
            {question.type === "MATRIX" ? (
              <div className="space-y-3">
                {showFirst && <MatrixColumns rows={question.options} columns={question.columns ?? []} />}
                {showSecond && t && <MatrixColumns rows={t.options} columns={t.columns} />}
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-1.5 text-sm">
                    <thead>
                      <tr>
                        <th />
                        {(question.columns ?? []).map((c) => (
                          <th key={c.id} className="w-11 text-center text-xs font-bold text-brand-navy">
                            {c.id}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {question.options.map((row) => {
                        const picked =
                          value && typeof value === "object" && !Array.isArray(value) ? value[row.id] ?? [] : [];
                        return (
                          <tr key={row.id}>
                            <th className="pr-1 text-left text-xs font-bold text-brand-navy">{row.id}</th>
                            {(question.columns ?? []).map((c) => {
                              const on = picked.includes(c.id);
                              return (
                                <td key={c.id}>
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={on}
                                    aria-label={`${row.id} matches ${c.id}`}
                                    disabled={limitReached && !isAttempted(value)}
                                    onClick={() => toggleCell(row.id, c.id)}
                                    className={`flex h-10 w-11 items-center justify-center rounded-md border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                      on
                                        ? "border-brand-navy bg-brand-navy text-white"
                                        : "border-brand-border bg-white text-brand-ink/40 hover:border-brand-blue"
                                    }`}
                                  >
                                    {on ? <CheckCircle2 className="h-4 w-4" /> : c.id}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : question.options.length > 0 ? (
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
                      {bilingual(
                        <RichText tall text={option.text} />,
                        <RichText tall text={t?.options.find((o) => o.id === option.id)?.text ?? option.text} />,
                        "min-w-0 flex-1"
                      )}
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
                (sectionClosed
                  ? `Time for ${section.title} is over.`
                  : limit === 1
                  ? `You have already answered a question in ${section.title}. Clear it to answer this one instead.`
                  : `You have answered ${limit} questions in ${section.title}. Clear one to answer this one instead.`)}
            </p>
          )}

          <div className="mt-5 space-y-2 border-t border-brand-border/60 pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={saveAndNext}
                className="h-9 bg-[#1ea55b] font-semibold uppercase tracking-wide text-white hover:bg-[#188a4b]"
              >
                Save &amp; Next
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={markAndNext}
                className="h-9 bg-[#7b3fbf] font-semibold uppercase tracking-wide text-white hover:bg-[#6a33a8]"
              >
                Mark for Review &amp; Next
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isAttempted(value) || sectionClosed}
                onClick={() => setAnswer(null)}
                className="h-9 font-semibold uppercase tracking-wide"
              >
                Clear Response
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={current === 0 || !canVisit(flat[current - 1]?.section.id ?? "")}
                onClick={() => goTo(current - 1)}
                className="h-9 gap-1 font-semibold uppercase tracking-wide"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={nextIndex === -1}
                onClick={() => goTo(nextIndex)}
                className="h-9 gap-1 font-semibold uppercase tracking-wide"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
          canVisit={canVisit}
        />
      </aside>
    </div>
  );
});

type PaletteState = "notVisited" | "notAnswered" | "answered" | "marked" | "answeredMarked";

/**
 * The NTA palette's five states, drawn in its shapes: answered points up,
 * not answered points down, marked for review is a circle, and answered and
 * marked is a circle with a green tick.
 */
function PaletteMark({
  state,
  children,
  className = "",
}: {
  state: PaletteState;
  children?: React.ReactNode;
  className?: string;
}) {
  const shape: Record<PaletteState, { className: string; clip?: string }> = {
    notVisited: { className: "rounded-md border border-slate-300 bg-slate-100 text-slate-700" },
    notAnswered: { className: "bg-[#e4572e] text-white", clip: "polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)" },
    answered: { className: "bg-[#1ea55b] text-white", clip: "polygon(50% 0, 100% 28%, 100% 100%, 0 100%, 0 28%)" },
    marked: { className: "rounded-full bg-[#7b3fbf] text-white" },
    answeredMarked: { className: "rounded-full bg-[#7b3fbf] text-white" },
  };
  const s = shape[state];
  return (
    <span className={`relative inline-flex items-center justify-center font-semibold ${className}`}>
      <span
        className={`flex h-full w-full items-center justify-center ${s.className}`}
        style={s.clip ? { clipPath: s.clip } : undefined}
      >
        {children}
      </span>
      {state === "answeredMarked" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-white bg-[#1ea55b]">
          <CheckCircle2 className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </span>
  );
}

function Palette({
  sections,
  flat,
  current,
  answers,
  review,
  visited,
  onPick,
  canVisit,
}: {
  sections: StudentSection[];
  flat: { question: StudentQuestion; section: StudentSection }[];
  current: number;
  answers: Record<string, ResponseValue>;
  review: Record<string, boolean>;
  visited: Set<string>;
  onPick: (index: number) => void;
  canVisit: (sectionId: string) => boolean;
}) {
  const indexOf = new Map(flat.map((f, i) => [f.question.id, i]));
  const stateOf = (id: string): PaletteState => {
    const answered = isAttempted(answers[id]);
    if (review[id]) return answered ? "answeredMarked" : "marked";
    if (answered) return "answered";
    return visited.has(id) ? "notAnswered" : "notVisited";
  };
  const counts: Record<PaletteState, number> = { notVisited: 0, notAnswered: 0, answered: 0, marked: 0, answeredMarked: 0 };
  for (const { question } of flat) counts[stateOf(question.id)]++;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[10px] leading-tight text-brand-ink/80">
        <Legend state="answered" count={counts.answered} label="Answered" />
        <Legend state="notAnswered" count={counts.notAnswered} label="Not Answered" />
        <Legend state="notVisited" count={counts.notVisited} label="Not Visited" />
        <Legend state="marked" count={counts.marked} label="Marked for Review" />
        <div className="col-span-2">
          <Legend
            state="answeredMarked"
            count={counts.answeredMarked}
            label="Answered & Marked for Review (will be considered for evaluation)"
          />
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.id}>
          {sections.length > 1 && (
            <p className="mb-1.5 rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand-navy">{section.title}</p>
          )}
          <div className="grid grid-cols-5 gap-2">
            {section.questions.map((q) => {
              const index = indexOf.get(q.id)!;
              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={!canVisit(section.id)}
                  onClick={() => onPick(index)}
                  aria-label={`Question ${q.number}`}
                  aria-current={index === current ? "true" : undefined}
                  className={`rounded-md p-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${
                    index === current ? "ring-2 ring-brand-blue" : ""
                  }`}
                >
                  <PaletteMark state={stateOf(q.id)} className="h-9 w-full text-xs">
                    {q.number}
                  </PaletteMark>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ state, count, label }: { state: PaletteState; count: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <PaletteMark state={state} className="h-6 w-7 shrink-0 text-[10px]">
        {count}
      </PaletteMark>
      {label}
    </span>
  );
}
