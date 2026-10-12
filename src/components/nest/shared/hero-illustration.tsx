"use client";

/**
 * HeroIllustration (Phase 17, D-030 — the warm canvas) — the reference
 * dashboard's architectural visual, translated into NEST's story: TWO PLOTS
 * (a block of flats + a smaller house — the Phase 14 portfolio demo), a sun,
 * a tree, quiet clouds. Flat geometric shapes, brand greens + one amber sun.
 *
 * Every fill is a CSS-variable utility (fill-primary/70 etc.) so the whole
 * scene re-themes with dark mode; ~30 shapes, ~2KB of markup, no image
 * payload, no runtime. Decorative by contract: aria-hidden, pointer-events
 * none, hidden below lg (mobile vertical space is data space).
 */

import { cn } from "@/lib/utils";

export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 190"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={cn("w-full h-auto pointer-events-none select-none", className)}
    >
      {/* Sun — the one warm accent (chart amber), echoing the reference's
          illustration warmth without leaving the brand palette. */}
      <circle cx={278} cy={44} r={22} className="fill-chart-2/70" />
      <circle cx={278} cy={44} r={30} className="fill-chart-2/20" />

      {/* Clouds — soft neutral puffs (foreground at low alpha re-themes). */}
      <g className="fill-foreground/8">
        <rect x={30} y={34} width={52} height={10} rx={5} />
        <rect x={44} y={26} width={30} height={12} rx={6} />
        <rect x={150} y={22} width={44} height={9} rx={4.5} />
        <rect x={160} y={15} width={26} height={11} rx={5.5} />
      </g>

      {/* Ground — a soft hill line the buildings sit on. */}
      <path
        d="M 8 168 Q 90 148 160 160 Q 240 172 312 156 L 312 178 L 8 178 Z"
        className="fill-primary/10"
      />

      {/* Plot 1 — the flats (Baraka): tall block, deep green. */}
      <g>
        <rect x={64} y={44} width={64} height={124} rx={6} className="fill-primary/85" />
        {/* Windows — cream on the green block; a few amber "evening lights". */}
        <g className="fill-primary-foreground/75">
          <rect x={74} y={56} width={10} height={12} rx={2} />
          <rect x={96} y={56} width={10} height={12} rx={2} />
          <rect x={74} y={82} width={10} height={12} rx={2} />
          <rect x={96} y={82} width={10} height={12} rx={2} />
          <rect x={74} y={108} width={10} height={12} rx={2} />
          <rect x={96} y={108} width={10} height={12} rx={2} />
          <rect x={74} y={134} width={10} height={12} rx={2} />
          <rect x={96} y={134} width={10} height={12} rx={2} />
        </g>
        <g className="fill-chart-2/85">
          <rect x={96} y={108} width={10} height={12} rx={2} />
          <rect x={74} y={82} width={10} height={12} rx={2} />
        </g>
        {/* Entrance */}
        <rect x={106} y={148} width={14} height={20} rx={3} className="fill-primary-foreground/90" />
        {/* Rooftop water tank — the Kenyan flats skyline signature. */}
        <rect x={112} y={30} width={16} height={16} rx={3} className="fill-primary/70" />
        <rect x={115} y={22} width={10} height={10} rx={2} className="fill-primary/50" />
      </g>

      {/* Plot 2 — the smaller house (Riverside): mid green + amber roof. */}
      <g>
        <rect x={196} y={112} width={70} height={56} rx={5} className="fill-chart-5/80" />
        <path d="M 190 114 L 231 82 L 272 114 Z" className="fill-chart-2/80" />
        <g className="fill-primary-foreground/75">
          <rect x={206} y={124} width={12} height={13} rx={2} />
          <rect x={226} y={124} width={12} height={13} rx={2} />
          <rect x={246} y={124} width={12} height={13} rx={2} />
        </g>
        <rect x={224} y={148} width={16} height={20} rx={3} className="fill-primary-foreground/90" />
        {/* Chimney */}
        <rect x={252} y={88} width={8} height={14} rx={2} className="fill-primary/60" />
      </g>

      {/* Tree — between the plots, the soft mid green. */}
      <g>
        <rect x={159} y={140} width={5} height={28} rx={2} className="fill-primary/50" />
        <circle cx={161.5} cy={132} r={14} className="fill-chart-5/90" />
        <circle cx={152} cy={138} r={9} className="fill-chart-5/70" />
        <circle cx={171} cy={138} r={9} className="fill-chart-5/70" />
      </g>

      {/* Fence posts along the ground line — the plot boundary. */}
      <g className="fill-primary/35">
        <rect x={16} y={156} width={4} height={12} rx={1.5} />
        <rect x={28} y={158} width={4} height={10} rx={1.5} />
        <rect x={40} y={159} width={4} height={9} rx={1.5} />
        <rect x={276} y={152} width={4} height={14} rx={1.5} />
        <rect x={288} y={154} width={4} height={12} rx={1.5} />
        <rect x={300} y={156} width={4} height={10} rx={1.5} />
      </g>
    </svg>
  );
}
