"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/shared/Modal";
import { Icons } from "@/components/shared/Icons";
import { COVER_GRADIENTS, COVER_ACCENT } from "./cover";
import { createTripWizard } from "@/app/trips/actions";
import { toast } from "@/components/shared/Toast";
import { inviteCollaborator } from "@/app/trips/[tripId]/members/actions";

const DESTINATIONS = [
  { name: "Tokyo & Kyoto", country: "Japan", dot: "#D9634F" },
  { name: "Lisbon", country: "Portugal", dot: "#F0A08A" },
  { name: "Reykjavik", country: "Iceland", dot: "#4A6B8C" },
  { name: "Marrakech", country: "Morocco", dot: "#D9634F" },
  { name: "Cyclades", country: "Greece", dot: "#5DCAA5" },
  { name: "Patagonia", country: "Argentina", dot: "#7F77C0" },
];

const BUDGETS = [500, 1500, 3000, 5000, 8000, 12000];

const VIBES = [
  { key: "weekend", title: "Long weekend", meta: "3 days · Friday → Sunday" },
  { key: "week", title: "A week away", meta: "7 days · Saturday → Friday" },
  { key: "twoweeks", title: "Two weeks", meta: "14 days · Pack the big bag" },
  { key: "custom", title: "Custom", meta: "Pick exact dates" },
] as const;

const STEP_META = [
  { tag: "STEP 01 · WHERE", head: ["Where ", "to", "?"], sub: "Type a destination or pick one of your dream-board favorites." },
  { tag: "STEP 02 · WHEN", head: ["When are we ", "going", "?"], sub: "Start with a vibe — you can always nudge the dates." },
  { tag: "STEP 03 · DETAILS", head: ["The ", "final touch", ""], sub: "Name the trip, set a soft budget, invite your people, pick a cover mood." },
];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextWeekday(weekday: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function NewTripWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Plan a new trip">
      <WizardBody onClose={onClose} />
    </Modal>
  );
}

