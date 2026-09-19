"use client";

import React, { useDeferredValue, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/RichText";
import { parseQuestionPaper, questionToText, type ImportError } from "@/lib/question-import";
import {
  markPaper,
  SCHEME_PRESETS,
  type AnswerKey,
  type MarkingScheme,
  type QuestionType,
  type SchemePreset,
} from "@/lib/marking";
import type { OptionRow } from "@/lib/paper";
import { shrinkImage } from "@/lib/shrink-image";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import {
  deleteQuestion,
  getQuestionImageSignature,
  importQuestions,
  regradeAll,
  setQuestionBonus,
  setResultsReleased,
  updateMarkingScheme,
  updatePassage,
  updateQuestion,
  updateSection,
} from "./actions";
import { QuestionView } from "./QuestionView";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Edit2,
  Eye,
  EyeOff,
  Gift,
  ImagePlus,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";

export interface EditorQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  options: OptionRow[];
  key: AnswerKey | null;
  solution: string | null;
  marksCorrect: number | null;
  marksWrong: number | null;
  bonus: boolean;
  passageId: string | null;
}

export interface EditorSection {
  id: string;
  title: string;
  attemptLimit: number | null;
  instructions: string | null;
  questions: EditorQuestion[];
}

interface PaperEditorProps {
  test: {
    id: string;
    title: string;
    subject: string;
    resultRelease: "INSTANT" | "ON_RELEASE";
    released: boolean;
    assigned: number;
    started: number;
    submitted: number;
  };
  scheme: MarkingScheme;
  sections: EditorSection[];
  passages: { id: string; content: string }[];
}

const EXAMPLE = `# Physics

Q1. A ball is thrown up with speed $u$. Its maximum height is
(A) $\\dfrac{u^2}{g}$
(B) $\\dfrac{u^2}{2g}$
(C) $\\dfrac{2u^2}{g}$
(D) $\\dfrac{u}{2g}$
Answer: B
Solution: At the top $v = 0$, so $0 = u^2 - 2gh$.

Q2. Which of these are vectors?
(A) Velocity
(B) Speed
(C) Force
(D) Work
Answer: A, C

# Chemistry | attempt any 1

Q3. The number of moles in $\\pu{36 g}$ of $\\ce{H2O}$ is
Answer: 2

Q4. [decimal] The pH of $\\pu{0.01 M}$ $\\ce{HCl}$ is
Answer: 1.99 to 2.01
Marks: +4 -0`;

