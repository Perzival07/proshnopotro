import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

/**
 * The home page's animated workflow diagrams. Pure SVG and CSS (the
 * flow-* classes in app/globals.css): dashed connectors march towards the
 * next step and dots travel along them. With reduced motion they stand still.
 */

export type FlowOutput = { label: string; color: string };

// A mirror: sources in a column on the left, what Proshnopotro gives in a
// column on the right, both spread over the same height around the core.
const CENTER = { x: 500, y: 225, r: 54 };
const INPUT_Y = [125, 225, 325];
const OUTPUT_Y = [105, 165, 225, 285, 345];
const COLUMN_LABEL_Y = 66;
const CHIP = { w: 210, h: 38 };
const LEFT = { chip: 40, dot: 282 };
const RIGHT = { dot: 718, chip: 750 };

const inPath = (y: number) => `M${LEFT.dot + 8},${y} C390,${y} 400,${CENTER.y} ${CENTER.x - CENTER.r - 8},${CENTER.y}`;
const outPath = (y: number) => `M${CENTER.x + CENTER.r + 8},${CENTER.y} C600,${CENTER.y} 610,${y} ${RIGHT.dot - 8},${y}`;

function Pulse({ path, delay, color = "#c7cbff" }: { path: string; delay: number; color?: string }) {
  return (
    <circle r="3.5" fill={color} className="flow-pulse">
      <animateMotion dur="2.6s" begin={`${delay}s`} repeatCount="indefinite" path={path} />
    </circle>
  );
}

