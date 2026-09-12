"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reassignAssignment } from "@/app/admin/roster/actions";
import { AtomMark } from "@/components/brand/AtomMark";
import { toDateTimeLocalValue } from "@/lib/utils";
import { RotateCcw, AlertTriangle, Calendar, Info } from "lucide-react";

export interface ReassignTarget {
  assignmentId: string;
  studentEmail: string;
  studentName?: string | null;
  testTitle: string;
  /** True when the timer or the tab guard ended the attempt, not the student. */
  autoSubmitted: boolean;
  /** The score on the attempt being replaced, if one was recorded. */
  currentScore?: number | null;
  currentMaxScore?: number | null;
}

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReassignTarget | null;
  onSuccess?: () => void;
}

/** Same default as the assign page: a week out, end of day. */
function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return toDateTimeLocalValue(d);
}

export function ReassignModal({
  isOpen,
  onClose,
  target,
  onSuccess,
}: ReassignModalProps) {
  const [dueDate, setDueDate] = useState(defaultDeadline);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Set when the server found marks the tutor had not been warned about --
   * a score entered from another browser after this page was loaded. The
   * button then asks again rather than deleting them on the first click.
   */
  const [staleMarks, setStaleMarks] = useState<{
    score: number;
    maxScore: number;
  } | null>(null);

  useEffect(() => {
    if (target) {
      setDueDate(defaultDeadline());
      setError(null);
      setStaleMarks(null);
      setLoading(false);
    }
  }, [target]);

  const knownMarks = useMemo(() => {
    if (!target || target.currentScore == null) return null;
    return {
      score: target.currentScore,
      maxScore: target.currentMaxScore ?? 0,
    };
  }, [target]);

  if (!target) return null;

  const marksAtRisk = staleMarks ?? knownMarks;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) {
      setError("Please choose a valid new deadline.");
      return;
    }

    setLoading(true);
    try {
      // The marks warning is already on screen whenever this row carries a
      // score, so the tutor has seen it before the first click; clearMarks
      // only stays false when the client believes there is nothing to lose.
      const res = await reassignAssignment(
        target.assignmentId,
        parsed.toISOString(),
        marksAtRisk !== null
      );

      if (res.needsConfirmation) {
        setStaleMarks({ score: res.score ?? 0, maxScore: res.maxScore ?? 0 });
        setError(res.error ?? null);
        return;
      }

      if (res.error) {
        setError(res.error);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Could not reach the server to reassign this test.");
    } finally {
      setLoading(false);
    }
  };

  const studentLabel = target.studentName || target.studentEmail;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-brand-navy">
            <RotateCcw className="h-5 w-5 text-brand-blue" />
            <DialogTitle>Reassign this test</DialogTitle>
          </div>
          <DialogDescription>
            Give <strong>{studentLabel}</strong> a fresh attempt at{" "}
            <strong>{target.testTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="rounded-lg border border-brand-border bg-brand-page p-3 text-[11px] text-brand-ink/75 space-y-1.5">
            <p className="flex items-start gap-1.5">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-brand-blue" />
              <span>
                Their previous attempt was{" "}
                <strong>
                  {target.autoSubmitted
                    ? "closed automatically by the timer or the tab guard"
                    : "submitted by the student"}
                </strong>
                .
              </span>
            </p>
            <p className="pl-5">
              The countdown and the tab-switch tally both start again from zero,
              and any answer photos they uploaded are removed so they can upload
              again.
            </p>
          </div>

          <div>
            <Label
              htmlFor="reassign-due"
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy"
            >
              <Calendar className="h-3.5 w-3.5 text-brand-blue" />
              <span>
                New deadline <span className="text-red-500">*</span>
              </span>
            </Label>
            <Input
              id="reassign-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="mt-1.5 h-10 text-xs"
            />
            <p className="mt-1 text-[11px] text-brand-ink/50">
              Must be in the future, or the test closes again the moment it
              reopens.
            </p>
          </div>

          {marksAtRisk && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              <span>
                Their recorded score of{" "}
                <strong>
                  {marksAtRisk.score} / {marksAtRisk.maxScore}
                </strong>{" "}
                will be deleted, because a saved result keeps the test locked.
                Note it down first if you need it. This cannot be undone.
              </span>
            </div>
          )}

          {error && !marksAtRisk && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className={
                marksAtRisk
                  ? "bg-red-600 font-semibold text-white hover:bg-red-700"
                  : "bg-brand-navy font-semibold text-white hover:bg-brand-navy/90"
              }
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Reassigning...</span>
                </span>
              ) : marksAtRisk ? (
                "Delete marks & reassign"
              ) : (
                "Reassign test"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
