"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Icons } from "@/components/shared/Icons";
import { TripEditModal } from "./TripEditModal";

const NAV_ITEMS = [
  { href: "schedule", label: "Schedule", Icon: Icons.schedule },
  { href: "itinerary", label: "Itinerary", Icon: Icons.itinerary },
  { href: "map", label: "Map", Icon: Icons.map },
  { href: "budget", label: "Budget", Icon: Icons.budget },
  { href: "members", label: "Members", Icon: Icons.members },
] as const;

function formatRange(start: Date, end: Date): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sMonthDay = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const eFull = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return sameYear ? `${sMonthDay} – ${eFull}` : `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${eFull}`;
}

interface WorkspaceSidebarProps {
  trip: { id: string; title: string; destination: string; startDate: Date; endDate: Date };
  /** Viewers can't edit trip details (ODY-001). */
  canEdit?: boolean;
}

export function WorkspaceSidebar({ trip, canEdit = true }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Odyssey</span>
      </div>

      <Link href="/dashboard" className="back-link">
        ← All trips
      </Link>

      <div className="trip-meta">
        <div className="title-row">
          <h1 className="title">{trip.title}</h1>
          {canEdit && (
            <button
              className="icon-btn"
              onClick={() => setEditOpen(true)}
              aria-label="Edit trip name"
              title="Edit trip name"
            >
              <Icons.edit size={13} />
            </button>
          )}
        </div>
        <span className="dest">
          <Icons.pin size={11} /> {trip.destination} · {formatRange(trip.startDate, trip.endDate)}
        </span>
      </div>

      <TripEditModal
        open={editOpen}
        tripId={trip.id}
        initialTitle={trip.title}
        initialDestination={trip.destination}
        initialStartDate={trip.startDate}
        initialEndDate={trip.endDate}
        onClose={() => setEditOpen(false)}
      />

      <nav className="nav" aria-label="Trip navigation">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const full = `/trips/${trip.id}/${href}`;
          const active = pathname === full || pathname.startsWith(full + "/");
          return (
            <Link
              key={href}
              href={full}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <span className="icon"><Icon size={15} /></span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <UserButton />
        <div className="foot-body">
          <div className="foot-sub">Account</div>
        </div>
      </div>
    </aside>
  );
}
