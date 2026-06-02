"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Icons } from "@/components/shared/Icons";
import { AvatarStack } from "@/components/shared/AvatarStack";
import { TripCard, type DashTrip } from "./TripCard";

function fmtMoney(n: number) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Up late";
}

function NewTripCard() {
  return (
    <Link href="/trips/new" className="new-trip-card">
      <div className="plus-large"><Icons.plus size={20} /></div>
      <h3>Plan a new trip</h3>
      <p>Sketch out dates, destinations, and bring your people in.</p>
    </Link>
  );
}

function LiveCard({ trip }: { trip: DashTrip }) {
  const start = new Date(trip.startStr);
  const today = new Date();
  const dayOf = Math.min(trip.days, Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1));
  const pct = trip.days ? (dayOf / trip.days) * 100 : 0;
  return (
    <Link className="live-card" href={`/trips/${trip.id}/itinerary`}>
      <div className="cover" style={{ backgroundImage: `radial-gradient(60% 70% at 80% 20%, rgba(255,255,255,.22) 0%, transparent 55%), ${trip.cover}` }}>
        <span className="live-pill"><span className="live-dot" />Live · Day {dayOf} of {trip.days}</span>
        <div className="cover-info">
          <div className="dest">{trip.destination}</div>
          <h2 className="title">{trip.title}</h2>
        </div>
      </div>
      <div className="body">
        <div>
          <div className="now">Up next</div>
          <div className="next">Your trip is underway</div>
          <div className="next-meta">{trip.startStr} → {trip.endStr}</div>
        </div>
        <div>
          <div className="progress-trip">
            <div className="bar"><div className="fill" style={{ width: pct + "%" }} /></div>
            <div className="pmeta">
              <span>{trip.startStr} → {trip.endStr}</span>
              <span>{Math.round(pct)}% there</span>
            </div>
          </div>
          <div className="footer">
            <AvatarStack members={trip.members} max={5} />
            <span>{fmtMoney(trip.spent)} of {fmtMoney(trip.cost)} · {trip.members.length} travelers</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function DashboardClient({ firstName, trips }: { firstName: string; trips: DashTrip[] }) {
  const [query, setQuery] = useState("");

  const match = (t: DashTrip) =>
    !query.trim() ||
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.destination.toLowerCase().includes(query.toLowerCase());

  const live = trips.find((t) => t.status === "live");
  const showLive = live && match(live);
  const upcoming = trips.filter((t) => t.status === "upcoming" && match(t));
  const past = trips.filter((t) => t.status === "past" && match(t));

  const totalDays = trips.reduce((s, t) => s + t.days, 0);
  const travelers = new Set<string>();
  trips.forEach((t) => t.members.forEach((m) => travelers.add(m.id)));

  const nothing = !showLive && upcoming.length === 0 && past.length === 0;

  return (
    <div className="dash-shell">
      <header className="dash-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Odyssey</span>
        </div>
        <div className="top-actions">
          <div className="search-wrap">
            <span className="icon"><Icons.search size={14} /></span>
            <input
              type="search"
              placeholder="Search trips, destinations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search trips"
            />
            <span className="kbd">⌘K</span>
          </div>
          <Link href="/trips/new" className="btn-cta"><Icons.plus size={14} /> New trip</Link>
          <UserButton />
        </div>
      </header>

      <main className="dash-canvas">
        <section className="dash-greet">
          <div>
            <div className="eyebrow">{greeting()}, {firstName}</div>
            <h1>Where to <em>next</em>?</h1>
          </div>
          <div className="stat-strip">
            <span><strong>{trips.length}</strong>adventure{trips.length !== 1 ? "s" : ""}</span>
            <span className="sep">·</span>
            <span><strong>{totalDays}</strong>days planned</span>
            <span className="sep">·</span>
            <span><strong>{travelers.size}</strong>traveler{travelers.size !== 1 ? "s" : ""}</span>
          </div>
        </section>

        {showLive && live && <LiveCard trip={live} />}

        {upcoming.length > 0 && (
          <>
            <div className="section-title">
              <h2>Upcoming <span className="count">{upcoming.length}</span></h2>
            </div>
            <div className="trip-grid">
              {upcoming.map((t) => <TripCard key={t.id} trip={t} />)}
              <NewTripCard />
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-title">
              <h2>Wrapped <span className="count">{past.length}</span></h2>
            </div>
            <div className="trip-grid">
              {past.map((t) => <TripCard key={t.id} trip={t} />)}
            </div>
          </>
        )}

        {trips.length === 0 && (
          <div className="trip-grid">
            <NewTripCard />
          </div>
        )}

        {nothing && trips.length > 0 && (
          <div style={{ padding: "64px 0", textAlign: "center", color: "var(--ink-3)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-2)", margin: 0 }}>
              No trips match &ldquo;{query}&rdquo;
            </p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Try a different search, or plan something new.</p>
          </div>
        )}
      </main>
    </div>
  );
}
