import React from "react";

/**
 * Scores over time as a line: each test a point at its percentage, oldest on
 * the left. Plain SVG, so it renders on the server and prints.
 */
export function ProgressChart({ points }: { points: { label: string; pct: number }[] }) {
  if (points.length === 0) return null;
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (p: number) => pad.t + (1 - Math.min(Math.max(p, 0), 1)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(p.pct)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Scores over time, as percentages">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={pad.l - 6} y={y(g) + 3} textAnchor="end" fontSize={10} fill="#64748b">
            {g * 100}%
          </text>
        </g>
      ))}
      <path d={line} fill="none" stroke="#0A4B8C" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.pct)} r={4} fill="#fff" stroke="#0A4B8C" strokeWidth={2} />
          <title>{`${p.label}: ${Math.round(p.pct * 100)}%`}</title>
        </g>
      ))}
      {points.length <= 12 &&
        points.map((p, i) => (
          <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#64748b">
            {i + 1}
          </text>
        ))}
    </svg>
  );
}
