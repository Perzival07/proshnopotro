"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/RichText";
import { BOARDS, CLASS_LEVELS } from "@/lib/syllabus";
import { SUBJECTS } from "@/lib/subjects";
import type { QuestionType } from "@/lib/marking";
import { TYPE_LABELS } from "../../tests/[testId]/questions/QuestionView";
import { addBankQuestionsToTest } from "../actions";
import { ArrowLeft, Search } from "lucide-react";

export interface BankQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  options: { id: string; text: string }[];
  marks: number;
  paper: string;
  paperId: string;
  year: number | null;
  chapter: string | null;
  topic: string | null;
  hasPassage: boolean;
}

interface Filters {
  board: string;
  classLevel: string;
  subject: string;
  year: string;
  chapter: string;
  type: string;
  q: string;
}

const selectClass = "h-9 rounded-md border border-brand-border bg-white px-2 text-xs text-brand-ink";

export function QuestionBrowser({
  questions,
  total,
  limit,
  chapters,
  targets,
  filters,
}: {
  questions: BankQuestion[];
  total: number;
  limit: number;
  chapters: { id: string; name: string }[];
  targets: { id: string; title: string; sections: string[] }[];
  filters: Filters;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const [section, setSection] = useState("From the question bank");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; href?: string } | null>(null);

  const go = (next: Partial<Filters>) => {
    const merged = { ...filters, ...next };
    // A chapter belongs to one syllabus; changing the syllabus clears it.
    if (next.board !== undefined || next.classLevel !== undefined || next.subject !== undefined) merged.chapter = "";
    const q = new URLSearchParams();
    if (merged.board) q.set("board", merged.board);
    if (merged.classLevel) q.set("class", merged.classLevel);
    if (merged.subject) q.set("subject", merged.subject);
    if (merged.year) q.set("year", merged.year);
    if (merged.chapter) q.set("chapter", merged.chapter);
    if (merged.type) q.set("type", merged.type);
    if (merged.q) q.set("q", merged.q);
    router.push(`/admin/bank/questions${q.toString() ? `?${q}` : ""}`);
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const add = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await addBankQuestionsToTest(picked, target, section);
      if (res.error) setMessage({ tone: "error", text: res.error });
      else {
        const title = targets.find((t) => t.id === target)?.title ?? "the test";
        setMessage({ tone: "ok", text: `Added ${res.added} ${res.added === 1 ? "question" : "questions"} to ${title}.`, href: `/admin/tests/${target}/questions` });
        setPicked([]);
      }
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const targetSections = targets.find((t) => t.id === target)?.sections ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link href="/admin/bank" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:text-brand-blue">
          <ArrowLeft className="h-3.5 w-3.5" /> Past papers
        </Link>
        <h1 className="mt-2 font-heading text-xl font-bold text-brand-navy">Find questions</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          Every question in the bank&apos;s past papers. Tick the ones you want and add them to a test; each keeps its
          marks, passage, translation and chapter.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-border bg-white p-3 shadow-card">
        <select aria-label="Board" value={filters.board} onChange={(e) => go({ board: e.target.value })} className={selectClass}>
          <option value="">All boards</option>
          {BOARDS.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select aria-label="Class" value={filters.classLevel} onChange={(e) => go({ classLevel: e.target.value })} className={selectClass}>
          <option value="">All classes</option>
          {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select aria-label="Subject" value={filters.subject} onChange={(e) => go({ subject: e.target.value })} className={selectClass}>
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          aria-label="Chapter"
          value={filters.chapter}
          disabled={chapters.length === 0}
          title={chapters.length === 0 ? "Choose a board, class and subject to filter by chapter" : undefined}
          onChange={(e) => go({ chapter: e.target.value })}
          className={`${selectClass} max-w-[220px] disabled:opacity-50`}
        >
          <option value="">All chapters</option>
          {chapters.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}
        </select>
        <select aria-label="Type" value={filters.type} onChange={(e) => go({ type: e.target.value })} className={selectClass}>
          <option value="">All types</option>
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <Input aria-label="Year" value={filters.year} onChange={(e) => go({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Year" className="h-9 w-20 text-xs" />
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search });
          }}
        >
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Words in the question or topic" className="h-9 min-w-[160px] flex-1 text-xs" />
          <Button type="submit" size="sm" variant="outline" className="h-9" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-2">
          <p className="text-xs text-brand-ink/60">
            {total === 0 ? "No questions match." : total > limit ? `Showing the first ${limit} of ${total} questions. Narrow the filters to see the rest.` : `${total} ${total === 1 ? "question" : "questions"}.`}
          </p>
          {questions.map((q) => {
            const on = picked.includes(q.id);
            return (
              <label
                key={q.id}
                className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 transition-colors ${on ? "border-brand-blue ring-1 ring-brand-blue" : "border-brand-border hover:border-brand-blue/50"}`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(q.id)} className="mt-1 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="rounded bg-brand-tint px-1.5 py-0.5 font-semibold text-brand-navy">{TYPE_LABELS[q.type]}</span>
                    <span className="font-mono text-brand-ink/60">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
                    <span className="text-brand-ink/60">{q.year ?? ""} · {q.paper}</span>
                    {q.chapter && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{q.chapter}</span>}
                    {q.topic && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{q.topic}</span>}
                    {q.hasPassage && <span className="text-brand-blue">with passage</span>}
                  </div>
                  <div className="line-clamp-4 text-sm">
                    <RichText text={q.stem} />
                  </div>
                  {q.options.length > 0 && (
                    <p className="truncate text-[11px] text-brand-ink/60">
                      {q.options.map((o) => `(${o.id}) ${o.text.replace(/\s+/g, " ").slice(0, 40)}`).join("   ")}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-3 rounded-xl border border-brand-border bg-white p-4 text-xs shadow-card">
            <p className="font-semibold text-brand-navy">
              {picked.length} {picked.length === 1 ? "question" : "questions"} ticked
            </p>
            {targets.length === 0 ? (
              <p className="text-brand-ink/70">
                No test can take questions right now: create a test with &ldquo;Write questions here&rdquo; that no student
                has started.
              </p>
            ) : (
              <>
                <label className="block font-semibold text-brand-navy">
                  Add to test
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className={`mt-1 w-full ${selectClass}`}>
                    {targets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </label>
                <label className="block font-semibold text-brand-navy">
                  Into section
                  <Input value={section} onChange={(e) => setSection(e.target.value)} list="bank-target-sections" className="mt-1 h-9 text-xs" />
                  <datalist id="bank-target-sections">
                    {targetSections.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </label>
                <Button type="button" disabled={busy || picked.length === 0 || !target} onClick={add} className="h-9 w-full bg-brand-navy text-xs text-white">
                  {busy ? "Adding…" : `Add ${picked.length || ""} to the test`}
                </Button>
                {picked.length > 0 && (
                  <button type="button" onClick={() => setPicked([])} className="text-[11px] text-brand-ink/60 hover:underline">
                    Untick all
                  </button>
                )}
              </>
            )}
            {message && (
              <p className={`rounded-md border p-2 ${message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
                {message.text}{" "}
                {message.href && (
                  <Link href={message.href} className="font-semibold underline">
                    Open it
                  </Link>
                )}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
