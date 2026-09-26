"use client";

import React, { useEffect, useState } from "react";
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
import { deleteTest, getTestDeletionImpact, type TestDeletionImpact } from "./actions";
import { AlertTriangle, Power, Trash2 } from "lucide-react";

interface DeleteTestDialogProps {
  test: { id: string; title: string; active: boolean } | null;
  onClose: () => void;
  /** Turn the test off instead, keeping everything. */
  onDeactivate: (id: string) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Deleting a test is permanent and, once students have taken it, destroys
 * their work. So the dialog first says exactly what goes with it, offers
 * turning the test off as the safer alternative, and only deletes once the
 * tutor has typed the test's name.
 */
export function DeleteTestDialog({ test, onClose, onDeactivate }: DeleteTestDialogProps) {
  const [impact, setImpact] = useState<TestDeletionImpact | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImpact(null);
    setTyped("");
    setError(null);
    if (!test) return;
    let cancelled = false;
    getTestDeletionImpact(test.id)
      .then((res) => {
        if (cancelled) return;
        if (res.error) setError(res.error);
        else setImpact(res.impact ?? null);
      })
      .catch(() => !cancelled && setError("Could not reach the server."));
    return () => {
      cancelled = true;
    };
  }, [test]);

  if (!test) return null;

  const taken = !!impact && (impact.started > 0 || impact.submitted > 0 || impact.scores > 0);
  const matches = typed.trim().toLowerCase() === test.title.trim().toLowerCase();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteTest(test.id, typed);
      if (res.error) setError(res.error);
      else onClose();
    } catch {
      setError("Could not reach the server. Nothing was deleted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="h-5 w-5" /> Delete this test?
          </DialogTitle>
          <DialogDescription className="font-medium text-brand-navy">{test.title}</DialogDescription>
        </DialogHeader>

        {!impact && !error && <p className="py-4 text-xs text-brand-ink/60">Checking what this test holds&hellip;</p>}

        {impact && (
          <div className="space-y-3 text-xs">
            <div
              className={`space-y-2 rounded-lg border p-3 ${
                taken ? "border-red-300 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                {taken
                  ? "Students have already taken this test. Deleting it permanently erases their work."
                  : "This permanently deletes the test."}
              </p>
              <ul className="list-disc space-y-0.5 pl-6">
                {impact.questions > 0 && <li>{plural(impact.questions, "question", "questions")} written in the portal</li>}
                <li>
                  {plural(impact.assigned, "student assignment", "student assignments")}
                  {impact.assigned > 0 && " — it disappears from their dashboards"}
                </li>
                {impact.submitted > 0 && <li>{plural(impact.submitted, "submitted attempt", "submitted attempts")} and their saved answers</li>}
                {impact.scores > 0 && <li>{plural(impact.scores, "recorded score", "recorded scores")}, from the roster and results</li>}
                {impact.photos > 0 && <li>{plural(impact.photos, "photo", "photos")} of students&apos; answer sheets</li>}
              </ul>
              <p className="font-semibold">This cannot be undone.</p>
            </div>

            {impact.assigned > 0 && test.active && (
              <div className="flex items-start gap-2 rounded-lg border border-brand-border bg-brand-page p-3 text-brand-ink/80">
                <Power className="mt-px h-4 w-4 shrink-0 text-brand-navy" />
                <div className="space-y-1.5">
                  <p>
                    To stop students opening it but keep their scores and answers, turn the test off instead.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      onDeactivate(test.id);
                      onClose();
                    }}
                  >
                    Turn off instead
                  </Button>
                </div>
              </div>
            )}

            <label className="block space-y-1">
              <span className="font-medium text-brand-ink">
                Type the test&apos;s name, <strong className="text-brand-navy">{test.title}</strong>, to confirm:
              </span>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Test name to confirm deletion"
              />
            </label>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{error}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Keep the test
          </Button>
          <Button
            type="button"
            disabled={busy || !impact || !matches}
            onClick={confirm}
            className="bg-red-600 font-semibold text-white hover:bg-red-700"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
