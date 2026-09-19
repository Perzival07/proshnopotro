import React from "react";
import { RichText } from "@/components/RichText";
import { MatrixColumns } from "@/components/MatrixColumns";
import type { AnswerKey, QuestionType } from "@/lib/marking";
import type { OptionRow } from "@/lib/paper";
import { CheckCircle2 } from "lucide-react";

export const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE: "Single correct",
  MULTIPLE: "One or more correct",
  INTEGER: "Integer answer",
  DECIMAL: "Decimal answer",
  MATRIX: "Matrix match",
  SUBJECTIVE: "Written answer",
};

function formatNumber(n: number) {
  return String(Number(n.toFixed(10)));
}

export function describeKey(key: AnswerKey | null): string {
  if (!key) return "No valid answer key";
  switch (key.type) {
    case "SINGLE":
    case "MULTIPLE":
      return key.options.join(", ");
    case "INTEGER":
      return key.values.join(" or ");
    case "DECIMAL":
      return key.min === key.max
        ? formatNumber(key.min)
        : `${formatNumber(key.min)} to ${formatNumber(key.max)}`;
    case "MATRIX":
      return Object.entries(key.rows)
        .map(([row, cols]) => `${row} \u2192 ${cols.join(", ")}`)
        .join(";  ");
    case "SUBJECTIVE":
      return "Marked by you from the answer photos";
  }
}

function formatMarks(correct: number, wrong: number) {
  return `+${formatNumber(correct)} / ${wrong === 0 ? "0" : `−${formatNumber(Math.abs(wrong))}`}`;
}

/**
 * One question as the tutor sees it: the text rendered as students will see
 * it, with the answer key and solution shown.
 */
export function QuestionView({
  number,
  type,
  stem,
  options,
  columns = [],
  answerKey,
  solution,
  marks,
  bonus = false,
}: {
  number: number;
  type: QuestionType;
  stem: string;
  options: OptionRow[];
  columns?: OptionRow[];
  answerKey: AnswerKey | null;
  solution: string | null;
  marks: { correct: number; wrong: number };
  bonus?: boolean;
}) {
  const correctOptions =
    answerKey && (answerKey.type === "SINGLE" || answerKey.type === "MULTIPLE")
      ? new Set(answerKey.options)
      : new Set<string>();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-heading text-sm font-bold text-brand-navy">Q{number}</span>
        <span className="rounded bg-brand-tint px-1.5 py-0.5 font-medium text-brand-navy">
          {TYPE_LABELS[type]}
        </span>
        <span className="font-mono text-brand-ink/60">{formatMarks(marks.correct, marks.wrong)}</span>
        {bonus && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
            Bonus: full marks to all who attempted
          </span>
        )}
      </div>

      <RichText text={stem} className="text-sm text-brand-ink" />

      {type === "MATRIX" && <MatrixColumns rows={options} columns={columns} />}

      {options.length > 0 && type !== "MATRIX" && (
        <ul className="space-y-1.5">
          {options.map((option) => {
            const right = correctOptions.has(option.id);
            return (
              <li
                key={option.id}
                className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                  right ? "border-emerald-300 bg-emerald-50" : "border-brand-border bg-white"
                }`}
              >
                <span className={`mt-0.5 shrink-0 text-xs font-bold ${right ? "text-emerald-700" : "text-brand-navy"}`}>
                  ({option.id})
                </span>
                <RichText tall text={option.text} className="min-w-0 flex-1" />
                {right && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              </li>
            );
          })}
        </ul>
      )}

      {(options.length === 0 || type === "MATRIX") && type !== "SUBJECTIVE" && (
        <p className="text-xs">
          <span className="font-semibold text-brand-navy">Answer: </span>
          <span className="font-mono text-emerald-700">{describeKey(answerKey)}</span>
        </p>
      )}
      {!answerKey && (
        <p className="text-xs font-semibold text-red-700">
          This question&apos;s answer key could not be read. Edit it and save the answer again.
        </p>
      )}

      {type === "SUBJECTIVE" && (
        <p className="text-xs text-brand-ink/60">Answered on paper and photographed; you mark it from the photos.</p>
      )}

      {solution && (
        <details className="rounded-md border border-brand-border bg-brand-page px-2.5 py-1.5 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-brand-navy">
            {type === "SUBJECTIVE" ? "Model answer" : "Solution"}
          </summary>
          <RichText text={solution} className="mt-2" />
        </details>
      )}
    </div>
  );
}
