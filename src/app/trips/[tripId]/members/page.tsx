import { getTripById } from "@/app/trips/actions";
import { notFound } from "next/navigation";
import { InviteForm } from "@/components/trips/InviteForm";

const AVATAR_COLORS = ["var(--peri)", "var(--coral)", "var(--teal)", "var(--gold)", "var(--peach)", "var(--slate)"];

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function MembersPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  return (
    <div className="canvas" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, margin: "0 0 6px", color: "var(--ink)" }}>
          The <em style={{ fontStyle: "italic", color: "var(--peri)" }}>crew</em>
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 13.5, margin: 0 }}>
          {trip.members.length} traveler{trip.members.length !== 1 ? "s" : ""} on this trip
        </p>
      </div>

      {/* Members grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 36 }}>
        {trip.members.map((member: (typeof trip.members)[number], i: number) => {
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const initials = (member.user.name ?? "?").slice(0, 2).toUpperCase();

          return (
            <div
              key={member.id}
              style={{
                background: "var(--paper-2)", border: "1px solid var(--rule)",
                borderRadius: "var(--radius-lg)", padding: "22px 22px 20px",
                display: "flex", flexDirection: "column", gap: 14, position: "relative",
              }}
            >
              {/* Role badge */}
              <span style={{
                position: "absolute", top: 16, right: 16,
                fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase",
                fontWeight: 600, padding: "3px 9px", borderRadius: 999,
                border: "1px solid currentColor",
                color: member.role === "owner" ? "var(--teal)" : "var(--peri)",
                background: member.role === "owner" ? "var(--teal-soft)" : "var(--peri-soft)",
              }}>
                {member.role}
              </span>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: color, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 600, flexShrink: 0,
                  boxShadow: "0 4px 12px rgba(31,34,56,.18)",
                }}>
                  {initials}
                </div>
                <div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 4px", color: "var(--ink)" }}>
                    {member.user.name}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)", margin: 0 }}>
                    {member.user.email}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite form */}
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg)", padding: "22px 24px" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 16px", color: "var(--ink)" }}>
          Invite by <em style={{ fontStyle: "italic" }}>email</em>
        </h2>
        <InviteForm tripId={tripId} />
      </div>
    </div>
  );
}
