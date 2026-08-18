import Link from "next/link";
import { AvatarStack } from "@/components/shared/AvatarStack";
import { formatMoney } from "@/lib/money";
import { COVER_ACCENT } from "./cover";

export interface DashTrip {
  id: string;
  title: string;
  destination: string;
  startStr: string;
  endStr: string;
  days: number;
  spent: number;
  cost: number;
  currency: string;
  status: "live" | "upcoming" | "past";
  countdown: string;
  cover: string;
  members: { id: string; name: string }[];
  /** Soft-hidden from the primary grid (ODY-082). */
  archived: boolean;
  /** Only the owner may archive/restore. */
  isOwner: boolean;
}

function titleParts(title: string): { head: string; tail: string } {
  const m = title.match(/^(.*?)(\s+\S+)$/);
  if (!m) return { head: "", tail: title };
  return { head: m[1], tail: m[2] };
}

export function TripCard({ trip, onArchiveToggle }: { trip: DashTrip; onArchiveToggle?: (id: string, archived: boolean) => void }) {
  const isPast = trip.status === "past";
  const { head, tail } = titleParts(trip.title);
  // Archive control shows for the owner on archived trips (Restore) and on
  // past active trips (Archive — the ones that pile up); upcoming/live active
  // cards stay uncluttered (ODY-082).
  const showArchive = trip.isOwner && onArchiveToggle && (trip.archived || isPast);

  return (
    <Link href={`/trips/${trip.id}/itinerary`} className={`trip-card ${isPast ? "past" : ""}`}>
      <div
        className="cover cover-art"
        style={{ "--cover-img": `${COVER_ACCENT}, ${trip.cover}` } as React.CSSProperties}
      >
        <span className="countdown">{trip.countdown}</span>
        {showArchive && (
          <button
            type="button"
            className="trip-archive-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onArchiveToggle(trip.id, trip.archived);
            }}
          >
            {trip.archived ? "Restore" : "Archive"}
          </button>
        )}
        <div className="cover-bottom">
          <div className="dest">{trip.destination}</div>
          <div className="days">{trip.days} days</div>
        </div>
      </div>
      <div className="body">
        <h3>{head}<em>{tail}</em></h3>
        <div className="dates">{trip.startStr} → {trip.endStr}</div>
        <div className="meta">
          <AvatarStack members={trip.members} />
          <span className="cost">
            {isPast
              ? <>{formatMoney(trip.spent, trip.currency)} <span className="muted-spent">spent</span></>
              : trip.spent > 0
                ? <>{formatMoney(trip.spent, trip.currency)} / {formatMoney(trip.cost, trip.currency)}</>
                : <>{formatMoney(trip.cost, trip.currency)} budget</>}
          </span>
        </div>
      </div>
    </Link>
  );
}