// Inner body remounts each open (Modal returns null when closed), so state is fresh.
function WizardBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vibe, setVibe] = useState<string>("");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");
  const [coverIndex, setCoverIndex] = useState(0);

  const meta = STEP_META[step - 1];

  function pickVibe(key: string) {
    setVibe(key);
    if (key === "weekend") {
      const fri = nextWeekday(5);
      setStartDate(iso(fri));
      setEndDate(iso(addDays(fri, 2)));
    } else if (key === "week") {
      const sat = nextWeekday(6);
      setStartDate(iso(sat));
      setEndDate(iso(addDays(sat, 6)));
    } else if (key === "twoweeks") {
      const sat = nextWeekday(6);
      setStartDate(iso(sat));
      setEndDate(iso(addDays(sat, 13)));
    }
  }

  function addInvite() {
    const e = inviteInput.trim().toLowerCase();
    if (e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !invites.includes(e)) {
      setInvites((s) => [...s, e]);
      setInviteInput("");
    }
  }

  function next() {
    if (step === 2 && !title.trim() && destination.trim()) {
      const place = destination.split(",")[0].trim();
      const yr = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
      setTitle(`${place} ${yr}`);
    }
    setStep((s) => Math.min(3, s + 1));
  }

  async function create() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const { tripId } = await createTripWizard({
        title: title.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        totalBudget: budget ? parseFloat(budget) : undefined,
        coverIndex,
      });
      for (const email of invites) {
        try {
          await inviteCollaborator({ email, tripId, role: "editor" });
        } catch {
          toast(`Invite to ${email} didn't send — you can retry from Members.`);
        }
      }
      router.push(`/trips/${tripId}/itinerary`);
    } catch {
      toast("Couldn't create the trip — try again.");
      setBusy(false);
    }
  }

  const canContinue =
    step === 1 ? destination.trim().length > 0 : step === 2 ? !!startDate && !!endDate && endDate >= startDate : true;

  return (
    <div className="wizard">
      <div className="wizard-head">
        <span className="wizard-tag">{meta.tag}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icons.close size={16} />
        </button>
      </div>
      <div className="wizard-progress" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`seg ${n <= step ? "on" : ""}`} />
        ))}
      </div>

      <h2 className="wizard-title">
        {meta.head[0]}
        <em>{meta.head[1]}</em>
        {meta.head[2]}
      </h2>
      <p className="wizard-sub">{meta.sub}</p>

      <div className="wizard-body">
        {step === 1 && (
          <>
            <label className="wz-label" htmlFor="wz-dest">Destination</label>
            <input
              id="wz-dest"
              className="input"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Lisbon, Portugal"
              autoFocus
            />
            <div className="wz-chips">
              {DESTINATIONS.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  className="wz-chip"
                  onClick={() => setDestination(`${d.name}, ${d.country}`)}
                >
                  <span className="dot dot-var" style={{ "--dot-c": d.dot } as React.CSSProperties} />
                  <span className="nm">{d.name}</span>
                  <span className="ct">· {d.country}</span>
                </button>
              ))}
            </div>
            <div
              className="wz-cover-preview cover-art"
              style={{ "--cover-img": `${COVER_ACCENT}, ${COVER_GRADIENTS[coverIndex]}` } as React.CSSProperties}
            >
              <span>Your trip&apos;s cover will live here.</span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="wz-vibes">
              {VIBES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={`wz-vibe ${vibe === v.key ? "on" : ""}`}
                  onClick={() => pickVibe(v.key)}
                >
                  <span className="vt">{v.title}</span>
                  <span className="vm">{v.meta}</span>
                </button>
              ))}
            </div>
            <div className="wz-dates">
              <div className="field">
                <label className="wz-label" htmlFor="wz-start">Start</label>
                <input id="wz-start" type="date" className="input mono" value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setVibe("custom"); }} />
              </div>
              <div className="field">
                <label className="wz-label" htmlFor="wz-end">End</label>
                <input id="wz-end" type="date" className="input mono" value={endDate} min={startDate}
                  onChange={(e) => { setEndDate(e.target.value); setVibe("custom"); }} />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="wz-label" htmlFor="wz-name">Trip name</label>
            <input id="wz-name" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lisbon 2027" autoFocus />

            <label className="wz-label" htmlFor="wz-budget">Soft budget (optional)</label>
            <div className="input-with-prefix">
              <span className="prefix">$</span>
              <input id="wz-budget" className="input mono" inputMode="decimal" value={budget}
                onChange={(e) => setBudget(e.target.value)} placeholder="0" />
            </div>
            <div className="wz-budget-chips">
              {BUDGETS.map((b) => (
                <button key={b} type="button" className={`wz-bchip ${budget === String(b) ? "on" : ""}`} onClick={() => setBudget(String(b))}>
                  ${b.toLocaleString("en-US")}
                </button>
              ))}
            </div>

            <label className="wz-label" htmlFor="wz-invite">Invite by email (optional)</label>
            <div className="wz-invite-row">
              <input id="wz-invite" type="email" inputMode="email" autoComplete="email"
                autoCapitalize="none" spellCheck={false} className="input" value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
                placeholder="friend@email.com" />
              <button type="button" className="wz-add" onClick={addInvite}><Icons.plus size={12} /> Add</button>
            </div>
            {invites.length > 0 && (
              <div className="wz-invite-tags">
                {invites.map((e) => (
                  <span key={e} className="wz-tag">
                    {e}
                    <button type="button" onClick={() => setInvites((s) => s.filter((x) => x !== e))} aria-label={`Remove ${e}`}>
                      <Icons.close size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <label className="wz-label">Cover mood</label>
            <div className="wz-moods">
              {COVER_GRADIENTS.map((g, i) => (
                <button key={i} type="button" aria-label={`Cover mood ${i + 1}`}
                  className={`wz-mood cover-art ${coverIndex === i ? "on" : ""}`}
                  style={{ "--cover-img": g } as React.CSSProperties} onClick={() => setCoverIndex(i)} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="wizard-foot">
        {step > 1 ? (
          <button className="wz-back" onClick={() => setStep((s) => s - 1)} disabled={busy}>← Back</button>
        ) : <span />}
        <span className="wz-count">{step} of 3</span>
        {step < 3 ? (
          <button className="wz-next" onClick={next} disabled={!canContinue}>Continue →</button>
        ) : (
          <button className="wz-next" onClick={create} disabled={!title.trim() || busy}>
            {busy ? "Creating…" : "Create trip ✨"}
          </button>
        )}
      </div>
    </div>
  );
}
