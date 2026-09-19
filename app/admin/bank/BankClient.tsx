"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOARDS, CLASS_LEVELS } from "@/lib/syllabus";
import { SUBJECTS } from "@/lib/subjects";
import { DeleteTestDialog } from "../tests/DeleteTestDialog";
import { createBankPaper, makeTestFromBankPaper, updateBankPaper, type BankPaperInput } from "./actions";
import { Copy, Edit2, FileText, ListChecks, Plus, Search, Trash2 } from "lucide-react";

export interface BankPaper {
  id: string;
  title: string;
  examName: string | null;
  board: string;
  classLevel: string;
  subject: string;
  year: number;
  questions: number;
}

interface Filters {
  board: string;
  classLevel: string;
  subject: string;
  year: string;
}

const selectClass = "h-9 rounded-md border border-brand-border bg-white px-2 text-xs text-brand-ink";

function PaperDialog({
  paper,
  onClose,
}: {
  paper: BankPaper | "new";
  onClose: () => void;
}) {
  const router = useRouter();
  const existing = paper === "new" ? null : paper;
  const [data, setData] = useState<BankPaperInput>({
    title: existing?.title ?? "",
    examName: existing?.examName ?? "",
    board: existing?.board || "CBSE",
    classLevel: existing?.classLevel || "12",
    subject: existing?.subject || "Physics",
    year: existing?.year || new Date().getFullYear() - 1,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof BankPaperInput, v: string | number) => setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = existing ? await updateBankPaper(existing.id, data) : await createBankPaper(data);
      if (res.error) setError(res.error);
      else if (!existing && res.testId) router.push(`/admin/tests/${res.testId}/questions`);
      else {
        onClose();
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit past paper" : "Add a past paper"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "The paper's details. Its questions are edited on its own page."
              : "Then add its questions, by pasting or importing the Word file, on the next page."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <label className="block font-semibold text-brand-navy">
            Name
            <Input value={data.title} onChange={(e) => set("title", e.target.value)} placeholder="Physics board paper" className="mt-1" />
          </label>
          <label className="block font-semibold text-brand-navy">
            Exam (optional)
            <Input value={data.examName} onChange={(e) => set("examName", e.target.value)} placeholder="CBSE Board Exam, Set 55/1/1" className="mt-1" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="font-semibold text-brand-navy">
              Board
              <select value={data.board} onChange={(e) => set("board", e.target.value)} className={`mt-1 w-full ${selectClass}`}>
                {BOARDS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label className="font-semibold text-brand-navy">
              Year
              <Input type="number" value={data.year} onChange={(e) => set("year", Number(e.target.value))} className="mt-1" />
            </label>
            <label className="font-semibold text-brand-navy">
              Class
              <select value={data.classLevel} onChange={(e) => set("classLevel", e.target.value)} className={`mt-1 w-full ${selectClass}`}>
                {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </label>
            <label className="font-semibold text-brand-navy">
              Subject
              <select value={data.subject} onChange={(e) => set("subject", e.target.value)} className={`mt-1 w-full ${selectClass}`}>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={busy} onClick={save} className="bg-brand-navy text-white">
            {busy ? "Saving…" : existing ? "Save" : "Add & write questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BankClient({ papers, years, filters }: { papers: BankPaper[]; years: number[]; filters: Filters }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<BankPaper | "new" | null>(null);
  const [toDelete, setToDelete] = useState<BankPaper | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value };
    const q = new URLSearchParams();
    if (next.board) q.set("board", next.board);
    if (next.classLevel) q.set("class", next.classLevel);
    if (next.subject) q.set("subject", next.subject);
    if (next.year) q.set("year", next.year);
    router.push(`/admin/bank${q.toString() ? `?${q}` : ""}`);
  };

  const practice = async (paper: BankPaper) => {
    setBusyId(paper.id);
    setError(null);
    try {
      const res = await makeTestFromBankPaper(paper.id);
      if (res.error) setError(res.error);
      else if (res.testId) router.push(`/admin/tests/${res.testId}/questions`);
    } finally {
      setBusyId(null);
    }
  };

  const byYear = new Map<number, BankPaper[]>();
  for (const p of papers) byYear.set(p.year, [...(byYear.get(p.year) ?? []), p]);
  const questionsHref = `/admin/bank/questions?${new URLSearchParams(
    Object.entries({ board: filters.board, class: filters.classLevel, subject: filters.subject, year: filters.year }).filter(([, v]) => v) as [string, string][]
  )}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-brand-navy">Question Bank</h1>
          <p className="mt-0.5 text-xs text-brand-ink/60">
            Past papers by year. Make a practice test from a whole paper, or pick questions into any test.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href={questionsHref}>
              <Search className="h-4 w-4" /> Find questions
            </Link>
          </Button>
          <Button onClick={() => setDialog("new")} className="gap-2 bg-brand-navy text-white hover:bg-brand-navy/90">
            <Plus className="h-4 w-4" /> Add a past paper
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-brand-border bg-white p-3 shadow-card">
        <select aria-label="Board" value={filters.board} onChange={(e) => setFilter("board", e.target.value)} className={selectClass}>
          <option value="">All boards</option>
          {BOARDS.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select aria-label="Class" value={filters.classLevel} onChange={(e) => setFilter("classLevel", e.target.value)} className={selectClass}>
          <option value="">All classes</option>
          {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select aria-label="Subject" value={filters.subject} onChange={(e) => setFilter("subject", e.target.value)} className={selectClass}>
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Year" value={filters.year} onChange={(e) => setFilter("year", e.target.value)} className={selectClass}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{error}</p>}

      {papers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          <FileText className="mx-auto mb-2 h-6 w-6 text-brand-ink/40" />
          No past papers {filters.board || filters.classLevel || filters.subject || filters.year ? "match these filters" : "yet"}.
          Add one, and import its Word file on the next page.
        </div>
      ) : (
        Array.from(byYear.entries()).map(([year, list]) => (
          <section key={year} className="space-y-2">
            <h2 className="font-heading text-base font-bold text-brand-navy">{year || "Year not set"}</h2>
            <ul className="divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border bg-white shadow-card">
              {list.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-navy">{p.title}</p>
                    <p className="truncate text-[11px] text-brand-ink/60">
                      {[p.examName, p.board, p.classLevel && `Class ${p.classLevel}`, p.subject].filter(Boolean).join(" · ")} &middot;{" "}
                      {p.questions} {p.questions === 1 ? "question" : "questions"}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                    <Link href={`/admin/tests/${p.id}/questions`}>
                      <ListChecks className="h-3.5 w-3.5" /> Questions
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === p.id || p.questions === 0}
                    onClick={() => practice(p)}
                    className="h-8 gap-1.5 bg-brand-navy text-xs text-white hover:bg-brand-navy/90"
                  >
                    <Copy className="h-3.5 w-3.5" /> {busyId === p.id ? "Copying…" : "Make a practice test"}
                  </Button>
                  <button type="button" aria-label="Edit details" onClick={() => setDialog(p)} className="rounded p-1.5 text-brand-ink/70 hover:bg-brand-tint">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Delete paper" onClick={() => setToDelete(p)} className="rounded p-1.5 text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {dialog && <PaperDialog paper={dialog} onClose={() => setDialog(null)} />}
      <DeleteTestDialog
        test={toDelete ? { id: toDelete.id, title: toDelete.title, active: false } : null}
        onClose={() => {
          setToDelete(null);
          router.refresh();
        }}
        onDeactivate={() => undefined}
      />
    </div>
  );
}
