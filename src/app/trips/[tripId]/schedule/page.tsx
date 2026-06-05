import { getTripById } from "@/app/trips/actions";
import { getOrCreateDbUser } from "@/lib/auth";
import { getSchedule } from "./actions";
import { notFound } from "next/navigation";
import { PollSetupForm } from "@/components/trips/PollSetupForm";
import { AvailabilityGrid } from "@/components/trips/AvailabilityGrid";
import { AvailabilityHeatmap } from "@/components/trips/AvailabilityHeatmap";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function SchedulePage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const dbUser = await getOrCreateDbUser();
  const currentUserId = dbUser.id;
  const isOwner = trip.members.some(
    (m: (typeof trip.members)[number]) => m.userId === currentUserId && m.role === "owner"
  );

  const { poll, slots, members, bestWindow } = await getSchedule(tripId);

  const dateRange = `${new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="canvas">
      <section className="hero" aria-label="Schedule overview">
        <div className="hero-top">
          <div className="left">
            <div className="hero-eyebrow">{trip.destination} · {dateRange}</div>
            <h1 className="hero-title">Plan the <em>when</em></h1>
          </div>
        </div>
        <div className="hero-row">
          <span>Mark when everyone&apos;s free, then lock in the dates that work for the most travelers.</span>
        </div>
      </section>

      {!poll && isOwner && <PollSetupForm tripId={tripId} />}

      {!poll && !isOwner && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 24px",
            background: "var(--paper-2)",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--rule)",
          }}
        >
          <p style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">🗓️</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", margin: "0 0 6px" }}>
            No scheduling poll yet.
          </p>
          <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>
            The trip owner hasn&apos;t opened a scheduling poll yet.
          </p>
        </div>
      )}

      {poll && (
        <>
          <AvailabilityGrid
            poll={poll}
            slots={slots}
            members={members}
            currentUserId={currentUserId}
          />
          <AvailabilityHeatmap
            poll={poll}
            slots={slots}
            members={members}
            bestWindow={bestWindow}
            isOwner={isOwner}
          />
        </>
      )}
    </div>
  );
}