function ErrorList({ errors }: { errors: ImportError[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
      {errors.map((e, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 font-mono font-semibold">Line {e.line}</span>
          <span>{e.message}</span>
        </li>
      ))}
    </ul>
  );
}

function Banner({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`flex items-start gap-2 rounded-md border p-2.5 text-xs ${styles}`}>
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Uploads an image and hands back the Markdown to put in the question. The
 * photo is shrunk first, like answer sheets, so a phone camera shot does not
 * weigh down every student's paper.
 */
function ImageButton({ testId, onInsert }: { testId: string; onInsert: (markdown: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const signed = await getQuestionImageSignature(testId);
      if (!signed.upload) throw new Error(signed.error || "Could not start the upload.");
      const blob = await shrinkImage(file);
      const result = await uploadToCloudinary(signed.upload, blob, file.name || "image.jpg");
      if (!result.secure_url) throw new Error("The image uploaded but has no address.");
      onInsert(`![](${result.secure_url})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="h-8 gap-1.5 text-xs"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {busy ? "Uploading…" : "Insert image"}
      </Button>
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </span>
  );
}

/** Inserts text at the textarea's cursor, keeping React's value in step. */
function insertAtCursor(
  el: HTMLTextAreaElement | null,
  value: string,
  insert: string,
  set: (v: string) => void
) {
  if (!el) return set(value + insert);
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  set(value.slice(0, start) + insert + value.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    el.selectionStart = el.selectionEnd = start + insert.length;
  });
}

function marksFor(scheme: MarkingScheme, q: Pick<EditorQuestion, "type" | "marksCorrect" | "marksWrong">) {
  return {
    correct: q.marksCorrect ?? scheme[q.type].correct,
    wrong: q.marksWrong ?? scheme[q.type].wrong,
  };
}

// ─────────────────────────────────────────────────────────────
// Adding questions
// ─────────────────────────────────────────────────────────────

function ImportPanel({
  testId,
  scheme,
  hasQuestions,
  locked,
}: {
  testId: string;
  scheme: MarkingScheme;
  hasQuestions: boolean;
  locked: boolean;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<ImportError[]>([]);
  const [showHelp, setShowHelp] = useState(!hasQuestions);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // The preview trails the typing by a frame on a long paper, so the box
  // never stutters while the tutor types.
  const deferred = useDeferredValue(text);
  const parsed = useMemo(() => (deferred.trim() ? parseQuestionPaper(deferred) : null), [deferred]);
  const count = parsed ? parsed.sections.reduce((n, s) => n + s.questions.length, 0) : 0;

  const save = async (mode: "APPEND" | "REPLACE") => {
    if (
      mode === "REPLACE" &&
      hasQuestions &&
      !window.confirm("Replace every question in this paper with the ones pasted here?")
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setServerErrors([]);
    try {
      const res = await importQuestions(testId, text, mode);
      if (res.error) {
        setError(res.error);
        setServerErrors(res.errors ?? []);
      } else {
        setText("");
      }
    } catch {
      setError("Could not reach the server. Your text is still here; try again.");
    } finally {
      setSaving(false);
    }
  };

  if (locked) {
    return (
      <Banner tone="error">
        Students have already opened this paper, so questions can no longer be added or removed.
        You can still correct any question below.
      </Banner>
    );
  }

  let number = 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-brand-ink/70">
          Paste questions in the format below. Maths goes in <code>$...$</code>, chemistry in{" "}
          <code>$\ce{"{...}"}$</code>.
        </p>
        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
        >
          Format guide
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHelp ? "rotate-180" : ""}`} />
        </button>
      </div>

      {showHelp && (
        <div className="space-y-2 rounded-md border border-brand-border bg-brand-page p-3 text-xs text-brand-ink/80">
          <ul className="list-disc space-y-1 pl-4">
            <li><code># Physics</code> starts a section. <code># Section B | attempt any 5</code> lets students answer only 5.</li>
            <li><code>Q1.</code> starts a question; options are <code>(A)</code> to <code>(D)</code>.</li>
            <li><code>Answer: B</code> for one right option, <code>Answer: A, C</code> for more than one. Add <code>[multiple]</code> after <code>Q1.</code> if only one option is right in a &ldquo;one or more&rdquo; question.</li>
            <li>No options means a typed answer: <code>Answer: 7</code> (integer), <code>Answer: 2.45 to 2.55</code> or <code>Answer: 2.5 ± 0.05</code> (decimal).</li>
            <li><code>Solution:</code> is optional. <code>Marks: +3 -1</code> gives one question its own marks.</li>
            <li><code>Paragraph:</code> starts a passage for the questions after it, until <code>End paragraph</code>.</li>
            <li>Assertion–reason and list-match questions are ordinary single-correct questions.</li>
          </ul>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setText(EXAMPLE)}>
            Load an example
          </Button>
        </div>
      )}

      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        spellCheck={false}
        placeholder={"# Physics\n\nQ1. ...\n(A) ...\n(B) ...\n(C) ...\n(D) ...\nAnswer: B"}
        className="w-full rounded-md border border-brand-border bg-white p-3 font-mono text-xs leading-relaxed text-brand-ink focus-ring"
      />

      <div className="flex flex-wrap items-center gap-2">
        <ImageButton testId={testId} onInsert={(md) => insertAtCursor(areaRef.current, text, md, setText)} />
        <span className="text-[11px] text-brand-ink/60">
          {parsed
            ? `${count} ${count === 1 ? "question" : "questions"} read${parsed.errors.length ? `, ${parsed.errors.length} ${parsed.errors.length === 1 ? "problem" : "problems"}` : ""}`
            : "Nothing pasted yet"}
        </span>
        <div className="ml-auto flex gap-2">
          {hasQuestions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || !parsed || count === 0 || parsed.errors.length > 0}
              onClick={() => void save("REPLACE")}
              className="h-8 text-xs"
            >
              Replace paper
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={saving || !parsed || count === 0 || parsed.errors.length > 0}
            onClick={() => void save("APPEND")}
            className="h-8 bg-brand-navy text-xs text-white hover:bg-brand-navy/90"
          >
            {saving ? "Saving…" : hasQuestions ? `Add ${count || ""} to paper` : `Save ${count || ""} questions`}
          </Button>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      <ErrorList errors={serverErrors.length ? serverErrors : parsed?.errors ?? []} />

      {parsed && count > 0 && (
        <div className="space-y-3 rounded-md border border-dashed border-brand-border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink/50">Preview</p>
          {parsed.sections.map((section, si) => (
            <div key={si} className="space-y-3">
              <p className="font-heading text-sm font-semibold text-brand-navy">
                {section.title}
                {section.attemptLimit ? (
                  <span className="ml-2 text-xs font-normal text-brand-ink/60">
                    attempt any {section.attemptLimit}
                  </span>
                ) : null}
              </p>
              {section.questions.map((q, qi) => {
                number++;
                return (
                  <div key={qi} className="rounded-md border border-brand-border bg-white p-3">
                    {q.passage !== null && (
                      <div className="mb-3 rounded-md bg-brand-page p-2.5 text-sm">
                        <p className="mb-1 text-[11px] font-semibold text-brand-ink/60">Passage</p>
                        <RichText text={parsed.passages[q.passage]} />
                      </div>
                    )}
                    <QuestionView
                      number={number}
                      type={q.type}
                      stem={q.stem}
                      options={q.options}
                      answerKey={q.key}
                      solution={q.solution}
                      marks={marksFor(scheme, {
                        type: q.type,
                        marksCorrect: q.rule?.correct ?? null,
                        marksWrong: q.rule?.wrong ?? null,
                      })}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// The paper
// ─────────────────────────────────────────────────────────────

function QuestionCard({
  testId,
  number,
  question,
  scheme,
  locked,
}: {
  testId: string;
  number: number;
  question: EditorQuestion;
  scheme: MarkingScheme;
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const deferred = useDeferredValue(text);
  const preview = useMemo(() => {
    if (!editing || !deferred.trim()) return null;
    const parsed = parseQuestionPaper(deferred.replace(/^\s*Q\s*\d+\s*[.):]/i, "Q1."));
    return { q: parsed.sections[0]?.questions[0] ?? null, errors: parsed.errors };
  }, [editing, deferred]);

  const startEditing = () => {
    setText(
      question.key
        ? questionToText(
            {
              type: question.type,
              stem: question.stem,
              options: question.options,
              key: question.key,
              solution: question.solution,
              rule:
                question.marksCorrect !== null || question.marksWrong !== null
                  ? { correct: question.marksCorrect ?? undefined, wrong: question.marksWrong ?? undefined }
                  : null,
            },
            number
          )
        : `Q${number}. ${question.stem}\n${question.options.map((o) => `(${o.id}) ${o.text}`).join("\n")}\nAnswer: `
    );
    setError(null);
    setErrors([]);
    setEditing(true);
  };

  const run = async (action: () => Promise<{ error?: string; errors?: ImportError[] }>) => {
    setBusy(true);
    setError(null);
    setErrors([]);
    try {
      const res = await action();
      if (res.error) {
        setError(res.error);
        setErrors(res.errors ?? []);
        return false;
      }
      return true;
    } catch {
      setError("Could not reach the server. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border-2 border-brand-blue/40 bg-white p-3">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(18, Math.max(6, text.split("\n").length + 1))}
          spellCheck={false}
          className="w-full rounded-md border border-brand-border p-2.5 font-mono text-xs leading-relaxed focus-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          <ImageButton testId={testId} onInsert={(md) => insertAtCursor(areaRef.current, text, md, setText)} />
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !preview?.q || preview.errors.length > 0}
              className="h-8 bg-brand-navy text-xs text-white hover:bg-brand-navy/90"
              onClick={async () => {
                if (await run(() => updateQuestion(question.id, text))) setEditing(false);
              }}
            >
              {busy ? "Saving…" : "Save question"}
            </Button>
          </div>
        </div>
        {locked && (
          <p className="text-[11px] text-brand-ink/60">
            Students have answered this paper: saving re-marks everyone. The type and options (A, B, ...) must stay the same.
          </p>
        )}
        {error && <Banner tone="error">{error}</Banner>}
        <ErrorList errors={errors.length ? errors : preview?.errors ?? []} />
        {preview?.q && (
          <div className="rounded-md border border-dashed border-brand-border p-3">
            <QuestionView
              number={number}
              type={preview.q.type}
              stem={preview.q.stem}
              options={preview.q.options}
              answerKey={preview.q.key}
              solution={preview.q.solution}
              marks={marksFor(scheme, {
                type: preview.q.type,
                marksCorrect: preview.q.rule?.correct ?? null,
                marksWrong: preview.q.rule?.wrong ?? null,
              })}
              bonus={question.bonus}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-border bg-white p-3">
      <QuestionView
        number={number}
        type={question.type}
        stem={question.stem}
        options={question.options}
        answerKey={question.key}
        solution={question.solution}
        marks={marksFor(scheme, question)}
        bonus={question.bonus}
      />
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-brand-border/60 pt-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={startEditing}>
          <Edit2 className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className="h-7 gap-1 text-xs"
          title="A dropped question gives full marks to everyone who attempted it"
          onClick={() => void run(() => setQuestionBonus(question.id, !question.bonus))}
        >
          <Gift className="h-3.5 w-3.5" /> {question.bonus ? "Undo bonus" : "Make bonus"}
        </Button>
        {!locked && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className="h-7 gap-1 text-xs text-red-700 hover:text-red-800"
            onClick={() => {
              if (window.confirm(`Delete question ${number}?`)) void run(() => deleteQuestion(question.id));
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        )}
        {error && <span className="ml-2 text-[11px] text-red-700">{error}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ section, questionCount }: { section: EditorSection; questionCount: number }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [limit, setLimit] = useState(section.attemptLimit ? String(section.attemptLimit) : "");
  const [instructions, setInstructions] = useState(section.instructions ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-heading text-base font-bold text-brand-navy">{section.title}</h2>
        <span className="text-xs text-brand-ink/60">
          {questionCount} {questionCount === 1 ? "question" : "questions"}
          {section.attemptLimit ? ` · attempt any ${section.attemptLimit}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-brand-blue hover:underline"
        >
          Edit section
        </button>
        {section.instructions && (
          <p className="w-full whitespace-pre-line text-xs text-brand-ink/70">{section.instructions}</p>
        )}
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    const n = limit.trim() ? Number(limit) : null;
    try {
      const res = await updateSection(section.id, { title, attemptLimit: n, instructions });
      if (res.error) setError(res.error);
      else setEditing(false);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-brand-border bg-white p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Section name" />
        <Input
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          type="number"
          min={1}
          placeholder="Attempt any…"
          title="Leave blank for all questions"
        />
      </div>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={2}
        placeholder="Instructions shown at the top of this section (optional)"
        className="w-full rounded-md border border-brand-border p-2 text-xs focus-ring"
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={save} className="h-8 bg-brand-navy text-xs text-white">
          {busy ? "Saving…" : "Save section"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        {error && <span className="text-[11px] text-red-700">{error}</span>}
      </div>
    </div>
  );
}

function PassageBlock({ passage }: { passage: { id: string; content: string } }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(passage.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-brand-blue/30 bg-brand-tint/50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-navy">Passage</p>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-brand-blue hover:underline">
            Edit passage
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-brand-border p-2 font-mono text-xs focus-ring"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="h-8 bg-brand-navy text-xs text-white"
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const res = await updatePassage(passage.id, text);
                  if (res.error) setError(res.error);
                  else setEditing(false);
                } catch {
                  setError("Could not reach the server.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save passage
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {error && <span className="text-[11px] text-red-700">{error}</span>}
          </div>
        </div>
      ) : (
        <RichText text={passage.content} className="text-sm" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

const RULE_ROWS: { type: QuestionType; label: string }[] = [
  { type: "SINGLE", label: "Single correct" },
  { type: "MULTIPLE", label: "One or more correct" },
  { type: "INTEGER", label: "Integer" },
  { type: "DECIMAL", label: "Decimal" },
];

function SchemeEditor({ testId, scheme, submitted }: { testId: string; scheme: MarkingScheme; submitted: number }) {
  const [draft, setDraft] = useState<MarkingScheme>(scheme);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const changed = JSON.stringify(draft) !== JSON.stringify(scheme);

  const setRule = (type: QuestionType, field: "correct" | "wrong", raw: string) => {
    const n = raw === "" || raw === "-" ? 0 : Number(raw);
    if (!Number.isFinite(n)) return;
    setDraft((d) => ({ ...d, [type]: { ...d[type], [field]: field === "wrong" ? -Math.abs(n) : Math.abs(n) } }));
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await updateMarkingScheme(testId, draft);
      setMessage(res.error ? { tone: "error", text: res.error } : { tone: "ok", text: "Saved." });
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(SCHEME_PRESETS) as SchemePreset[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setDraft(SCHEME_PRESETS[key].scheme)}
            className="rounded-full border border-brand-border bg-white px-2.5 py-1 text-[11px] font-medium text-brand-navy hover:border-brand-blue"
          >
            {SCHEME_PRESETS[key].label}
          </button>
        ))}
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] text-brand-ink/60">
            <th className="pb-1 font-medium">Type</th>
            <th className="pb-1 font-medium">Right</th>
            <th className="pb-1 font-medium">Wrong</th>
          </tr>
        </thead>
        <tbody>
          {RULE_ROWS.map((row) => (
            <tr key={row.type}>
              <td className="py-1 pr-2 text-brand-ink">{row.label}</td>
              <td className="py-1 pr-2">
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={draft[row.type].correct}
                  onChange={(e) => setRule(row.type, "correct", e.target.value)}
                  className="h-8 w-20 text-xs"
                />
              </td>
              <td className="py-1">
                <Input
                  type="number"
                  step="any"
                  max={0}
                  value={draft[row.type].wrong}
                  onChange={(e) => setRule(row.type, "wrong", e.target.value)}
                  className="h-8 w-20 text-xs"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={draft.MULTIPLE.partial === "PER_OPTION"}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              MULTIPLE: {
                ...d.MULTIPLE,
                partial: e.target.checked ? "PER_OPTION" : "NONE",
                partialPerOption: e.target.checked ? d.MULTIPLE.partialPerOption || 1 : 0,
              },
            }))
          }
        />
        <span>
          Partial marks on &ldquo;one or more correct&rdquo;: +
          <input
            type="number"
            step="any"
            min={0}
            disabled={draft.MULTIPLE.partial !== "PER_OPTION"}
            value={draft.MULTIPLE.partialPerOption}
            onChange={(e) =>
              setDraft((d) => ({ ...d, MULTIPLE: { ...d.MULTIPLE, partialPerOption: Math.abs(Number(e.target.value) || 0) } }))
            }
            className="mx-1 w-12 rounded border border-brand-border px-1 py-0.5 text-xs"
          />
          for each right option picked, when no wrong option is picked.
        </span>
      </label>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={busy || !changed} onClick={save} className="h-8 bg-brand-navy text-xs text-white">
          {busy ? "Saving…" : "Save marking"}
        </Button>
        {changed && submitted > 0 && (
          <span className="text-[11px] text-brand-ink/60">Re-marks {submitted} submitted {submitted === 1 ? "attempt" : "attempts"}.</span>
        )}
      </div>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
    </div>
  );
}

function ResultsCard({ test }: { test: PaperEditorProps["test"] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const act = async (fn: () => Promise<{ error?: string; count?: number }>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      setMessage(res.error ? { tone: "error", text: res.error } : { tone: "ok", text: ok });
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <p className="text-brand-ink/80">
        {test.submitted} of {test.assigned} assigned {test.assigned === 1 ? "student has" : "students have"} submitted.
      </p>
      {test.resultRelease === "INSTANT" ? (
        <p className="text-brand-ink/70">Students see their score and the solutions right after they submit.</p>
      ) : test.released ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
            <Eye className="h-3.5 w-3.5" /> Results are released
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-8 text-xs"
            onClick={() => void act(() => setResultsReleased(test.id, false), "Results hidden again.")}
          >
            Hide results
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-semibold text-brand-ink/70">
            <EyeOff className="h-3.5 w-3.5" /> Hidden from students
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            onClick={() => {
              const waiting = test.assigned - test.submitted;
              if (
                waiting > 0 &&
                !window.confirm(`${waiting} ${waiting === 1 ? "student has" : "students have"} not submitted yet. Release results anyway?`)
              ) {
                return;
              }
              void act(() => setResultsReleased(test.id, true), "Results released.");
            }}
          >
            Release results
          </Button>
        </div>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        className="h-7 gap-1 px-0 text-xs text-brand-blue"
        onClick={() => void act(() => regradeAll(test.id), "Every submitted attempt was marked again.")}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Re-mark all attempts
      </Button>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-brand-border bg-white p-4 shadow-xs">
      <h2 className="mb-3 font-heading text-sm font-semibold text-brand-navy">{title}</h2>
      {children}
    </section>
  );
}

export function PaperEditor({ test, scheme, sections, passages }: PaperEditorProps) {
  const locked = test.started > 0;
  const questionCount = sections.reduce((n, s) => n + s.questions.length, 0);
  const passageById = new Map(passages.map((p) => [p.id, p]));

  const maxScore = useMemo(
    () =>
      markPaper(
        sections.map((s) => ({
          id: s.id,
          attemptLimit: s.attemptLimit,
          questions: s.questions.map((q) => ({
            id: q.id,
            key: q.key ?? { type: "SINGLE" as const, options: [] },
            rule: { correct: q.marksCorrect ?? undefined, wrong: q.marksWrong ?? undefined },
          })),
        })),
        {},
        scheme
      ).maxScore,
    [sections, scheme]
  );

  let number = 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/admin/tests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:text-brand-blue"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All tests
        </Link>
        <h1 className="mt-2 font-heading text-xl font-bold text-brand-navy">{test.title}</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          {test.subject} &middot; {questionCount} {questionCount === 1 ? "question" : "questions"} &middot; {maxScore} marks
          {locked && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
              <Lock className="h-3 w-3" /> {test.started} started
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card title={questionCount ? "Add questions" : "Add your questions"}>
            <ImportPanel testId={test.id} scheme={scheme} hasQuestions={questionCount > 0} locked={locked} />
          </Card>

          {sections.map((section) => (
            <section key={section.id} className="space-y-3">
              <SectionHeader section={section} questionCount={section.questions.length} />
              {section.questions.map((question, i) => {
                number++;
                const passage = question.passageId ? passageById.get(question.passageId) : null;
                const firstOfPassage =
                  passage && (i === 0 || section.questions[i - 1].passageId !== question.passageId);
                return (
                  <React.Fragment key={question.id}>
                    {firstOfPassage && passage && <PassageBlock passage={passage} />}
                    <QuestionCard testId={test.id} number={number} question={question} scheme={scheme} locked={locked} />
                  </React.Fragment>
                );
              })}
            </section>
          ))}
        </div>

        <aside className="space-y-5">
          <Card title="Marking">
            <SchemeEditor testId={test.id} scheme={scheme} submitted={test.submitted} />
          </Card>
          <Card title="Results">
            <ResultsCard test={test} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
