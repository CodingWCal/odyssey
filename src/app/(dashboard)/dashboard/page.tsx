import { getTripsByUser } from "@/app/trips/actions";
import { TripCard } from "@/components/trips/TripCard";
import { NewTripButton } from "@/components/trips/NewTripButton";
import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Up late";
}

export default async function DashboardPage() {
  const trips = await getTripsByUser();
  const user = await currentUser();
  const firstName = user?.firstName ?? "traveler";

  const totalDays = trips.reduce((s: number, tr: (typeof trips)[number]) => {
    const start = new Date(tr.startDate);
    const end = new Date(tr.endDate);
    return s + Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  }, 0);

  return (
    <div className="dash-shell">
      {/* Top bar */}
      <header className="dash-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Odyssey</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <NewTripButton />
          <UserButton />
        </div>
      </header>

      {/* Main canvas */}
      <main className="dash-canvas">
        {/* Greeting */}
        <section className="dash-greet">
          <div className="eyebrow">{timeOfDayGreeting()}, {firstName}</div>
          <h1>
            Where to <em>next</em>?
          </h1>
          <div className="dash-stats">
            <span><strong>{trips.length}</strong> adventure{trips.length !== 1 ? "s" : ""}</span>
            <span className="sep">·</span>
            <span><strong>{totalDays}</strong> days planned</span>
          </div>
        </section>

        {/* Trips */}
        {trips.length === 0 ? (
          <div
            style={{
              textAlign: "center", padding: "80px 24px",
              background: "var(--paper-2)", borderRadius: "var(--radius-xl)",
              border: "1px solid var(--rule)",
            }}
          >
            <p style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">✈️</p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 32, margin: "0 0 8px" }}>
              Ready for your first <em>adventure</em>?
            </h3>
            <p style={{ color: "var(--ink-2)", fontSize: 15, margin: "0 0 28px" }}>
              Create your first trip and start building your itinerary.
            </p>
            <NewTripButton />
          </div>
        ) : (
          <>
            <div className="section-title">
              <h2>
                Your trips <span className="count">{trips.length}</span>
              </h2>
            </div>
            <div className="trip-grid">
              {trips.map((trip: (typeof trips)[number]) => (
                <TripCard
                  key={trip.id}
                  id={trip.id}
                  title={trip.title}
                  destination={trip.destination}
                  startDate={trip.startDate}
                  endDate={trip.endDate}
                  coverImageUrl={trip.coverImageUrl}
                  members={trip.members.map((m: (typeof trip.members)[number]) => ({
                    name: m.user.name,
                    avatarUrl: m.user.avatarUrl,
                  }))}
                />
              ))}
              <NewTripCardOd />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function NewTripCardOd() {
  return (
    <a href="/trips/new" className="new-trip-card" style={{ textDecoration: "none" }}>
      <div className="plus-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <h3>Plan a new trip</h3>
      <p>Sketch out dates, destinations, and bring your people in.</p>
    </a>
  );
}
