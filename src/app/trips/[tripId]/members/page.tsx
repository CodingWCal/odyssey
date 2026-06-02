import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { notFound } from "next/navigation";
import { InviteForm } from "@/components/trips/InviteForm";
import { AvatarStack, avatarColor, initialsOf } from "@/components/shared/AvatarStack";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function MembersPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const dateRange = `${new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const members = trip.members.map((m: (typeof trip.members)[number]) => ({ id: m.id, name: m.user?.name ?? "Traveler" }));

  // Real per-member activity counts.
  const stats = await Promise.all(
    trip.members.map(async (m: (typeof trip.members)[number]) => {
      const [events, expenses] = await Promise.all([
        db.event.count({ where: { tripId, createdBy: m.userId } }),
        db.expense.count({ where: { tripId, addedBy: m.userId } }),
      ]);
      const notes = trip.note?.updatedBy === m.userId ? 1 : 0;
      return { events, expenses, notes };
    })
  );

  return (
    <div className="canvas members-canvas">
      <section className="hero" aria-label="Members overview">
        <div className="hero-top">
          <div className="left">
            <div className="hero-eyebrow">{trip.destination} · {dateRange}</div>
            <h1 className="hero-title">The <em>travelers</em></h1>
          </div>
          <div className="hero-people">
            <AvatarStack members={members} />
            <span>{members.length} on board</span>
          </div>
        </div>
        <div className="hero-row">
          <span>Everyone here can edit the itinerary, log expenses, and leave notes.</span>
        </div>
      </section>

      <div className="page-bar">
        <h2>Travelers</h2>
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{members.length} active</span>
      </div>

      <div className="members-grid">
        {trip.members.map((m: (typeof trip.members)[number], i: number) => {
          const role = m.role === "owner" ? "owner" : m.role === "viewer" ? "viewer" : "editor";
          const joined = role === "owner"
            ? `Created the trip · ${new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : `Joined ${new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          const s = stats[i];
          return (
            <div className="member-card" key={m.id}>
              <span className={`role-badge ${role}`}>{role}</span>
              <div className="member-top">
                <span className={`member-avatar ${avatarColor(m.id)}`}>{initialsOf(m.user?.name ?? "?")}</span>
                <div style={{ minWidth: 0, paddingTop: 4 }}>
                  <h3 className="member-name">{m.user?.name ?? "Traveler"}</h3>
                  <div className="member-email">{m.user?.email}</div>
                </div>
              </div>
              <div className="member-stats">
                <div className="member-stat"><div className="num">{s.events}</div><div className="lbl">Events</div></div>
                <div className="member-stat"><div className="num">{s.expenses}</div><div className="lbl">Expenses</div></div>
                <div className="member-stat"><div className="num">{s.notes}</div><div className="lbl">Notes</div></div>
              </div>
              <div className="member-foot">
                <span>{joined}</span>
                <span>·</span>
                <span style={{ textTransform: "capitalize" }}>{role}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="invite-card">
        <h3>Invite a <em>friend</em></h3>
        <p className="sub">They&apos;ll get an email with a link to join. No account needed yet — they sign up after clicking.</p>
        <InviteForm tripId={tripId} />
      </div>
    </div>
  );
}
