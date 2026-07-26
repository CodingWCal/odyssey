"use client";

import { useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/shared/Icons";

interface FirstStepsProps {
  tripId: string;
  memberCount: number;
  readOnly?: boolean;
}

/**
 * Calm first-run checklist for empty trips (ODY-074). Completion is derived
 * from live data; dismiss is session-only (no localStorage).
 */
export function FirstSteps({ tripId, memberCount, readOnly = false }: FirstStepsProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  if (readOnly) {
    return (
      <div className="empty-card">
        <p className="headline soft">Nothing planned yet.</p>
        <p className="sub">Check back when the crew starts adding stops.</p>
      </div>
    );
  }

  const invited = memberCount >= 2;
  const steps = [
    {
      key: "event",
      done: false,
      label: "Add your first stop",
      hint: "Use “Add event” on any day below.",
      href: null as string | null,
    },
    {
      key: "invite",
      done: invited,
      label: "Invite one person",
      hint: "Planning is better with company.",
      href: `/trips/${tripId}/members`,
    },
    {
      key: "explore",
      done: false,
      label: "Browse ideas nearby",
      hint: "Explore suggests places for your destination.",
      href: `/trips/${tripId}/explore`,
    },
  ];

  return (
    <section className="first-steps" aria-label="Getting started">
      <header className="first-steps-head">
        <div>
          <div className="eyebrow">Getting started</div>
          <h2 className="first-steps-title">
            Make it <em>yours</em>
          </h2>
          <p className="first-steps-sub">A few quiet next steps — dismiss anytime.</p>
        </div>
        <button type="button" className="icon-btn" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <Icons.close size={14} />
        </button>
      </header>
      <ol className="first-steps-list">
        {steps.map((s) => (
          <li key={s.key} className={`first-steps-item${s.done ? " done" : ""}`}>
            <span className="first-steps-check" aria-hidden="true">
              {s.done ? "✓" : ""}
            </span>
            <div className="first-steps-body">
              <div className="first-steps-label">{s.label}</div>
              <div className="first-steps-hint">{s.hint}</div>
            </div>
            {s.href && !s.done && (
              <Link href={s.href} className="btn btn-ghost first-steps-go">
                Go
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
