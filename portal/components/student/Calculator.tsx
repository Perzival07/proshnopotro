"use client";

import React, { useRef, useState } from "react";
import { evaluate, type AngleMode } from "@/lib/calculator";
import { X } from "lucide-react";

const KEYS: { label: string; insert?: string; action?: "clear" | "back" | "equals" | "ans"; tone?: "fn" | "op" | "eq" }[][] = [
  [
    { label: "sin", insert: "sin(", tone: "fn" },
    { label: "cos", insert: "cos(", tone: "fn" },
    { label: "tan", insert: "tan(", tone: "fn" },
    { label: "log", insert: "log(", tone: "fn" },
    { label: "ln", insert: "ln(", tone: "fn" },
  ],
  [
    { label: "sin⁻¹", insert: "asin(", tone: "fn" },
    { label: "cos⁻¹", insert: "acos(", tone: "fn" },
    { label: "tan⁻¹", insert: "atan(", tone: "fn" },
    { label: "√", insert: "√(", tone: "fn" },
    { label: "xʸ", insert: "^", tone: "fn" },
  ],
  [
    { label: "(", insert: "(", tone: "fn" },
    { label: ")", insert: ")", tone: "fn" },
    { label: "π", insert: "π", tone: "fn" },
    { label: "e", insert: "e", tone: "fn" },
    { label: "n!", insert: "!", tone: "fn" },
  ],
  [
    { label: "7", insert: "7" },
    { label: "8", insert: "8" },
    { label: "9", insert: "9" },
    { label: "÷", insert: "÷", tone: "op" },
    { label: "⌫", action: "back", tone: "op" },
  ],
  [
    { label: "4", insert: "4" },
    { label: "5", insert: "5" },
    { label: "6", insert: "6" },
    { label: "×", insert: "×", tone: "op" },
    { label: "C", action: "clear", tone: "op" },
  ],
  [
    { label: "1", insert: "1" },
    { label: "2", insert: "2" },
    { label: "3", insert: "3" },
    { label: "−", insert: "−", tone: "op" },
    { label: "Ans", action: "ans", tone: "op" },
  ],
  [
    { label: "0", insert: "0" },
    { label: ".", insert: "." },
    { label: "%", insert: "%" },
    { label: "+", insert: "+", tone: "op" },
    { label: "=", action: "equals", tone: "eq" },
  ],
];

/**
 * A scientific calculator for papers that allow one, like the virtual
 * calculator on GATE's CBT. The student can type into the line or use the
 * keys; nothing leaves the page.
 */
export function Calculator({ onClose }: { onClose: () => void }) {
  const [line, setLine] = useState("");
  const [result, setResult] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AngleMode>("deg");
  const ans = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dragged by its title bar, like GATE's, so it never has to sit over the
  // question or the buttons. null = the starting corner.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const move = (ev: PointerEvent) => {
      const x = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - rect.width);
      const y = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - rect.height);
      setPos({ x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const insert = (text: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? line.length;
    const end = el?.selectionEnd ?? line.length;
    const next = line.slice(0, start) + text + line.slice(end);
    setLine(next);
    setError(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const equals = () => {
    const r = evaluate(line, mode, ans.current);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    ans.current = r.value;
    setResult(r.display);
    setError(null);
  };

  const press = (key: (typeof KEYS)[number][number]) => {
    if (key.insert) return insert(key.insert);
    if (key.action === "clear") {
      setLine("");
      setResult("0");
      setError(null);
    } else if (key.action === "back") {
      setLine((l) => l.slice(0, -1));
      setError(null);
    } else if (key.action === "ans") {
      insert("Ans");
    } else if (key.action === "equals") {
      equals();
    }
  };

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Calculator"
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`fixed z-[56] w-[272px] rounded-xl border border-brand-border bg-white p-3 shadow-xl ${pos ? "" : "bottom-3 left-3"}`}
    >
      <div
        onPointerDown={startDrag}
        className="mb-2 flex cursor-move touch-none select-none items-center justify-between"
        title="Drag to move"
      >
        <span className="text-xs font-semibold text-brand-navy">Calculator</span>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-brand-border text-[10px] font-semibold">
            {(["deg", "rad"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 uppercase ${mode === m ? "bg-brand-navy text-white" : "bg-white text-brand-ink/70"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close calculator" className="rounded p-0.5 text-brand-ink/60 hover:bg-brand-tint">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 rounded-md border border-brand-border bg-brand-page px-2 py-1.5 text-right">
        <input
          ref={inputRef}
          value={line}
          onChange={(e) => {
            setLine(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              equals();
            }
          }}
          inputMode="none"
          aria-label="Calculation"
          placeholder="0"
          className="w-full bg-transparent text-right font-mono text-sm text-brand-ink outline-none"
        />
        <p className={`truncate font-mono text-lg font-bold ${error ? "text-sm font-medium text-red-700" : "text-brand-navy"}`}>
          {error ?? result}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {KEYS.flat().map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={() => press(key)}
            className={`h-9 rounded-md text-sm font-semibold transition-colors ${
              key.tone === "eq"
                ? "bg-[#1ea55b] text-white hover:bg-[#188a4b]"
                : key.tone === "op"
                  ? "bg-brand-tint text-brand-navy hover:bg-brand-tint/70"
                  : key.tone === "fn"
                    ? "bg-slate-100 text-[12px] text-brand-ink hover:bg-slate-200"
                    : "border border-brand-border bg-white text-brand-ink hover:bg-brand-page"
            }`}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
