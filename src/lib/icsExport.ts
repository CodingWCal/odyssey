/**
 * Build an iCalendar (.ics) document for a trip's events (ODY-069).
 *
 * Read-only *export*, not two-way sync: the traveler downloads the file and
 * imports it into Google/Apple Calendar. Design choices that make an itinerary
 * import cleanly in a major calendar app:
 *
 * - **Floating local time.** Timed events emit `DTSTART:20260710T090000` with
 *   no `Z` and no `TZID`, i.e. "9am wherever this event happens." For a trip
 *   that crosses timezones this is exactly right — 9am at the destination,
 *   not 9am back home shifted by an offset. (RFC 5545 §3.3.5, form 1.)
 * - **All-day for untimed events.** No start time → a `VALUE=DATE` all-day
 *   entry spanning that calendar day (DTEND is the exclusive next day).
 * - **UTC calendar components for the day.** Day rows are stored as
 *   UTC-midnight (ODY-003), so the date is read with `getUTC*` — matching
 *   `toDateInputValue`/`formatWeekday` so exports never drift a day in US
 *   timezones.
 *
 * Pure and dependency-free so it's unit-testable (mirrors mapsExport.ts).
 */

export interface IcsEvent {
  id: string;
  title: string;
  location?: string | null;
  notes?: string | null;
  /** "HH:MM" 24h, or null/empty for an all-day entry. */
  startTime?: string | null;
  endTime?: string | null;
  /** The calendar day this event sits on (a Day.date, UTC-midnight). */
  date: Date;
}

export interface IcsTrip {
  title: string;
  destination?: string | null;
  events: IcsEvent[];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYYMMDD" from a date's UTC calendar components. */
function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** The calendar day after `d`, as "YYYYMMDD" (exclusive DTEND for all-day). */
function utcNextYmd(d: Date): string {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return utcYmd(next);
}

/** Minutes since midnight for a valid "HH:MM" (24h), else null. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function hms(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
}

/** Escape a text value per RFC 5545 §3.3.11. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets with CRLF + leading space (§3.1). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/**
 * DTSTART/DTEND lines for one event. Timed events get floating local times
 * (default 60-minute block when no end, clamped to the same calendar day so a
 * late untimed-duration event never leaks into the next day). Untimed events
 * become an all-day span.
 */
function timeLines(ev: IcsEvent): string[] {
  const start = ev.startTime ? toMinutes(ev.startTime) : null;
  if (start == null) {
    return [
      `DTSTART;VALUE=DATE:${utcYmd(ev.date)}`,
      `DTEND;VALUE=DATE:${utcNextYmd(ev.date)}`,
    ];
  }
  const rawEnd = ev.endTime ? toMinutes(ev.endTime) : null;
  const end =
    rawEnd == null || rawEnd <= start ? Math.min(start + 60, 24 * 60 - 1) : rawEnd;
  const ymd = utcYmd(ev.date);
  return [`DTSTART:${ymd}T${hms(start)}`, `DTEND:${ymd}T${hms(end)}`];
}

export function buildTripIcs(trip: IcsTrip, now: Date = new Date()): string {
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Odyssey//Trip Itinerary//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(trip.title)}`,
  ];

  for (const ev of trip.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@odyssey`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(...timeLines(ev));
    lines.push(`SUMMARY:${esc(ev.title)}`);
    // The trip destination gives a bare location a place on the map.
    const loc = ev.location?.trim() || trip.destination?.trim();
    if (loc) lines.push(`LOCATION:${esc(loc)}`);
    if (ev.notes?.trim()) lines.push(`DESCRIPTION:${esc(ev.notes.trim())}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // CRLF line breaks are required by RFC 5545 §3.1.
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** URL-safe filename stem for the download, e.g. "odyssey-lisbon-in-may". */
export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `odyssey-${slug || "trip"}.ics`;
}
