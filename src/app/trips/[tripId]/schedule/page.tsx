import { getTripById } from "@/app/trips/actions";
import { getOrCreateDbUser } from "@/lib/auth";
import { getSchedule } from "./actions";
import { notFound } from "next/navigation";
import { PollSetupForm } from "@/components/trips/PollSetupForm";
import { AvailabilityGrid } from "@/components/trips/AvailabilityGrid";
import { AvailabilityHeatmap } from "@/components/trips/AvailabilityHeatmap";
import { AvailabilityCalendar } from "@/components/trips/AvailabilityCalendar";

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
  // Editors can open/edit polls (ODY-081); only viewers are read-only.
  const canEditPoll = trip.myRole !== "viewer";

  const { poll, slots, members, bestWindow } = await getSchedule(tripId);

  const dateRange = `${new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

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

      {!poll && canEditPoll && <PollSetupForm tripId={tripId} />}

      {!poll && !canEditPoll && (
        <div className="empty-card">
          <p className="glyph" aria-hidden="true">🗓️</p>
          <p className="headline">
            No scheduling poll yet.
          </p>
          <p className="sub">
            No one has opened a scheduling poll for this trip yet.
          </p>
        </div>
      )}

      {poll && (
        // Whole-day polls (the common case) get the calendar, which folds the
        // personal grid, group heat and best window into one surface. Granular
        // block polls keep the per-block table + heatmap.
        poll.enabledBlocks.length === 1 && poll.enabledBlocks[0] === "all_day" ? (
          <AvailabilityCalendar
            poll={poll}
            slots={slots}
            members={members}
            bestWindow={bestWindow}
            currentUserId={currentUserId}
            isOwner={isOwner}
          />
        ) : (
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
        )
      )}
    </div>
  );
}
