import React from "react";
import type { ProgressPoint, ProgressReport } from "@/lib/progress";
import { ProgressChart } from "@/components/student/ProgressChart";
import { chapterVerdict } from "@/lib/analytics";
import { formatDateShort } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

const fmt = (n: number) => String(Number(n.toFixed(2)));

function Trend({ points }: { points: ProgressPoint[] }) {
  if (points.length < 2) return null;
  const last = points[points.length - 1].pct;
  const before = points.slice(0, -1).reduce((n, p) => n + p.pct, 0) / (points.length - 1);
  const diff = Math.round((last - before) * 100);
  if (diff === 0) return <span className="text-xs text-brand-ink/60">Steady</span>;
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-700" : "text-red-700"}`}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {diff} points on the average before
    </span>
  );
}

function Results({ points }: { points: ProgressPoint[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-brand-border text-left text-brand-ink/60">
          <th className="py-1.5 font-medium">#</th>
          <th className="py-1.5 font-medium">Test</th>
          <th className="py-1.5 text-right font-medium">Score</th>
          <th className="py-1.5 text-right font-medium">Rank</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p, i) => (
          <tr key={p.assignmentId} className="border-b border-brand-border/50 last:border-0">
            <td className="py-1.5 text-brand-ink/50">{i + 1}</td>
            <td className="py-1.5">
              <span className="font-medium text-brand-navy">{p.title}</span>
              <span className="ml-2 text-brand-ink/50">{formatDateShort(p.date)}</span>
            </td>
            <td className="py-1.5 text-right font-mono">
              {fmt(p.score)} / {fmt(p.max)} <span className="text-brand-ink/50">({Math.round(p.pct * 100)}%)</span>
            </td>
            <td className="py-1.5 text-right">
              {p.rank ? (
                <>
                  {p.rank} of {p.of} <span className="text-brand-ink/50">({p.percentile} %ile)</span>
                </>
              ) : (
                <span className="text-brand-ink/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A student's progress: overall, by series, and by chapter. */
export function ProgressView({ report }: { report: ProgressReport }) {
  if (report.points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
        No results yet. Progress appears here as tests are marked and results are released.
      </div>
    );
  }
  const strong = report.chapters.filter((c) => chapterVerdict(c.scored, c.max) === "strong");
  const weak = report.chapters.filter((c) => chapterVerdict(c.scored, c.max) === "weak");

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold text-brand-navy">All tests</h2>
          <Trend points={report.points} />
        </div>
        <ProgressChart points={report.points.map((p) => ({ label: p.title, pct: p.pct }))} />
        <div className="mt-3">
          <Results points={report.points} />
        </div>
      </section>

      {report.series.map((s) => (
        <section key={s.id} className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-sm font-semibold text-brand-navy">{s.name}</h2>
            <Trend points={s.points} />
          </div>
          {s.points.length > 1 && <ProgressChart points={s.points.map((p) => ({ label: p.title, pct: p.pct }))} />}
          <div className="mt-3">
            <Results points={s.points} />
          </div>
        </section>
      ))}

      {report.chapters.length > 0 && (
        <section className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
          <h2 className="mb-1 font-heading text-sm font-semibold text-brand-navy">Chapters across all tests</h2>
          <p className="mb-3 text-xs text-brand-ink/70">
            {weak.length ? `Needs work: ${weak.map((c) => c.name).join(", ")}. ` : ""}
            {strong.length ? `Strong: ${strong.map((c) => c.name).join(", ")}.` : ""}
          </p>
          <table className="w-full text-xs">
            <tbody>
              {report.chapters.map((c) => {
                const pct = c.max > 0 ? Math.max(0, c.scored / c.max) : 0;
                return (
                  <tr key={c.id} className="border-b border-brand-border/50 last:border-0">
                    <td className="py-1.5 pr-2 text-brand-navy">
                      {c.name} <span className="text-brand-ink/40">{c.subject}</span>
                    </td>
                    <td className="w-32 py-1.5 pr-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-brand-tint">
                        <div
                          className={`h-full ${pct >= 0.75 ? "bg-emerald-500" : pct >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="w-12 py-1.5 text-right font-mono">{Math.round(pct * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
