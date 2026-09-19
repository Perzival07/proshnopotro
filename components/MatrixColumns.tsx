import React from "react";
import { RichText } from "@/components/RichText";

interface Entry {
  id: string;
  text: string;
}

/** Column I and Column II of a matrix-match question, side by side. */
export function MatrixColumns({ rows, columns }: { rows: Entry[]; columns: Entry[] }) {
  const list = (title: string, entries: Entry[]) => (
    <div className="min-w-0 flex-1 rounded-md border border-brand-border bg-white">
      <p className="border-b border-brand-border bg-brand-page px-2.5 py-1 text-[11px] font-semibold text-brand-navy">{title}</p>
      <ul className="divide-y divide-brand-border/60">
        {entries.map((e) => (
          <li key={e.id} className="flex items-start gap-2 px-2.5 py-1.5 text-sm">
            <span className="mt-0.5 shrink-0 text-xs font-bold text-brand-navy">({e.id})</span>
            <RichText tall text={e.text} className="min-w-0 flex-1" />
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {list("Column I", rows)}
      {list("Column II", columns)}
    </div>
  );
}
