"use client";

import Link from "next/link";
import { Icons, type EventTypeKey } from "@/components/shared/Icons";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { formatDate, formatTime, type TimeFormat } from "@/lib/utils";

// Event type → accent color token (mirrors EventBlock's TYPE_VAR / CLAUDE.md).
const TYPE_VAR: Record<string, string> = {
  flight: "coral",
  hotel: "gold",
  restaurant: "peach",
  activity: "teal",
  transport: "peri",
  misc: "slate",
};

export interface AgendaEvent {
  id: string;
  type: string;
  title: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  cost: number | null;
  lat: number | null;
  lng: number | null;
}

interface DayOption {
  id: string;
  date: Date;
  label: string;
}

interface DayAgendaProps {
  tripId: string;
  days: DayOption[];
  selectedDayId: string | null;
  events: AgendaEvent[];
  timeFormat: TimeFormat;
}

/**
 * Compact single-day agenda (ODY-087) — a clean morning→evening strip for one
 * day, for reading the plan at a glance while travelling. Day switching is
 * server-driven via `?day=` links (no client state); prints cleanly (the
 * workspace chrome is hidden under `@media print`).
 */
export function DayAgenda({ tripId, days, selectedDayId, events, timeFormat }: DayAgendaProps) {
  const idx = days.findIndex((d) => d.id === selectedDayId);
  const current = idx >= 0 ? days[idx] : days[0];
  const prev = idx > 0 ? days[idx - 1] : null;
  const next = idx >= 0 && idx < days.length - 1 ? days[idx + 1] : null;
  const pinned = events.filter((e) => e.lat != null && e.lng != null).length;

  return (
    <div className="agenda">
      <header className="agenda-head">
        <Link href={`/trips/${tripId}/itinerary`} className="agenda-back">
          <Icons.chevron size={15} /> Itinerary
        </Link>
        <button type="button" className="btn btn-ghost sm agenda-print" onClick={() => window.print()}>
          Print
        </button>
      </header>

      <nav className="agenda-daynav" aria-label="Pick a day">
        {prev ? (
          <Link className="agenda-arrow" href={`/trips/${tripId}/agenda?day=${prev.id}`} aria-label={`Previous day, ${prev.label}`}>
            <Icons.chevron size={18} />
          </Link>
        ) : (
          <span className="agenda-arrow is-disabled" aria-hidden="true"><Icons.chevron size={18} /></span>
        )}
        <div className="agenda-title">
          <span className="agenda-day">{current?.label ?? "Day"}</span>
          {current && <span className="agenda-date">{formatDate(current.date)}</span>}
        </div>
        {next ? (
          <Link className="agenda-arrow flip" href={`/trips/${tripId}/agenda?day=${next.id}`} aria-label={`Next day, ${next.label}`}>
            <Icons.chevron size={18} />
          </Link>
        ) : (
          <span className="agenda-arrow flip is-disabled" aria-hidden="true"><Icons.chevron size={18} /></span>
        )}
      </nav>

      {events.length === 0 ? (
        <p className="agenda-empty">Nothing planned for this day yet.</p>
      ) : (
        <ol className="agenda-list">
          {events.map((e) => (
            <li
              key={e.id}
              className="agenda-item"
              style={{ "--type-color": `var(--${TYPE_VAR[e.type] ?? "slate"})` } as React.CSSProperties}
            >
              <div className="agenda-time">
                <span className="start">{e.startTime ? formatTime(e.startTime, timeFormat) : "—"}</span>
                {e.endTime && <span className="end">{formatTime(e.endTime, timeFormat)}</span>}
              </div>
              <div className="agenda-body">
                <div className="agenda-item-head">
                  <TypeBadge type={e.type as EventTypeKey} />
                  <h2>{e.title}</h2>
                </div>
                {e.location && (
                  <p className="agenda-loc"><Icons.pin size={12} /> {e.location}</p>
                )}
                {e.notes && <p className="agenda-notes">{e.notes}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="agenda-foot">
        <Link href={`/trips/${tripId}/map`} className="btn btn-ghost">
          <Icons.map size={15} /> {pinned} pin{pinned !== 1 ? "s" : ""} on the map
        </Link>
      </div>
    </div>
  );
}
