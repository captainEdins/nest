"use client";

/** NEST logo mark (public/nest-logo.svg inlined — no raster images, D-006). */

export function NestLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      role="img"
      aria-label="NEST"
      className={className}
    >
      <rect width="128" height="128" rx="28" fill="#0B6B3A" />
      <g
        stroke="#F7F3E8"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M36 62 L64 38 L92 62" />
        <path d="M44 60 V92 H84 V60" />
        <path d="M57 92 V74 H71 V92" fill="#F7F3E8" stroke="none" opacity="0.25" />
        <path d="M40 84 C48 96 80 96 88 84" opacity="0.55" />
        <path d="M36 88 C46 104 82 104 92 88" opacity="0.35" />
      </g>
    </svg>
  );
}
