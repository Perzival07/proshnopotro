"use client";

import React, { useState, useEffect } from "react";
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
import { updateStudentScore } from "@/app/admin/roster/actions";
import { AtomMark } from "@/components/brand/AtomMark";
import { Award, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export interface StudentGradeTarget {
  assignmentId: string;
  studentEmail: string;
  studentName?: string | null;
  className?: string | null;
  testTitle: string;
  currentScore?: number | null;
  currentMaxScore?: number | null;
}

interface EnterMarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: StudentGradeTarget | null;
  onSuccess?: () => void;
}

export function EnterMarksModal({
  isOpen,
  onClose,
  target,
  onSuccess,
}: EnterMarksModalProps) {
  const [score, setScore] = useState<string>("");
  const [maxScore, setMaxScore] = useState<string>("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (target) {
      setScore(
        target.currentScore !== null && target.currentScore !== undefined
          ? String(target.currentScore)
          : ""
      );
      setMaxScore(
        target.currentMaxScore !== null && target.currentMaxScore !== undefined
          ? String(target.currentMaxScore)
          : "50"
      );
      setError(null);
      setSuccess(false);
    }
  }, [target]);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedScore = parseFloat(score);
    const parsedMax = parseFloat(maxScore);

    if (isNaN(parsedScore)) {
      setError("Please enter a valid numeric score.");
      return;
    }
    if (isNaN(parsedMax) || parsedMax <= 0) {
      setError("Please enter a valid maximum score greater than 0.");
      return;
    }
    if (parsedScore < 0) {
      setError("Score cannot be negative.");
      return;
    }
    if (parsedScore > parsedMax) {
      setError(`Score (${parsedScore}) cannot be greater than Max Score (${parsedMax}).`);
      return;
    }

    setLoading(true);

    try {
      const res = await updateStudentScore(
        target.assignmentId,
        parsedScore,
        parsedMax,
        target.studentEmail
      );

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 700);
    } catch (err) {
      setError("Failed to save score. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const percentage =
    !isNaN(parseFloat(score)) && !isNaN(parseFloat(maxScore)) && parseFloat(maxScore) > 0
      ? Math.round((parseFloat(score) / parseFloat(maxScore)) * 100)
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-brand-navy">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint border border-brand-blue/30 text-brand-navy">
              <Award className="h-5 w-5 text-brand-blue" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-heading text-brand-navy">
                {target.currentScore !== null && target.currentScore !== undefined
                  ? "Update Marks & Grade"
                  : "Enter Student Marks"}
              </DialogTitle>
              <DialogDescription className="text-xs text-brand-ink/70">
                Record score for checked copy. Automatically marks as Submitted.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Student & Test Info Card */}
        <div className="p-3 bg-brand-page rounded-lg border border-brand-border/70 space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-brand-navy">
              {target.studentName || "Student"}
            </span>
            {target.className && (
              <span className="px-2 py-0.5 rounded bg-brand-tint font-medium text-[11px] text-brand-navy">
                {target.className}
              </span>
            )}
          </div>
          <div className="text-brand-ink/60 font-mono text-[11px]">
            {target.studentEmail}
          </div>
          <div className="text-brand-blue font-medium pt-1 text-[11px]">
            Assessment: {target.testTitle}
          </div>
        </div>

        {error && (
          <div className="p-2.5 text-xs bg-red-50 text-red-800 border border-red-200 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-2.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Marks saved successfully! Assignment marked as Submitted.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            {/* Score Input */}
            <div className="space-y-1.5">
              <Label htmlFor="manual-score" className="text-xs font-semibold text-brand-navy">
                Marks Obtained *
              </Label>
              <Input
                id="manual-score"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 42.5"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                autoFocus
                required
                className="font-mono text-sm font-semibold h-10"
              />
            </div>

            {/* Max Score Input */}
            <div className="space-y-1.5">
              <Label htmlFor="manual-max-score" className="text-xs font-semibold text-brand-navy">
                Total / Max Marks *
              </Label>
              <Input
                id="manual-max-score"
                type="number"
                step="any"
                min="1"
                placeholder="e.g. 50"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                required
                className="font-mono text-sm font-semibold h-10"
              />
            </div>
          </div>

          {/* Quick Stats / Percentage Preview */}
          {percentage !== null && (
            <div className="flex items-center justify-between px-3 py-2 bg-brand-tint/60 rounded-md border border-brand-blue/20 text-xs">
              <span className="text-brand-navy font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand-blue" />
                Calculated Percentage:
              </span>
              <span className="font-mono font-bold text-brand-navy text-sm">
                {percentage}%
              </span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || success}
              className="bg-brand-navy hover:bg-brand-navy/90 text-white text-xs font-medium gap-1.5"
            >
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Saving...</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Save & Mark Completed</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
