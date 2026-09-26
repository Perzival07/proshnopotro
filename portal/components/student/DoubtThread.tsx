"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { askDoubt, markDoubtSeen, setDoubtResolved, type ThreadState } from "@/app/doubts/actions";
import { statusLabel } from "@/lib/doubts";
import { MessageCircleQuestion, CheckCircle2 } from "lucide-react";

/**
 * A student's doubt about one question: the conversation so far, a box to
 * ask or follow up, and a way to mark it resolved. Sits under the question on
 * their result.
 */
export function DoubtThread({
  assignmentId,
  questionId,
  initial,
  unread = false,
}: {
  assignmentId: string;
  questionId: string;
  initial: ThreadState | null;
  /** A tutor's reply here the student has not seen. */
  unread?: boolean;
}) {
  const [thread, setThread] = useState(initial);
  // Opening the result is looking at the reply: clear the notification, and
  // tell the nav so its badge drops without waiting for the next page.
  useEffect(() => {
    if (!unread || !initial) return;
    void markDoubtSeen(initial.id).then(() => window.dispatchEvent(new Event("doubts-seen")));
  }, [unread, initial]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await askDoubt(assignmentId, questionId, text);
      if (res.error) setError(res.error);
      else {
        setThread(res.thread ?? null);
        setText("");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (resolved: boolean) => {
    if (!thread) return;
    setBusy(true);
    try {
      const res = await setDoubtResolved(thread.id, resolved);
      if (res.thread) setThread(res.thread);
    } finally {
      setBusy(false);
    }
  };

  if (!thread && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:underline"
      >
        <MessageCircleQuestion className="h-3.5 w-3.5" /> Ask a doubt about this question
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand-blue/25 bg-brand-tint/30 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold text-brand-navy">
          <MessageCircleQuestion className="h-3.5 w-3.5" /> Your doubt
          {unread && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">New reply</span>}
        </p>
        {thread && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              thread.status === "RESOLVED"
                ? "bg-emerald-100 text-emerald-800"
                : thread.status === "ANSWERED"
                  ? "bg-sky-100 text-sky-800"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {statusLabel(thread.status, "student")}
          </span>
        )}
      </div>

      {thread?.messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-md border p-2 ${m.fromTutor ? "border-brand-blue/30 bg-white" : "border-brand-border bg-brand-page"}`}
        >
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink/60">
            {m.fromTutor ? "Your tutor" : "You"} &middot;{" "}
            {new Date(m.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
          </p>
          <p className="whitespace-pre-line text-sm text-brand-ink">{m.body}</p>
        </div>
      ))}

      {thread?.status !== "RESOLVED" && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={thread ? "Reply to your tutor" : "What is unclear about this question?"}
            aria-label="Your doubt"
            className="w-full rounded-md border border-brand-border bg-white p-2 text-sm focus-ring"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={busy || !text.trim()} onClick={send} className="h-8 bg-brand-navy text-xs text-white">
              {busy ? "Sending…" : thread ? "Send" : "Ask"}
            </Button>
            {thread && thread.messages.some((m) => m.fromTutor) && (
              <button type="button" disabled={busy} onClick={() => resolve(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline">
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark as resolved
              </button>
            )}
            {!thread && (
              <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-brand-ink/60 hover:underline">
                Cancel
              </button>
            )}
          </div>
        </>
      )}
      {thread?.status === "RESOLVED" && (
        <button type="button" disabled={busy} onClick={() => resolve(false)} className="text-[11px] font-semibold text-brand-blue hover:underline">
          Reopen
        </button>
      )}
      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
