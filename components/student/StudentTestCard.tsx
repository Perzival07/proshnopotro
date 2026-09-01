import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubjectIcon } from "@/components/SubjectIcon";
import { AtomMark } from "@/components/brand/AtomMark";
import { formatDate, formatDateShort } from "@/lib/utils";
import { Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight, Lock } from "lucide-react";

export type CardStatus = "AVAILABLE" | "SUBMITTED" | "CLOSED";

interface StudentTestCardProps {
  assignment: {
    id: string;
    dueAt: Date;
    status: "ASSIGNED" | "SUBMITTED";
    test: {
      id: string;
      title: string;
      subject: string;
      description?: string | null;
      iconName: string;
      active: boolean;
    };
    result?: {
      score: number;
      maxScore: number;
      submittedAt: Date;
    } | null;
  };
}

export function StudentTestCard({ assignment }: StudentTestCardProps) {
  const { test, result, dueAt } = assignment;
  const isPastDue = new Date() > new Date(dueAt);
  const isSubmitted = assignment.status === "SUBMITTED" || result != null;
  const isInactive = !test.active;

  let cardStatus: CardStatus = "AVAILABLE";
  let reasonText = "";

  if (isSubmitted) {
    cardStatus = "SUBMITTED";
    reasonText = "Already submitted";
  } else if (isInactive) {
    cardStatus = "CLOSED";
    reasonText = "Test deactivated by tutor";
  } else if (isPastDue) {
    cardStatus = "CLOSED";
    reasonText = `Deadline passed ${formatDateShort(dueAt)}`;
  }

  const isInteractive = cardStatus === "AVAILABLE";

  return (
    <div
      className={`group flex flex-col rounded-xl border border-brand-border bg-white shadow-card transition-all duration-200 ${
        isInteractive
          ? "hover:shadow-card-hover hover:border-brand-blue/40"
          : "opacity-90"
      }`}
    >
      {/* Pale Tint Thumbnail Block */}
      <div
        className={`relative flex items-center justify-between p-5 rounded-t-xl bg-brand-tint border-b border-brand-border/60 overflow-hidden ${
          !isInteractive ? "opacity-65" : ""
        }`}
      >
        {/* Subject Icon & Tag */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-xs border border-brand-border/50 text-brand-navy">
            <SubjectIcon name={test.iconName} className="h-6 w-6 stroke-[2]" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue block">
              {test.subject}
            </span>
            <span className="text-[11px] text-brand-ink/60 flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3" />
              Due {formatDateShort(dueAt)}
            </span>
          </div>
        </div>

        {/* Faint AtomMark Watermark in the corner of thumbnail block */}
        <div className="absolute right-[-10px] bottom-[-15px] pointer-events-none opacity-[0.12] transition-transform duration-500 group-hover:scale-110">
          <AtomMark size={90} strokeColor="#0A4B8C" dotColor="#2E9CD8" />
        </div>

        {/* Status Badge */}
        <div className="relative z-10">
          {cardStatus === "AVAILABLE" && (
            <Badge variant="available" className="gap-1 shadow-xs">
              <Clock className="h-3 w-3" />
              Available
            </Badge>
          )}
          {cardStatus === "SUBMITTED" && (
            <Badge variant="submitted" className="gap-1 shadow-xs">
              <CheckCircle2 className="h-3 w-3" />
              Submitted
            </Badge>
          )}
          {cardStatus === "CLOSED" && (
            <Badge variant="closed" className="gap-1 shadow-xs">
              <Lock className="h-3 w-3" />
              Closed
            </Badge>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
        <div>
          <h3
            className={`font-heading text-lg font-semibold leading-snug line-clamp-2 ${
              isInteractive ? "text-brand-navy" : "text-brand-ink/80"
            }`}
          >
            {test.title}
          </h3>

          {test.description ? (
            <p className="text-body text-sm text-brand-ink/75 mt-1.5 line-clamp-2">
              {test.description}
            </p>
          ) : (
            <p className="text-xs text-brand-ink/50 mt-1.5 italic">
              Google Form online test
            </p>
          )}
        </div>

        {/* Score display for submitted items */}
        {cardStatus === "SUBMITTED" && result && (
          <div className="p-3 bg-brand-page rounded-lg border border-brand-border/80 flex items-center justify-between">
            <span className="text-xs font-medium text-brand-ink/70">
              Recorded Score
            </span>
            <span className="font-heading font-bold text-sm text-[#085041]">
              {result.score} / {result.maxScore}
            </span>
          </div>
        )}

        {/* Card Footer / Action */}
        <div className="pt-2 border-t border-brand-border/40">
          {isInteractive ? (
            <Button
              asChild
              className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white font-medium shadow-sm transition-all"
            >
              <Link
                href={`/test/${assignment.id}`}
                className="flex items-center justify-center gap-2"
              >
                <span>Take Assessment</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          ) : (
            <div className="flex items-center justify-between py-1 text-xs text-brand-ink/65 font-medium">
              <span className="text-brand-ink/50">Status:</span>
              <span className="italic">{reasonText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
