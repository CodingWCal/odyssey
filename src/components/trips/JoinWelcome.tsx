"use client";

import { useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/shared/Icons";
import { dismissJoinWelcome } from "@/app/trips/actions";

interface JoinWelcomeProps {
  tripId: string;
  tripTitle: string;
  role: "editor" | "viewer";
  /** The joiner's stored name; the first word seeds the greeting. */
  memberName: string | null;
  /** Who owns the trip, for the "hosting" line. */
  ownerName: string | null;
}

/**
 * A slim, dismissible "you're aboard" welcome for a member on their first days
 * on a trip they were invited to (ODY-085). getTripById gates it on joinedAt
 * recency, role, and a dismiss cookie, so this only renders for a freshly-joined
 * non-owner who hasn't dismissed it. Dismiss persists via dismissJoinWelcome
 * (a per-trip cookie); the local state hides it immediately.
 */
export function JoinWelcome({ tripId, tripTitle, role, memberName, ownerName }: JoinWelcomeProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    // Persist across reloads; a failure just means it may reappear next visit.
    dismissJoinWelcome(tripId).catch(() => {});
  }

  const firstName = memberName?.trim().split(/\s+/)[0] ?? null;

  return (
    <section
      className={`jw${role === "viewer" ? " is-viewer" : ""}`}
      aria-label="Welcome to the trip"
    >
      <span className="jw-perf" aria-hidden="true" />
      <span className="jw-badge" aria-hidden="true">
        <Icons.members size={20} />
      </span>
      <div className="jw-body">
        <p className="jw-eyebrow">You&rsquo;re aboard</p>
        <h2 className="jw-title">
          Welcome to <em>{tripTitle}</em>{firstName ? `, ${firstName}` : ""}.
        </h2>
        <p className="jw-sub">
          {role === "viewer" ? (
            <>
              You&rsquo;ve got <span className="jw-role-chip">view-only</span> access, so you can
              follow along as the plan comes together.
            </>
          ) : (
            <>
              You&rsquo;ve joined as <span className="jw-role-chip">editor</span>, so you can build
              the plan alongside everyone else.
            </>
          )}
          {ownerName ? ` ${ownerName}’s hosting this trip.` : ""}
        </p>
      </div>
      <Link href={`/trips/${tripId}/members`} className="jw-cta">
        Meet the crew
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
      <button
        type="button"
        className="jw-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss welcome"
      >
        <Icons.close size={15} />
      </button>
    </section>
  );
}
