"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSeries, deleteSeries, renameSeries, setTestSeries } from "./actions";
import { Layers, Plus, Trash2, X } from "lucide-react";

interface SeriesTest {
  id: string;
  title: string;
  subject: string;
  assigned?: number;
}
interface Series {
  id: string;
  name: string;
  description: string | null;
  tests: SeriesTest[];
}

export function SeriesClient({ initial, loose: initialLoose }: { initial: Series[]; loose: SeriesTest[] }) {
  const [series, setSeries] = useState(initial);
  const [loose, setLoose] = useState(initialLoose);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guard = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.error) setError(res.error);
      return !res.error;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    let id: string | undefined;
    const ok = await guard(async () => {
      const res = await createSeries(name, description);
      id = res.id;
      return res;
    });
    if (ok && id) {
      setSeries((s) => [{ id: id!, name: name.trim(), description: description.trim() || null, tests: [] }, ...s]);
      setName("");
      setDescription("");
    }
  };

  const add = async (seriesId: string) => {
    const testId = picked[seriesId];
    if (!testId) return;
    if (await guard(() => setTestSeries(testId, seriesId))) {
      const test = loose.find((t) => t.id === testId)!;
      setSeries((list) => list.map((s) => (s.id === seriesId ? { ...s, tests: [...s.tests, test] } : s)));
      setLoose((l) => l.filter((t) => t.id !== testId));
      setPicked((p) => ({ ...p, [seriesId]: "" }));
    }
  };

  const remove = async (seriesId: string, test: SeriesTest) => {
    if (await guard(() => setTestSeries(test.id, null))) {
      setSeries((list) => list.map((s) => (s.id === seriesId ? { ...s, tests: s.tests.filter((t) => t.id !== test.id) } : s)));
      setLoose((l) => [{ id: test.id, title: test.title, subject: test.subject }, ...l]);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-brand-navy">Test Series</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          Group tests that belong together -- weekly tests, a full-length test series. Students see their score
          across the series as a line on their Progress page, and parents can follow it too.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-brand-border bg-white p-4 shadow-card">
        <p className="text-xs font-semibold text-brand-navy">New series</p>
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly tests 2026" className="h-9 w-64 text-xs" aria-label="Series name" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="h-9 min-w-[200px] flex-1 text-xs" aria-label="Description" />
          <Button type="button" disabled={busy || !name.trim()} onClick={create} className="h-9 gap-1.5 bg-brand-navy text-xs text-white">
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</p>}
      </div>

      {series.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          <Layers className="mx-auto mb-2 h-6 w-6 text-brand-ink/40" />
          No series yet.
        </div>
      ) : (
        series.map((s) => (
          <section key={s.id} className="rounded-xl border border-brand-border bg-white shadow-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-brand-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-sm font-semibold text-brand-navy">{s.name}</h2>
                {s.description && <p className="text-[11px] text-brand-ink/60">{s.description}</p>}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const next = window.prompt("Rename the series:", s.name);
                  if (next && next.trim() && next.trim() !== s.name && (await guard(() => renameSeries(s.id, next)))) {
                    setSeries((l) => l.map((x) => (x.id === s.id ? { ...x, name: next.trim() } : x)));
                  }
                }}
                className="text-[11px] font-semibold text-brand-blue hover:underline"
              >
                Rename
              </button>
              <button
                type="button"
                aria-label="Delete series"
                onClick={async () => {
                  if (!window.confirm(`Delete "${s.name}"? Its tests and every result stay; they just leave the series.`)) return;
                  if (await guard(() => deleteSeries(s.id))) {
                    setSeries((l) => l.filter((x) => x.id !== s.id));
                    setLoose((l) => [...s.tests.map((t) => ({ id: t.id, title: t.title, subject: t.subject })), ...l]);
                  }
                }}
                className="rounded p-1 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <ol className="divide-y divide-brand-border">
              {s.tests.length === 0 && <li className="px-4 py-3 text-xs text-brand-ink/60">No tests in this series yet.</li>}
              {s.tests.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="w-5 text-right font-mono text-xs text-brand-ink/50">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-brand-ink">{t.title}</span>
                  <span className="text-[11px] text-brand-ink/50">{t.subject}</span>
                  <button type="button" aria-label={`Remove ${t.title} from the series`} onClick={() => remove(s.id, t)} className="rounded p-1 text-brand-ink/60 hover:bg-brand-tint">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2 border-t border-brand-border px-4 py-3">
              <select
                value={picked[s.id] ?? ""}
                onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.value }))}
                aria-label={`Add a test to ${s.name}`}
                className="h-8 max-w-[300px] flex-1 rounded-md border border-brand-border bg-white px-2 text-xs"
              >
                <option value="">Add a test&hellip;</option>
                {loose.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.subject})</option>
                ))}
              </select>
              <Button type="button" size="sm" disabled={busy || !picked[s.id]} onClick={() => add(s.id)} className="h-8 bg-brand-navy text-xs text-white">
                Add
              </Button>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
