import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { InviteForm } from "@/components/trips/InviteForm";
import { MemberActions } from "@/components/trips/MemberActions";
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

  // Current viewer (for owner-only controls) + which members are still pending
  // sign-up (placeholder clerkId) so we can show a Resend control.
  const dbUser = await getOrCreateDbUser();
  const currentUserId = dbUser.id;
  const isOwner = trip.members.some(
    (m: (typeof trip.members)[number]) => m.userId === currentUserId && m.role === "owner"
  );
  const clerkRows = await db.tripMember.findMany({
    where: { tripId },
    select: { id: true, user: { select: { clerkId: true } } },
  });
  const pendingByMember = new Map(
    clerkRows.map((r: (typeof clerkRows)[number]) => [r.id, r.user.clerkId.startsWith("pending_")])
  );

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
          <span>Editors can edit the itinerary, log expenses, and leave notes. Viewers follow along read-only.</span>
        </div>
      </section>

      <div className="page-bar">
        <h2>Travelers</h2>
        <span className="members-count">{members.length} active</span>
      </div>

      <div className="members-grid">
        {trip.members.map((m: (typeof trip.members)[number], i: number) => {
          const role = m.role === "owner" ? "owner" : m.role === "viewer" ? "viewer" : "editor";
          const joined = role === "owner"
            ? `Created the trip · ${new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : `Joined ${new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          const s = stats[i];
          const isPending = pendingByMember.get(m.id) ?? false;
          const canRemove = isOwner && m.role !== "owner";
          return (
            <div className="member-card" key={m.id}>
              {isPending ? (
                <span className="role-badge pending">pending</span>
              ) : (
                <span className={`role-badge ${role}`}>{role}</span>
              )}
              <div className="member-top">
                <span className={`member-avatar ${avatarColor(m.id)}`}>{initialsOf(m.user?.name ?? "?")}</span>
                <div className="member-id">
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
                <span className="member-role">{role}</span>
              </div>
              <MemberActions
                memberId={m.id}
                tripId={tripId}
                memberName={m.user?.name ?? "this traveler"}
                isPending={isPending && trip.myRole !== "viewer"}
                canRemove={canRemove}
              />
            </div>
          );
        })}
      </div>

      {trip.myRole !== "viewer" && (
        <div className="invite-card">
          <h3>Invite a <em>friend</em></h3>
          <p className="sub">They&apos;ll get an email with a link to join. No account needed yet — they sign up after clicking.</p>
          <InviteForm tripId={tripId} />
        </div>
      )}
    </div>
  );
}
