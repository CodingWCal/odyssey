// Line-style SVG icons, ported from the design handoff (icons.jsx).
// All inherit currentColor. Use as <Icons.flight size={16} /> etc.

import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Base({ size = 16, viewBox = "0 0 24 24", children }: { size?: number; viewBox?: string; children: ReactNode }) {
  return (
    <svg className="icon" width={size} height={size} viewBox={viewBox} {...strokeProps} aria-hidden="true">
      {children}
    </svg>
  );
}

export const Icons = {
  flight: ({ size }: IconProps) => (
    <Base size={size}>
      <path d="M10.5 19.5 9 22l-1.5-.5L8 17l-5-2v-1.5l5-1 1-3-6-3.5V4l8 2 3-3a1.5 1.5 0 0 1 2.1 2.1l-3 3 2 8H14l-3-6-3 1-1 3 3.5 4.4Z" />
    </Base>
  ),
  hotel: ({ size }: IconProps) => (
    <Base size={size}>
      <path d="M3 20V8M3 14h18M21 20v-6a4 4 0 0 0-4-4H8a5 5 0 0 0-5 5" />
      <circle cx="8" cy="11.5" r="1.5" />
    </Base>
  ),
  restaurant: ({ size }: IconProps) => (
    <Base size={size}>
      <path d="M6 3v18M6 9h0a3 3 0 0 0 0-6h0M14 14V3c2 0 4 2 4 5s-2 4-4 4M18 14v7" />
    </Base>
  ),
  activity: ({ size }: IconProps) => (
    <Base size={size}>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      <circle cx="12" cy="12" r="4" />
    </Base>
  ),
  transport: ({ size }: IconProps) => (
    <Base size={size}>
      <rect x="4" y="4" width="16" height="13" rx="3" />
      <path d="M4 13h16M8 17v3M16 17v3" />
      <circle cx="8.5" cy="14.5" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14.5" r=".8" fill="currentColor" stroke="none" />
    </Base>
  ),
  misc: ({ size }: IconProps) => (
    <Base size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12h6M12 9v6" />
    </Base>
  ),
  clock: ({ size = 13 }: IconProps) => (
    <Base size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  ),
  pin: ({ size = 13 }: IconProps) => (
    <Base size={size}>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </Base>
  ),
  itinerary: ({ size = 16 }: IconProps) => (
    <Base size={size}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4M7 13h6M7 17h4" />
    </Base>
  ),
  schedule: ({ size = 16 }: IconProps) => (
    <Base size={size}>
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h13A1.5 1.5 0 0 1 19 5.5V11M3 9h16M8 2v4M14 2v4" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="M17 15v2l1.5 1" />
    </Base>
  ),
  map: ({ size = 16 }: IconProps) => (
    <Base size={size}>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v18M15 6v18" />
    </Base>
  ),
  budget: ({ size = 16 }: IconProps) => (
    <Base size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8.5c-.8-1-2-1.5-3.2-1.4-1.7.2-2.6 1.2-2.6 2.3 0 1.4 1.4 1.8 3 2.2s3 .8 3 2.2c0 1.2-1.2 2.3-3 2.3-1.5 0-2.8-.7-3.4-1.7M12 6v1.6M12 16.4V18" />
    </Base>
  ),
  members: ({ size = 16 }: IconProps) => (
    <Base size={size}>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M17 19a5 5 0 0 1 4-2" />
    </Base>
  ),
  chevron: ({ size = 18 }: IconProps) => (
    <Base size={size}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  ),
  arrowLeft: ({ size = 18 }: IconProps) => (
    <Base size={size}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </Base>
  ),
  plus: ({ size = 14 }: IconProps) => (
    <Base size={size}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  ),
  note: ({ size = 13 }: IconProps) => (
    <Base size={size}>
      <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
      <path d="M14 3v6h6M8 13h6M8 17h4" />
    </Base>
  ),
  drag: ({ size = 14 }: IconProps) => (
    <Base size={size}>
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  ),
  edit: ({ size = 14 }: IconProps) => (
    <Base size={size}>
      <path d="M14 4 20 10 9 21H3v-6L14 4Z" />
    </Base>
  ),
  trash: ({ size = 14 }: IconProps) => (
    <Base size={size}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Base>
  ),
  close: ({ size = 16 }: IconProps) => (
    <Base size={size}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  ),
  search: ({ size = 14 }: IconProps) => (
    <Base size={size}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4-4" />
    </Base>
  ),
} as const;

export type EventTypeKey = "flight" | "hotel" | "restaurant" | "activity" | "transport" | "misc";
export const EVENT_TYPES: EventTypeKey[] = ["flight", "hotel", "restaurant", "activity", "transport", "misc"];
