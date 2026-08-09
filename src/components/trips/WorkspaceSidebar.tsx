"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Icons } from "@/components/shared/Icons";
import { TripEditModal } from "./TripEditModal";
import { splitDesktopNav, type NavItem, type TripNavState } from "./navItems";
import { resolveCoverIndex } from "./cover";

function formatRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const optsY: Intl.DateTimeFormatOptions = { ...opts, year: "numeric" };
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sMonthDay = s.toLocaleDateString("en-US", opts);
  const eFull = e.toLocaleDateString("en-US", optsY);
  return sameYear
    ? `${sMonthDay} – ${eFull}`
    : `${s.toLocaleDateString("en-US", optsY)} – ${eFull}`;
}

interface WorkspaceSidebarProps {
  trip: {
    id: string;
    title: string;
    destination: string;
    startDate: Date;
    endDate: Date;
    timeFormat?: string;
    currency?: string;
    coverImageUrl?: string | null;
  };
  /** Viewers can't edit trip details (ODY-001). */
  canEdit?: boolean;
  /** Trip-state signals for progressive tab reveal (ODY-075). */
  navState: TripNavState;
}

export function WorkspaceSidebar({ trip, canEdit = true, navState }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const coverIndex = resolveCoverIndex(trip.coverImageUrl ?? null, trip.id);

  const isActive = (href: string) => {
    const full = `/trips/${trip.id}/${href}`;
    return pathname === full || pathname.startsWith(full + "/");
  };
  const { primary, more } = splitDesktopNav(navState, isActive);

  const renderLink = ({ href, label, Icon }: NavItem) => {
    const full = `/trips/${trip.id}/${href}`;
    const active = isActive(href);
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
  };

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
        initialTimeFormat={trip.timeFormat as "12h" | "24h" | undefined}
        initialCoverIndex={coverIndex}
        initialCurrency={trip.currency}
        onClose={() => setEditOpen(false)}
      />

      <nav className="nav" aria-label="Trip navigation">
        {primary.map(renderLink)}

        {more.length > 0 && (
          <>
            <button
              type="button"
              className={`nav-more-toggle ${moreOpen ? "open" : ""}`}
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
            >
              <span className="icon"><Icons.chevron size={15} /></span>
              More
            </button>
            {moreOpen && more.map(renderLink)}
          </>
        )}
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
