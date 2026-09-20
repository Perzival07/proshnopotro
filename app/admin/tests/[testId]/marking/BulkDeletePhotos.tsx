"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteReturnedPhotos } from "@/app/admin/mark/actions";
import { Trash2 } from "lucide-react";

/**
 * Deletes the photos of every copy already returned to the student, in one go:
 * the quickest way to free storage once a batch is marked. Copies still to be
 * marked or returned are never touched.
 */
export function BulkDeletePhotos({ testId, copies, photos }: { testId: string; copies: number; photos: number }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [left, setLeft] = useState(photos);

  if (left === 0 && !message) return null;

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await deleteReturnedPhotos(testId);
      if (res.error) {
        setMessage({ tone: "error", text: res.error });
        if (res.removed) setLeft((n) => Math.max(0, n - res.removed!));
      } else {
        setMessage({ tone: "ok", text: `Deleted ${res.removed} ${res.removed === 1 ? "photo" : "photos"} from ${res.copies} ${res.copies === 1 ? "copy" : "copies"}.` });
        setLeft(0);
      }
      setConfirming(false);
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server. Nothing was deleted." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-white p-4 text-xs shadow-card">
      <p className="font-semibold text-red-800">Free up storage</p>
      {left > 0 && !confirming && (
        <>
          <p className="text-brand-ink/70">
            {copies} returned {copies === 1 ? "copy has" : "copies have"} {left} answer {left === 1 ? "photo" : "photos"} stored. Delete them once you no longer need them.
            Marks, comments and feedback stay; copies still to mark or return are not touched.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)} className="h-8 gap-1.5 border-red-300 text-xs text-red-700 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete photos of returned copies
          </Button>
        </>
      )}
      {left > 0 && confirming && (
        <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-2.5 text-red-900">
          <p className="font-semibold">Delete {left} {left === 1 ? "photo" : "photos"} from {copies} returned {copies === 1 ? "copy" : "copies"} for good?</p>
          <p>They cannot be brought back, and those students will no longer see their marked pages. They keep their marks and your comments.</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={run} className="h-8 bg-red-600 text-xs font-semibold text-white hover:bg-red-700">
              {busy ? "Deleting…" : "Yes, delete them"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)} className="h-8 text-xs">
              Keep them
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p className={message.tone === "ok" ? "text-emerald-700" : "text-red-700"}>{message.text}</p>
      )}
    </div>
  );
}
