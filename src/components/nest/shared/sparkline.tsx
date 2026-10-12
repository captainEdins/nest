"use client";

/**
 * Sparkline (Phase 17, D-030 — the warm canvas) — the reference dashboard's
 * KPI-card trend hint: a smooth line + gradient area, tinted by `currentColor`
 * so one component serves every tone (primary / amber / success / hero) and
 * both themes with ZERO JS theming.
 *
 * Dependency-free inline SVG (the low-end-Android rule — no chart library),
 * Catmull-Rom→bezier smoothing so 6 points read as a curve, unique gradient
 * id per instance via useId. Decorative by contract (aria-hidden): the exact
 * numbers always live in the card's delta/sub text or the chart table — a
 * sparkline only whispers direction.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const W = 96;
const H = 36;
const PAD_X = 2;
const PAD_TOP = 4;
const PAD_BOTTOM = 2;

/** Catmull-Rom spline through the points → cubic bezier path (smooth). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function Sparkline({
  values,
  className,
  strokeWidth = 2,
}: {
  /** Series in order (oldest → newest). Fewer than 2 points renders nothing. */
  values: number[];
  /** Color context — set `text-primary` / `text-attention` / etc. here. */
  className?: string;
  strokeWidth?: number;
}) {
  const gradientId = React.useId();

  const pts = React.useMemo(() => {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1; // flat series stays mid-track, not top
    const usableH = H - PAD_TOP - PAD_BOTTOM;
    return values.map((v, i) => ({
      x: PAD_X + (i / (values.length - 1)) * (W - PAD_X * 2),
      y: PAD_TOP + usableH - ((v - min) / span) * usableH,
    }));
  }, [values]);

  if (pts == null) return null;

  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1]!.x.toFixed(2)} ${H} L ${pts[0]!.x.toFixed(2)} ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point marker — the "now" dot, the reference's sparkline end cap */}
      <circle
        cx={pts[pts.length - 1]!.x}
        cy={pts[pts.length - 1]!.y}
        r={2.5}
        fill="currentColor"
      />
    </svg>
  );
}
