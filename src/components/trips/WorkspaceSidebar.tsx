"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import type { Trip } from "@/types";

const NAV_ITEMS = [
  {
    href: "itinerary",
    label: "Itinerary",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "map",
    label: "Map",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    href: "budget",
    label: "Budget",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "members",
    label: "Members",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

interface WorkspaceSidebarProps {
  trip: Pick<Trip, "id" | "title" | "destination">;
}

export function WorkspaceSidebar({ trip }: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Odyssey</span>
        </div>

        <Link href="/dashboard" className="back-link">
          ← All trips
        </Link>

        <div className="trip-meta">
          <h2 className="title">{trip.title}</h2>
          <span className="dest">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {trip.destination}
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Trip navigation">
          {NAV_ITEMS.map((item) => {
            const href = `/trips/${trip.id}/${item.href}`;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={item.href}
                href={href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                {item.label}
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

      {/* Mobile bottom nav */}
      <nav className="mobile-nav" aria-label="Trip navigation">
        {NAV_ITEMS.map((item) => {
          const href = `/trips/${trip.id}/${item.href}`;
          const active = pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              className={active ? "active" : ""}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
