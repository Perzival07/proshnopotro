import { Camera, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import clsx from "clsx";

// Question palette states, as on NTA's computer-based test.
type Cell = "answered" | "not-answered" | "review" | "not-visited" | "current";

const palette: Cell[] = [
  "answered", "answered", "not-answered", "answered", "review",
  "answered", "current", "not-visited", "not-visited", "not-visited",
  "not-visited", "not-visited", "not-visited", "not-visited", "not-visited",
  "not-visited", "not-visited", "not-visited", "not-visited", "not-visited",
];

const cellStyle: Record<Cell, string> = {
  answered: "bg-emerald-500 text-white rounded-t-lg rounded-b-sm",
  "not-answered": "bg-rose-500 text-white rounded-b-lg rounded-t-sm",
  review: "bg-brand-500 text-white rounded-full",
  "not-visited": "bg-slate-100 text-slate-500 border border-slate-200 rounded-md",
  current: "bg-white text-brand-700 border-2 border-brand-500 rounded-md",
};

const options = [
  { key: "A", text: "10 m" },
  { key: "B", text: "20 m", chosen: true },
  { key: "C", text: "40 m" },
  { key: "D", text: "80 m" },
];

/** A static picture of a student mid-exam, drawn in HTML. */
export function ExamMock() {
  return (
    <div className="relative mx-auto w-full max-w-xl sm:pb-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-brand-900/15">
        {/* Title bar */}
        <div className="flex items-center justify-between gap-3 bg-brand-900 px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">Physics · Unit Test 3</p>
            <p className="text-[11px] text-white/60">Section A · Single correct</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-mono text-sm tabular-nums">
            <Clock className="h-3.5 w-3.5 text-accent-400" />
            <span>
              01:12<span className="animate-tick">:</span>45
            </span>
          </div>
        </div>

        <div className="grid gap-0 sm:grid-cols-[1fr_168px]">
          {/* Question */}
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Question 7</span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">+4 / −1</span>
            </div>
            <p className="text-sm leading-relaxed text-ink">
              A ball is thrown straight up at 20 m/s. Taking g = 10 m/s², how high does it rise?
            </p>
            <ul className="space-y-2">
              {options.map((o) => (
                <li
                  key={o.key}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                    o.chosen ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 text-slate-700"
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-5 w-5 items-center justify-center rounded-full border text-[11px]",
                      o.chosen ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-slate-500"
                    )}
                  >
                    {o.key}
                  </span>
                  {o.text}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <span className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white">Save &amp; next</span>
              <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                Mark for review
              </span>
            </div>
          </div>

          {/* Palette */}
          <div className="hidden border-l border-slate-100 bg-slate-50/70 p-4 sm:block">
            <p className="mb-3 text-[11px] font-semibold text-slate-500">Questions</p>
            <div className="grid grid-cols-4 gap-1.5">
              {palette.map((state, i) => (
                <span
                  key={i}
                  className={clsx("flex h-7 items-center justify-center text-[11px] font-semibold", cellStyle[state])}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-[10px] text-slate-500">
              <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Answered</p>
              <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Not answered</p>
              <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" />For review</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -bottom-3 left-4 hidden animate-float items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink shadow-lg sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Camera className="h-4 w-4" />
        </span>
        Face check passed
      </div>
      <div
        className="absolute -bottom-3 right-4 hidden animate-float items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink shadow-lg sm:flex"
        style={{ animationDelay: "1.5s" }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ShieldCheck className="h-4 w-4" />
        </span>
        Tab switch 0 of 2
      </div>
      {/* Centred by the wrapper: the float animation owns the badge's transform. */}
      <div className="absolute -top-5 left-1/2 hidden -translate-x-1/2 sm:block">
        <div
          className="flex animate-float items-center gap-2 whitespace-nowrap rounded-xl bg-accent-500 px-3 py-2 text-xs font-semibold text-white shadow-lg"
          style={{ animationDelay: "3s" }}
        >
          <CheckCircle2 className="h-4 w-4 text-white" />
          Auto-marked the moment it closes
        </div>
      </div>
    </div>
  );
}
