"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { replyToDoubt, setDoubtStatus, type ThreadState } from "@/app/doubts/actions";
import { statusLabel } from "@/lib/doubts";
import { MessageCircleQuestion } from "lucide-react";

export interface InboxDoubt extends ThreadState {
  student: string;
  email: string;
  paper: string;
  question: string;
  updatedAt: string;
}

const TABS = [
  ["OPEN", "Needs a reply"],
  ["ANSWERED", "Replied"],
  ["RESOLVED", "Resolved"],
  ["ALL", "All"],
] as const;

function Thread({ doubt }: { doubt: InboxDoubt }) {
  const [thread, setThread] = useState<ThreadState>(doubt);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await replyToDoubt(doubt.id, reply);
      if (res.error) setError(res.error);
      else if (res.thread) {
        setThread(res.thread);
        setReply("");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };
  const status = async (s: "OPEN" | "RESOLVED") => {
    setBusy(true);
    try {
      const res = await setDoubtStatus(doubt.id, s);
      if (res.thread) setThread(res.thread);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="space-y-3 rounded-xl border border-brand-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-brand-navy">{doubt.student}</span>
        <span className="text-[11px] text-brand-ink/50">{doubt.email}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            thread.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : thread.status === "ANSWERED" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {statusLabel(thread.status, "tutor")}
        </span>
      </div>
      <details className="rounded-md bg-brand-page p-2 text-sm">
        <summary className="cursor-pointer text-xs text-brand-ink/70">
          {doubt.paper} &middot; the question
        </summary>
        <div className="mt-2">
          <RichText text={doubt.question} />
        </div>
      </details>
      <div className="space-y-2">
        {thread.messages.map((m) => (
          <div key={m.id} className={`rounded-md border p-2 ${m.fromTutor ? "border-brand-blue/30 bg-brand-tint/40" : "border-brand-border"}`}>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink/60">
              {m.fromTutor ? "Tutor" : doubt.student} &middot;{" "}
              {new Date(m.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
            </p>
            <p className="whitespace-pre-line text-sm">{m.body}</p>
          </div>
        ))}
      </div>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Your reply"
        aria-label={`Reply to ${doubt.student}`}
        className="w-full rounded-md border border-brand-border p-2 text-sm focus-ring"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={busy || !reply.trim()} onClick={send} className="h-8 bg-brand-navy text-xs text-white">
          Send reply
        </Button>
        {thread.status === "RESOLVED" ? (
          <button type="button" disabled={busy} onClick={() => status("OPEN")} className="text-[11px] font-semibold text-brand-blue hover:underline">
            Reopen
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => status("RESOLVED")} className="text-[11px] font-semibold text-emerald-700 hover:underline">
            Mark resolved
          </button>
        )}
        {error && <span className="text-[11px] text-red-700">{error}</span>}
      </div>
    </article>
  );
}

export function DoubtsInbox({ initial, status, counts }: { initial: InboxDoubt[]; status: string; counts: Record<string, number> }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-brand-navy">Doubts</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">Questions students ask from their results. Oldest waiting first.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => router.push(key === "OPEN" ? "/admin/doubts" : `/admin/doubts?status=${key}`)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === key ? "border-brand-navy bg-brand-navy text-white" : "border-brand-border bg-white text-brand-navy hover:border-brand-blue"}`}
          >
            {label}
            {key !== "ALL" && counts[key] ? <span className="ml-1.5 opacity-70">{counts[key]}</span> : null}
          </button>
        ))}
      </div>
      {initial.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          <MessageCircleQuestion className="mx-auto mb-2 h-6 w-6 text-brand-ink/40" />
          Nothing here.
        </div>
      ) : (
        initial.map((d) => <Thread key={d.id} doubt={d} />)
      )}
    </div>
  );
}
