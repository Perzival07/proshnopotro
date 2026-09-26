"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOARDS, CLASS_LEVELS } from "@/lib/syllabus";
import { SUBJECTS } from "@/lib/subjects";
import {
  addChapters,
  deleteChapter,
  loadNcertChapters,
  moveChapter,
  renameChapter,
  type ChapterRow,
} from "./actions";
import { ArrowDown, ArrowUp, BookOpen, Check, Edit2, Trash2, X } from "lucide-react";

export function SyllabusClient({
  board,
  classLevel,
  subject,
  initial,
  hasPreset,
}: {
  board: string;
  classLevel: string;
  subject: string;
  initial: ChapterRow[];
  hasPreset: boolean;
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const go = (next: { board?: string; classLevel?: string; subject?: string }) => {
    const q = new URLSearchParams({
      board: next.board ?? board,
      class: next.classLevel ?? classLevel,
      subject: next.subject ?? subject,
    });
    router.push(`/admin/syllabus?${q}`);
  };

  const run = async <T extends { error?: string; chapters?: ChapterRow[]; added?: number }>(fn: () => Promise<T>, ok?: (r: T) => string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      if (res.error) setMessage({ tone: "error", text: res.error });
      else {
        if (res.chapters) setChapters(res.chapters);
        if (ok) setMessage({ tone: "ok", text: ok(res) });
      }
      return res;
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-brand-navy">Syllabus</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          The chapters questions are tagged with, so results can be broken down by chapter and the question bank
          searched by it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-brand-border bg-white p-4 shadow-card sm:grid-cols-3">
        <label className="text-[11px] font-semibold text-brand-navy">
          Board
          <Select value={board} onValueChange={(v) => go({ board: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BOARDS.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-[11px] font-semibold text-brand-navy">
          Class
          <Select value={classLevel} onValueChange={(v) => go({ classLevel: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLASS_LEVELS.map((c) => (
                <SelectItem key={c} value={c}>Class {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-[11px] font-semibold text-brand-navy">
          Subject
          <Select value={subject} onValueChange={(v) => go({ subject: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-brand-border bg-white shadow-card">
          <div className="border-b border-brand-border px-4 py-3">
            <h2 className="font-heading text-sm font-semibold text-brand-navy">
              {board} &middot; Class {classLevel} &middot; {subject}
            </h2>
            <p className="text-[11px] text-brand-ink/60">
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
            </p>
          </div>
          {chapters.length === 0 ? (
            <div className="p-8 text-center text-xs text-brand-ink/60">
              <BookOpen className="mx-auto mb-2 h-6 w-6 text-brand-ink/40" />
              No chapters yet. {hasPreset ? "Load the NCERT chapters, or paste a list." : "Paste the chapter list on the right."}
            </div>
          ) : (
            <ol className="divide-y divide-brand-border">
              {chapters.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-brand-ink/50">{i + 1}</span>
                  {editing === c.id ? (
                    <>
                      <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 flex-1 text-sm" autoFocus />
                      <button
                        type="button"
                        aria-label="Save name"
                        onClick={async () => {
                          const res = await run(() => renameChapter(c.id, draft));
                          if (res && !res.error) {
                            setChapters((list) => list.map((x) => (x.id === c.id ? { ...x, name: draft.trim() } : x)));
                            setEditing(null);
                          }
                        }}
                        className="rounded p-1 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Cancel" onClick={() => setEditing(null)} className="rounded p-1 text-brand-ink/60 hover:bg-brand-tint">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-brand-ink">{c.name}</span>
                      {c.questions > 0 && (
                        <span className="shrink-0 rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand-navy">
                          {c.questions} {c.questions === 1 ? "question" : "questions"}
                        </span>
                      )}
                      <button type="button" aria-label="Move up" disabled={busy || i === 0} onClick={() => run(() => moveChapter(c.id, -1))} className="rounded p-1 text-brand-ink/60 hover:bg-brand-tint disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label="Move down" disabled={busy || i === chapters.length - 1} onClick={() => run(() => moveChapter(c.id, 1))} className="rounded p-1 text-brand-ink/60 hover:bg-brand-tint disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label="Rename" onClick={() => { setEditing(c.id); setDraft(c.name); }} className="rounded p-1 text-brand-ink/60 hover:bg-brand-tint">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={async () => {
                          if (!window.confirm(c.questions ? `Remove "${c.name}"? Its ${c.questions} tagged questions stay, untagged.` : `Remove "${c.name}"?`)) return;
                          const res = await run(() => deleteChapter(c.id));
                          if (res && !res.error) setChapters((list) => list.filter((x) => x.id !== c.id));
                        }}
                        className="rounded p-1 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          {hasPreset && (
            <div className="space-y-2 rounded-xl border border-brand-border bg-white p-4 text-xs shadow-card">
              <p className="font-semibold text-brand-navy">NCERT chapters</p>
              <p className="text-brand-ink/70">
                Adds Class {classLevel} {subject} from the NCERT books (2023–24 rationalised editions). Check them
                against the books you teach from; anything here can be edited.
              </p>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => run(() => loadNcertChapters(board, classLevel, subject), (r) => `Added ${r.added} chapters.`)}
                className="h-8 bg-brand-navy text-xs text-white"
              >
                Load NCERT chapters
              </Button>
            </div>
          )}
          <div className="space-y-2 rounded-xl border border-brand-border bg-white p-4 text-xs shadow-card">
            <p className="font-semibold text-brand-navy">Add chapters</p>
            <p className="text-brand-ink/70">
              One per line, in order. Paste straight from the ICSE or ISC syllabus; numbering is dropped.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={"Force\nWork, Energy and Power\nMachines"}
              className="w-full rounded-md border border-brand-border p-2 focus-ring"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !text.trim()}
              onClick={async () => {
                const res = await run(() => addChapters(board, classLevel, subject, text), (r) => `Added ${r.added} chapters.`);
                if (res && !res.error) setText("");
              }}
              className="h-8 bg-brand-navy text-xs text-white"
            >
              Add to the list
            </Button>
          </div>
          {message && (
            <p className={`rounded-md border p-2 text-xs ${message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
              {message.text}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