/** Sources flow into Proshnopotro and out to what it does, as on wazo.one. */
export function PlatformFlow({
  eyebrow,
  headline,
  inputs,
  outputs,
}: {
  eyebrow: string;
  headline: string;
  inputs: string[];
  outputs: FlowOutput[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-night-900/70 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-dot-grid-dark" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/25 blur-3xl" />
      </div>

      {/* The card the diagram hangs from */}
      <div className="relative mx-auto flex max-w-xl items-center gap-4 rounded-2xl border border-white/10 bg-night-800/90 px-5 py-4 shadow-lg">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-600 font-bengali text-lg font-bold text-white">
          প্র
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">{eyebrow}</p>
          <p className="mt-0.5 text-sm font-medium text-white sm:text-[15px]">{headline}</p>
        </div>
      </div>

      {/* Wide screens: the full diagram */}
      <svg viewBox="0 0 1000 380" className="relative hidden w-full md:block" role="img" aria-label={`${inputs.join(", ")} flow into Proshnopotro, which gives ${outputs.map((o) => o.label).join(", ")}`}>
        <defs>
          <radialGradient id="flow-core" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#7f85fb" />
            <stop offset="100%" stopColor="#3730c2" />
          </radialGradient>
          {/* In page units: a straight, flat line has no height to size a gradient by. */}
          <linearGradient id="flow-in" gradientUnits="userSpaceOnUse" x1={LEFT.dot} y1="0" x2={CENTER.x - CENTER.r} y2="0">
            <stop offset="0%" stopColor="#a8aefc" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#a8aefc" />
          </linearGradient>
        </defs>

        {/* From the card down to the core */}
        <path d={`M500,0 L500,${CENTER.y - CENTER.r - 10}`} stroke="#7f85fb" strokeOpacity="0.5" strokeWidth="1.5" fill="none" className="flow-line" />

        {/* Inputs, on the left */}
        <text x={LEFT.chip} y={COLUMN_LABEL_Y} fill="#8b90b8" fontSize="11" fontWeight="600" letterSpacing="2.2">
          PAPERS COME IN FROM
        </text>
        {inputs.map((label, i) => {
          const y = INPUT_Y[i];
          return (
            <g key={label}>
              <rect x={LEFT.chip} y={y - CHIP.h / 2} width={CHIP.w} height={CHIP.h} rx="10" fill="#11142a" stroke="rgba(255,255,255,0.12)" />
              <text x={LEFT.chip + 18} y={y + 5} fill="#e6e8ff" fontSize="14" fontWeight="500">
                {label}
              </text>
              <path d={`M${LEFT.chip + CHIP.w},${y} L${LEFT.dot - 8},${y}`} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
              <circle cx={LEFT.dot} cy={y} r="7" fill="#05060e" stroke="#a8aefc" strokeWidth="2" />
              <circle cx={LEFT.dot} cy={y} r="2.5" fill="#a8aefc" />
              <path d={inPath(y)} stroke="url(#flow-in)" strokeWidth="2" fill="none" className="flow-line" />
              <Pulse path={inPath(y)} delay={i * 0.5} />
            </g>
          );
        })}

        {/* Outputs, on the right */}
        <text x={RIGHT.chip + CHIP.w} y={COLUMN_LABEL_Y} textAnchor="end" fill="#8b90b8" fontSize="11" fontWeight="600" letterSpacing="2.2">
          WHAT YOU GET
        </text>
        {outputs.map(({ label, color }, i) => {
          const y = OUTPUT_Y[i];
          return (
            <g key={label}>
              <path d={outPath(y)} stroke={color} strokeOpacity="0.7" strokeWidth="2" fill="none" className="flow-line" />
              <Pulse path={outPath(y)} delay={1.2 + i * 0.35} color={color} />
              <circle cx={RIGHT.dot} cy={y} r="7" fill="#05060e" stroke={color} strokeWidth="2" />
              <circle cx={RIGHT.dot} cy={y} r="2.5" fill={color} />
              <path d={`M${RIGHT.dot + 8},${y} L${RIGHT.chip},${y}`} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
              <rect x={RIGHT.chip} y={y - CHIP.h / 2} width={CHIP.w} height={CHIP.h} rx="10" fill="#11142a" stroke="rgba(255,255,255,0.12)" />
              <circle cx={RIGHT.chip + 20} cy={y} r="4.5" fill={color} />
              <text x={RIGHT.chip + 34} y={y + 5} fill="#e6e8ff" fontSize="14" fontWeight="500">
                {label}
              </text>
            </g>
          );
        })}

        {/* The core */}
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={CENTER.r}
          fill="none"
          stroke="#7f85fb"
          strokeWidth="2"
          className="animate-node-pulse"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
        <circle cx={CENTER.x} cy={CENTER.y} r={CENTER.r + 10} fill="rgba(88,93,249,0.12)" stroke="rgba(168,174,252,0.25)" />
        <circle cx={CENTER.x} cy={CENTER.y} r={CENTER.r} fill="url(#flow-core)" />
        <text x={CENTER.x} y={CENTER.y + 4} textAnchor="middle" fill="#fff" fontSize="30" fontWeight="700" className="font-bengali">
          প্র
        </text>
        <text x={CENTER.x} y={CENTER.y + 26} textAnchor="middle" fill="#e6e8ff" fontSize="10" fontWeight="600" letterSpacing="1.5">
          PROSHNOPOTRO
        </text>
      </svg>

      {/* Phones: the same flow, top to bottom */}
      <div className="relative mt-2 flex flex-col items-center md:hidden" aria-hidden="true">
        <div className="flow-vline h-8 w-0.5" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Papers come in from</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {inputs.map((label) => (
            <span key={label} className="rounded-lg border border-white/10 bg-night-800 px-3 py-1.5 text-xs font-medium text-brand-100">
              {label}
            </span>
          ))}
        </div>
        <VerticalLink />
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-node-pulse rounded-full border-2 border-brand-400" />
          <span className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg shadow-brand-500/40">
            <span className="font-bengali text-2xl font-bold leading-none">প্র</span>
          </span>
        </span>
        <VerticalLink />
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">What you get</p>
        <div className="grid w-full grid-cols-2 gap-2">
          {outputs.map(({ label, color }) => (
            <span key={label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-night-800 px-3 py-2 text-xs font-semibold text-slate-200">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function VerticalLink() {
  return (
    <span className="relative my-2 block h-10 w-0.5">
      <span className="flow-vline absolute inset-0" />
      <span className="flow-traveller absolute -ml-[3px] -mt-1 h-2 w-2 rounded-full bg-brand-200 shadow-[0_0_10px_2px_rgba(168,174,252,0.8)]" />
    </span>
  );
}

function HorizontalLink() {
  return (
    <span className="relative mx-1 block h-0.5 min-w-6 flex-1 self-center">
      <span className="flow-hline absolute inset-0" />
      <span className="flow-traveller absolute -ml-1 -mt-[3px] h-2 w-2 rounded-full bg-brand-200 shadow-[0_0_10px_2px_rgba(168,174,252,0.8)]" />
    </span>
  );
}

export type PipelineStep = { icon: LucideIcon; title: string; body: string };

/** Steps joined by marching connectors: across on wide screens, down on phones. */
export function Pipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="flex flex-col items-stretch lg:flex-row">
      {steps.map(({ icon: Icon, title, body }, i) => (
        <li key={title} className="flex flex-col items-center lg:flex-1 lg:flex-row lg:items-stretch">
          <div className="group relative w-full max-w-sm rounded-2xl border border-white/10 bg-night-800/80 p-4 text-left transition hover:border-brand-400/50 hover:bg-night-700/80 lg:w-auto lg:max-w-none lg:flex-1">
            <div className="flex items-center justify-between">
              <span
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-xl text-white",
                  i === steps.length - 1 ? "bg-gradient-to-br from-accent-400 to-accent-600" : "bg-gradient-to-br from-brand-400 to-brand-600"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-mono text-xs font-semibold text-slate-500 transition group-hover:text-brand-300">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="mt-3 font-semibold text-white">{title}</h3>
            <p className="mt-1 text-[13px] leading-snug text-slate-400">{body}</p>
          </div>
          {i < steps.length - 1 && (
            <>
              <span className="lg:hidden" aria-hidden="true">
                <VerticalLink />
              </span>
              <span className="hidden w-8 shrink-0 self-stretch lg:flex" aria-hidden="true">
                <HorizontalLink />
              </span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
